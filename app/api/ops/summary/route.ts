import { prisma } from "@/lib/prisma"
import { getAttendancePhotoStorageHealth } from "@/lib/attendance-photo-maintenance"
import { createAuditLog } from "@/lib/audit"
import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { getBusinessDateStart } from "@/lib/time"
import {
  asClockMinutes,
  asMeterRadius,
  asOptionalLatitude,
  asOptionalLongitude,
  asPayrollPayday,
} from "@/lib/validators"

type OpsSettingsBody = {
  payrollPayday?: unknown
  workStartTime?: unknown
  workEndTime?: unknown
  latitude?: unknown
  longitude?: unknown
  allowedRadiusMeters?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (_req, _context, access) => {
    const tenantId = access.user.tenantId
    const today = getBusinessDateStart(new Date())
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

    await prisma.$queryRaw`SELECT 1`

    const [
      tenant,
      activeEmployees,
      pendingCorrections,
      lockedPayrollPeriods,
      openAttendanceShifts,
      auditEventsLast24h,
      checkedInToday,
      photoStorage,
    ] =
      await Promise.all([
        prisma.tenant.findUnique({
          where: {
            id: tenantId,
          },
          select: {
            registrationCode: true,
            payrollPayday: true,
            workStartMinutes: true,
            workEndMinutes: true,
            latitude: true,
            longitude: true,
            allowedRadiusMeters: true,
          },
        }),
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
          },
        }),
        prisma.attendanceCorrection.count({
          where: {
            tenantId,
            status: "PENDING",
          },
        }),
        prisma.payrollPeriod.count({
          where: {
            tenantId,
            status: "LOCKED",
          },
        }),
        prisma.attendance.count({
          where: {
            checkIn: {
              not: null,
            },
            checkOut: null,
            employee: {
              tenantId,
            },
          },
        }),
        prisma.auditLog.count({
          where: {
            tenantId,
            createdAt: {
              gte: last24Hours,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkIn: {
              not: null,
            },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
        getAttendancePhotoStorageHealth(tenantId),
      ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    return jsonResponse({
      app: "up",
      database: "up",
      nodeEnv: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "0.0.0",
      timestamp: new Date().toISOString(),
      activeEmployees,
      pendingCorrections,
      lockedPayrollPeriods,
      openAttendanceShifts,
      auditEventsLast24h,
      checkedInToday,
      photoStorage,
      settings: {
        registrationCode: tenant.registrationCode,
        payrollPayday: tenant.payrollPayday,
        workStartMinutes: tenant.workStartMinutes,
        workEndMinutes: tenant.workEndMinutes,
        latitude: tenant.latitude,
        longitude: tenant.longitude,
        allowedRadiusMeters: tenant.allowedRadiusMeters,
      },
      subscription: access.subscription,
    })
  },
)

export const PUT = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (req, _context, access) => {
    const body = await readJsonBody<OpsSettingsBody>(req)
    const payrollPayday = asPayrollPayday(body.payrollPayday)
    const workStartMinutes = asClockMinutes(body.workStartTime, "workStartTime")
    const workEndMinutes = asClockMinutes(body.workEndTime, "workEndTime")
    const latitude = asOptionalLatitude(body.latitude)
    const longitude = asOptionalLongitude(body.longitude)
    const allowedRadiusMeters = asMeterRadius(body.allowedRadiusMeters)

    if (workEndMinutes <= workStartMinutes) {
      throw new AppError(
        "เวลาเลิกงานต้องมากกว่าเวลาเข้างาน",
        400,
        "INVALID_INPUT",
      )
    }

    if ((latitude === null) !== (longitude === null)) {
      throw new AppError(
        "กรุณากรอกละติจูดและลองจิจูดให้ครบทั้งคู่",
        400,
        "INVALID_INPUT",
      )
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: access.user.tenantId,
      },
      data: {
        payrollPayday,
        workStartMinutes,
        workEndMinutes,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "ops.settings_updated",
      entityType: "Tenant",
      entityId: updatedTenant.id,
      metadata: {
        payrollPayday,
        workStartMinutes,
        workEndMinutes,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    return jsonResponse({
      ok: true,
      settings: {
        registrationCode: updatedTenant.registrationCode,
        payrollPayday: updatedTenant.payrollPayday,
        workStartMinutes: updatedTenant.workStartMinutes,
        workEndMinutes: updatedTenant.workEndMinutes,
        latitude: updatedTenant.latitude,
        longitude: updatedTenant.longitude,
        allowedRadiusMeters: updatedTenant.allowedRadiusMeters,
      },
    })
  },
)
