import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { autoCloseAttendanceIfDue } from "@/lib/attendance-auto-checkout"
import {
  getRegularWorkedMinutes,
  getShiftEndByWorkShift,
  getShiftWorkDate,
} from "@/lib/attendance"
import {
  buildCheckOutPhotoUrl,
  deleteStoredCheckInPhoto,
  saveCheckInPhoto,
} from "@/lib/check-in-photo-storage"
import { assertWithinAllowedRadius, getEffectiveLocationConfig } from "@/lib/gps"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { asLatitude, asLongitude, asPhotoReference } from "@/lib/validators"

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeSelfService,
    })

    if (!access.user.employeeId) {
      throw new AppError(
        "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน",
        409,
        "EMPLOYEE_PROFILE_NOT_LINKED",
      )
    }

    const body = await readJsonBody<{
      photo?: unknown
      latitude?: unknown
      longitude?: unknown
    }>(req)
    const photo = asPhotoReference(body.photo)
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
    const employeeId = access.user.employeeId
    const now = new Date()

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          workEndMinutes: true,
          morningShiftStartMinutes: true,
          morningShiftEndMinutes: true,
          afternoonShiftStartMinutes: true,
          afternoonShiftEndMinutes: true,
          nightShiftStartMinutes: true,
          nightShiftEndMinutes: true,
          latitude: true,
          longitude: true,
          allowedRadiusMeters: true,
        },
      }),
      prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: access.user.tenantId,
          active: true,
        },
        include: {
          branch: {
            select: {
              name: true,
              latitude: true,
              longitude: true,
              allowedRadiusMeters: true,
            },
          },
        },
      }),
    ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404, "NOT_FOUND")
    }

    const workDate = getShiftWorkDate(now, tenant, employee.workShift)

    await assertPayrollPeriodOpenForDate(access.user.tenantId, workDate)

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        workDate: "desc",
      },
    })

    if (!attendance?.checkIn) {
      throw new AppError("ยังไม่ได้บันทึกเข้างานวันนี้", 400, "CHECKIN_NOT_FOUND")
    }

    if (attendance.workDate.getTime() !== workDate.getTime()) {
      const autoClosedAttendance = await autoCloseAttendanceIfDue({
        tenantId: access.user.tenantId,
        auditUserId: access.user.id,
        attendance,
        tenant,
        now,
      })

      if (autoClosedAttendance) {
        return jsonResponse(autoClosedAttendance)
      }

      throw new AppError(
        "พบรายการลงเวลาเดิมที่ยังไม่ปิดงาน กรุณาติดต่อหัวหน้า",
        409,
        "OPEN_ATTENDANCE_OUTSIDE_TODAY",
      )
    }

    const shiftEnd = getShiftEndByWorkShift(now, tenant, employee.workShift)
    const { paidCheckoutAt, workedMinutes } = getRegularWorkedMinutes({
      checkIn: attendance.checkIn,
      requestedCheckOut: now,
      shiftEnd,
    })
    const locationConfig = getEffectiveLocationConfig({
      tenant,
      branch: employee.branch,
    })
    const distanceMeters = assertWithinAllowedRadius({
      latitude,
      longitude,
      targetLatitude: locationConfig.latitude,
      targetLongitude: locationConfig.longitude,
      allowedRadiusMeters: locationConfig.allowedRadiusMeters,
    })
    const checkOutPhotoUrl = buildCheckOutPhotoUrl(attendance.id)

    if (now.getTime() < shiftEnd.getTime()) {
      const earlyCheckoutRequest = await prisma.earlyCheckoutRequest.findFirst({
        where: {
          tenantId: access.user.tenantId,
          employeeId,
          workDate,
          status: "APPROVED",
        },
      })

      if (!earlyCheckoutRequest) {
        throw new AppError(
          "ยังไม่ถึงเวลาเลิกงาน กรุณายื่นคำขอกลับก่อนเวลาและรอหัวหน้าอนุมัติก่อน",
          409,
          "EARLY_CHECKOUT_NOT_APPROVED",
        )
      }
    }

    await saveCheckInPhoto({
      tenantId: access.user.tenantId,
      employeeId,
      attendanceId: attendance.id,
      photoDataUrl: photo,
      photoKind: "check-out",
    })

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const updatedAttendance = await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            checkOut: now,
            workedMinutes,
            checkOutPhotoUrl,
            checkOutLatitude: latitude,
            checkOutLongitude: longitude,
            checkOutDistanceMeters: distanceMeters,
          },
        })

        await tx.auditLog.create({
          data: {
            tenantId: access.user.tenantId,
            userId: access.user.id,
            action: "employee_portal.checked_out",
            entityType: "Attendance",
            entityId: updatedAttendance.id,
            metadata: {
              employeeId,
              workDate,
              workedMinutes,
              workShift: employee.workShift,
              paidCheckoutAt,
              isEarlyCheckout: now.getTime() < shiftEnd.getTime(),
              latitude,
              longitude,
              distanceMeters,
              locationLabel: locationConfig.label,
            },
          },
        })

        return updatedAttendance
      })

      return jsonResponse(updated)
    } catch (error) {
      await deleteStoredCheckInPhoto({
        tenantId: access.user.tenantId,
        employeeId,
        attendanceId: attendance.id,
        photoKind: "check-out",
      })

      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
