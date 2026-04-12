import type { WorkShift } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  getAutoCheckoutDeadline,
  getShiftWorkDate,
  getRegularWorkedMinutes,
  getShiftEndForWorkDate,
  type ShiftScheduleSettings,
} from "@/lib/attendance"

type AttendanceRecord = {
  id: string
  employeeId: string
  workDate: Date
  checkIn: Date | null
  checkOut: Date | null
  workShift: WorkShift
}

type AttendanceTenantSettings = ShiftScheduleSettings

async function getApprovedOvertimeMinutes(params: {
  tenantId: string
  employeeId: string
  workDate: Date
}) {
  const approvedRequests = await prisma.overtimeRequest.findMany({
    where: {
      tenantId: params.tenantId,
      employeeId: params.employeeId,
      workDate: params.workDate,
      status: "APPROVED",
    },
    select: {
      overtimeMinutes: true,
    },
  })

  return approvedRequests.reduce(
    (sum, request) => sum + request.overtimeMinutes,
    0,
  )
}

export async function getApprovedOvertimeMinutesForAttendance(params: {
  tenantId: string
  employeeId: string
  workDate: Date
}) {
  return getApprovedOvertimeMinutes(params)
}

async function finalizeOpenAttendance(params: {
  tenantId: string
  auditUserId?: string | null
  attendance: AttendanceRecord
  checkOutAt: Date
  shiftEnd: Date
  approvedOvertimeMinutes: number
  action: string
  note: string
  checkoutBy: "system" | "manager"
}) {
  if (!params.attendance.checkIn) {
    return null
  }

  const { workedMinutes } = getRegularWorkedMinutes({
    checkIn: params.attendance.checkIn,
    requestedCheckOut: params.checkOutAt,
    shiftEnd: params.shiftEnd,
  })

  return prisma.$transaction(async (tx) => {
    const updatedAttendance = await tx.attendance.update({
      where: {
        id: params.attendance.id,
      },
      data: {
        checkOut: params.checkOutAt,
        workedMinutes,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.auditUserId ?? null,
        action: params.action,
        entityType: "Attendance",
        entityId: updatedAttendance.id,
        metadata: {
          employeeId: updatedAttendance.employeeId,
          workDate: updatedAttendance.workDate,
          autoCheckoutAt: params.checkOutAt,
          workedMinutes,
          approvedOvertimeMinutes: params.approvedOvertimeMinutes,
          checkoutBy: params.checkoutBy,
          note: params.note,
        },
      },
    })

    return updatedAttendance
  })
}

export async function autoCloseAttendanceIfDue(params: {
  tenantId: string
  auditUserId?: string | null
  attendance: AttendanceRecord
  tenant: AttendanceTenantSettings
  now?: Date
}) {
  if (!params.attendance.checkIn || params.attendance.checkOut) {
    return null
  }

  const approvedOvertimeMinutes = await getApprovedOvertimeMinutes({
    tenantId: params.tenantId,
    employeeId: params.attendance.employeeId,
    workDate: params.attendance.workDate,
  })
  const shiftEnd = getShiftEndForWorkDate(
    params.attendance.workDate,
    params.tenant,
    params.attendance.workShift,
  )
  const autoCheckoutAt = getAutoCheckoutDeadline({
    checkIn: params.attendance.checkIn,
    shiftEnd,
    approvedOvertimeMinutes,
  })
  const now = params.now ?? new Date()

  if (now.getTime() < autoCheckoutAt.getTime()) {
    return null
  }

  return finalizeOpenAttendance({
    tenantId: params.tenantId,
    auditUserId: params.auditUserId,
    attendance: params.attendance,
    checkOutAt: autoCheckoutAt,
    shiftEnd,
    approvedOvertimeMinutes,
    action: "attendance.auto_checked_out",
    note: "ออกงานโดยระบบ",
    checkoutBy: "system",
  })
}

export async function forceCloseOpenAttendance(params: {
  tenantId: string
  auditUserId?: string | null
  attendance: AttendanceRecord
  tenant: AttendanceTenantSettings
  now?: Date
}) {
  if (!params.attendance.checkIn || params.attendance.checkOut) {
    return null
  }

  const now = params.now ?? new Date()
  const currentWorkDate = getShiftWorkDate(
    now,
    params.tenant,
    params.attendance.workShift,
  )

  if (params.attendance.workDate.getTime() >= currentWorkDate.getTime()) {
    return null
  }

  const approvedOvertimeMinutes = await getApprovedOvertimeMinutes({
    tenantId: params.tenantId,
    employeeId: params.attendance.employeeId,
    workDate: params.attendance.workDate,
  })
  const shiftEnd = getShiftEndForWorkDate(
    params.attendance.workDate,
    params.tenant,
    params.attendance.workShift,
  )
  const forcedCheckoutAt = getAutoCheckoutDeadline({
    checkIn: params.attendance.checkIn,
    shiftEnd,
    approvedOvertimeMinutes,
  })

  return finalizeOpenAttendance({
    tenantId: params.tenantId,
    auditUserId: params.auditUserId,
    attendance: params.attendance,
    checkOutAt: forcedCheckoutAt,
    shiftEnd,
    approvedOvertimeMinutes,
    action: "attendance.manager_forced_checkout",
    note: "ปิดออกงานย้อนหลังโดยผู้จัดการ",
    checkoutBy: "manager",
  })
}

export async function autoCloseDueAttendances(limit = 100) {
  const openAttendances = await prisma.attendance.findMany({
    where: {
      checkIn: {
        not: null,
      },
      checkOut: null,
      employee: {
        active: true,
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          tenantId: true,
          workShift: true,
          active: true,
          tenant: {
            select: {
              workStartMinutes: true,
              workEndMinutes: true,
              morningShiftStartMinutes: true,
              morningShiftEndMinutes: true,
              afternoonShiftStartMinutes: true,
              afternoonShiftEndMinutes: true,
              nightShiftStartMinutes: true,
              nightShiftEndMinutes: true,
            },
          },
        },
      },
    },
    orderBy: {
      workDate: "asc",
    },
    take: limit,
  })

  const closedIds: string[] = []
  const now = new Date()

  for (const attendance of openAttendances) {
    if (!attendance.employee.active) {
      continue
    }

    const updated = await autoCloseAttendanceIfDue({
      tenantId: attendance.employee.tenantId,
      attendance,
      tenant: attendance.employee.tenant,
      now,
    })

    if (updated) {
      closedIds.push(updated.id)
    }
  }

  return {
    processedCount: openAttendances.length,
    closedCount: closedIds.length,
    closedIds,
  }
}

export async function getSystemCheckedOutAttendanceIds(params: {
  tenantId: string
  attendanceIds: string[]
}) {
  if (params.attendanceIds.length === 0) {
    return new Set<string>()
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: params.tenantId,
      entityType: "Attendance",
      action: "attendance.auto_checked_out",
      entityId: {
        in: params.attendanceIds,
      },
    },
    select: {
      entityId: true,
    },
  })

  return new Set(
    logs.flatMap((log) => (log.entityId ? [log.entityId] : [])),
  )
}
