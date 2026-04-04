import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { getShiftStart, getWorkDate } from "@/lib/attendance"
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
import {
  asLatitude,
  asLongitude,
  asPhotoReference,
  asTrimmedString,
} from "@/lib/validators"

export const runtime = "nodejs"

type CheckInBody = {
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
    const body = await readJsonBody<CheckInBody>(req)
    const employeeId = asTrimmedString(body.employeeId, "employeeId")
    const photo = asPhotoReference(body.photo)
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
    const now = new Date()
    const workDate = getWorkDate(now)

    await assertPayrollPeriodOpenForDate(access.user.tenantId, workDate)

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          workStartMinutes: true,
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

      throw new AppError(
        "พนักงานมีรายการลงเวลาเดิมที่ยังไม่ check-out",
        409,
        "OPEN_ATTENDANCE_EXISTS",
      )
    }

    const shiftStart = getShiftStart(now, tenant.workStartMinutes)
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
            action: "attendance.checked_in",
            entityType: "Attendance",
            entityId: created.id,
            metadata: {
              employeeId,
              workDate,
              lateMinutes,
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
