import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import {
  ensureCheckoutAfterCheckin,
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
import {
  asLatitude,
  asLongitude,
  asPhotoReference,
  asTrimmedString,
} from "@/lib/validators"

type CheckOutBody = {
  employeeId?: unknown
  photo?: unknown
  latitude?: unknown
  longitude?: unknown
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })
    const body = await readJsonBody<CheckOutBody>(req)
    const employeeId = asTrimmedString(body.employeeId, "employeeId")
    const photo = asPhotoReference(body.photo)
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
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
      throw new AppError("Employee not found", 404, "NOT_FOUND")
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
      throw new AppError("ยังไม่ได้ check-in วันนี้", 400, "CHECKIN_NOT_FOUND")
    }

    if (attendance.workDate.getTime() !== workDate.getTime()) {
      throw new AppError(
        "พบรายการลงเวลาเดิมที่ยังไม่ปิดงาน กรุณาตรวจสอบก่อน",
        409,
        "OPEN_ATTENDANCE_OUTSIDE_TODAY",
      )
    }

    const workedMinutes = ensureCheckoutAfterCheckin(attendance.checkIn, now)
    const shiftEnd = getShiftEndByWorkShift(now, tenant, employee.workShift)
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
          `ยังไม่ถึงเวลาเลิกงาน กรุณาส่งคำขอกลับก่อนเวลาและรอหัวหน้าอนุมัติก่อน`,
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
            action: "attendance.checked_out",
            entityType: "Attendance",
            entityId: updatedAttendance.id,
            metadata: {
              employeeId,
              workDate,
              workedMinutes,
              workShift: employee.workShift,
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
