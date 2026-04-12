import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { autoCloseAttendanceIfDue } from "@/lib/attendance-auto-checkout"
import {
  getShiftStartByWorkShift,
  getShiftWorkDate,
} from "@/lib/attendance"
import {
  buildCheckInPhotoUrl,
  deleteStoredCheckInPhoto,
  saveCheckInPhoto,
} from "@/lib/check-in-photo-storage"
import { assertWithinAllowedRadius, getEffectiveLocationConfig } from "@/lib/gps"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { minutesBetween } from "@/lib/time"
import { asLatitude, asLongitude, asPhotoReference } from "@/lib/validators"

export const runtime = "nodejs"

type EmployeeCheckInBody = {
  photo?: unknown
  latitude?: unknown
  longitude?: unknown
}

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

    const body = await readJsonBody<EmployeeCheckInBody>(req)
    const photo = asPhotoReference(body.photo)
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
    const now = new Date()
    const employeeId = access.user.employeeId

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          workStartMinutes: true,
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

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        workDate: "desc",
      },
    })

    if (openAttendance) {
      if (openAttendance.workDate.getTime() === workDate.getTime()) {
        throw new AppError("ลงเวลาเข้าแล้ววันนี้", 409, "ALREADY_CHECKED_IN")
      }

      const autoClosedAttendance = await autoCloseAttendanceIfDue({
        tenantId: access.user.tenantId,
        auditUserId: access.user.id,
        attendance: openAttendance,
        tenant,
        now,
      })

      if (!autoClosedAttendance) {
        throw new AppError(
          "มีรายการลงเวลาเดิมที่ยังไม่ได้บันทึกออกงาน",
          409,
          "OPEN_ATTENDANCE_EXISTS",
        )
      }
    }

    const shiftStart = getShiftStartByWorkShift(now, tenant, employee.workShift)
    const lateMinutes = Math.max(0, minutesBetween(shiftStart, now))
    const attendanceId = crypto.randomUUID()
    const checkInPhotoUrl = buildCheckInPhotoUrl(attendanceId)

    await saveCheckInPhoto({
      tenantId: access.user.tenantId,
      employeeId,
      attendanceId,
      photoDataUrl: photo,
    })

    try {
      const attendance = await prisma.$transaction(async (tx) => {
        const created = await tx.attendance.create({
          data: {
            id: attendanceId,
            employeeId,
            workDate,
            checkIn: now,
            lateMinutes,
            status: lateMinutes > 0 ? "LATE" : "PRESENT",
            workShift: employee.workShift,
            checkInPhotoUrl,
            checkInLatitude: latitude,
            checkInLongitude: longitude,
            checkInDistanceMeters: distanceMeters,
          },
        })

        await tx.auditLog.create({
          data: {
            tenantId: access.user.tenantId,
            userId: access.user.id,
            action: "employee_portal.checked_in",
            entityType: "Attendance",
            entityId: created.id,
            metadata: {
              employeeId,
              workDate,
              lateMinutes,
              workShift: employee.workShift,
              latitude,
              longitude,
              distanceMeters,
              locationLabel: locationConfig.label,
            },
          },
        })

        return created
      })

      return jsonResponse(attendance, 201)
    } catch (error) {
      await deleteStoredCheckInPhoto({
        tenantId: access.user.tenantId,
        employeeId,
        attendanceId,
      })

      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}
