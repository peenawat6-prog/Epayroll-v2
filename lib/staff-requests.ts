import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { AppError } from "@/lib/http"
import {
  assertPayrollPeriodOpenForDate,
  isPayrollPeriodLockedForDate,
} from "@/lib/payroll"
import { getBusinessDateStart } from "@/lib/time"
import {
  asAction,
  asBusinessDate,
  asOptionalTrimmedString,
  asTrimmedString,
} from "@/lib/validators"

export type StaffRequestKind =
  | "LEAVE"
  | "OVERTIME"
  | "EARLY_CHECKOUT"
  | "RESIGNATION"

type StaffRequestCreateInput = {
  kind?: unknown
  employeeId?: unknown
  startDate?: unknown
  endDate?: unknown
  workDate?: unknown
  overtimeHours?: unknown
  lastWorkDate?: unknown
  reason?: unknown
}

type StaffRequestReviewInput = {
  kind?: unknown
  status?: unknown
  reviewNote?: unknown
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function asRequestKind(value: unknown): StaffRequestKind {
  return asAction(value, [
    "LEAVE",
    "OVERTIME",
    "EARLY_CHECKOUT",
    "RESIGNATION",
  ]) as StaffRequestKind
}

function asReviewStatus(value: unknown) {
  return asAction(value, ["APPROVED", "REJECTED"]) as "APPROVED" | "REJECTED"
}

function asOvertimeMinutes(value: unknown) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 24) {
    throw new AppError("จำนวนชั่วโมง OT ไม่ถูกต้อง", 400, "INVALID_INPUT")
  }

  return Math.round(parsed * 60)
}

async function getScopedEmployee(employeeId: string, tenantId: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      tenantId,
      active: true,
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      active: true,
    },
  })

  if (!employee) {
    throw new AppError("ไม่พบพนักงานในร้านนี้", 404, "NOT_FOUND")
  }

  return employee
}

function mapRequestItem(
  kind: StaffRequestKind,
  item: {
    id: string
    status: string
    reason: string | null
    reviewNote: string | null
    createdAt: Date
    reviewedAt: Date | null
    employee: {
      code: string
      firstName: string
      lastName: string
      position: string
    }
  } & Record<string, unknown>,
) {
  return {
    id: item.id,
    kind,
    status: item.status,
    reason: item.reason,
    reviewNote: item.reviewNote,
    createdAt: item.createdAt.toISOString(),
    reviewedAt: item.reviewedAt?.toISOString() ?? null,
    employeeCode: item.employee.code,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeePosition: item.employee.position,
    startDate: item.startDate instanceof Date ? item.startDate.toISOString() : null,
    endDate: item.endDate instanceof Date ? item.endDate.toISOString() : null,
    workDate: item.workDate instanceof Date ? item.workDate.toISOString() : null,
    overtimeMinutes: typeof item.overtimeMinutes === "number" ? item.overtimeMinutes : null,
    lastWorkDate: item.lastWorkDate instanceof Date ? item.lastWorkDate.toISOString() : null,
  }
}

export async function listStaffRequests(
  tenantId: string,
  options?: {
    employeeId?: string | null
  },
) {
  const employeeScope = options?.employeeId
    ? {
        employeeId: options.employeeId,
      }
    : {}

  const [leaves, overtimeRequests, earlyCheckoutRequests, resignationRequests] =
    await Promise.all([
      prisma.leave.findMany({
        where: {
          tenantId,
          ...employeeScope,
        },
        include: {
          employee: {
            select: {
              code: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.overtimeRequest.findMany({
        where: {
          tenantId,
          ...employeeScope,
        },
        include: {
          employee: {
            select: {
              code: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.earlyCheckoutRequest.findMany({
        where: {
          tenantId,
          ...employeeScope,
        },
        include: {
          employee: {
            select: {
              code: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.resignationRequest.findMany({
        where: {
          tenantId,
          ...employeeScope,
        },
        include: {
          employee: {
            select: {
              code: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ])

  return [
    ...leaves.map((item) => mapRequestItem("LEAVE", item)),
    ...overtimeRequests.map((item) => mapRequestItem("OVERTIME", item)),
    ...earlyCheckoutRequests.map((item) =>
      mapRequestItem("EARLY_CHECKOUT", item),
    ),
    ...resignationRequests.map((item) => mapRequestItem("RESIGNATION", item)),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export async function submitStaffRequest(params: {
  tenantId: string
  userId: string
  requesterEmployeeId?: string | null
  enforceSelfEmployeeScope?: boolean
  body: StaffRequestCreateInput
}) {
  const kind = asRequestKind(params.body.kind)
  const employeeId = asTrimmedString(params.body.employeeId, "employeeId")
  const reason = asOptionalTrimmedString(params.body.reason)

  if (params.enforceSelfEmployeeScope) {
    if (!params.requesterEmployeeId) {
      throw new AppError(
        "บัญชีพนักงานนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน",
        409,
        "EMPLOYEE_PROFILE_NOT_LINKED",
      )
    }

    if (employeeId !== params.requesterEmployeeId) {
      throw new AppError(
        "พนักงานส่งคำขอได้เฉพาะข้อมูลของตนเองเท่านั้น",
        403,
        "FORBIDDEN",
      )
    }
  }

  const employee = await getScopedEmployee(employeeId, params.tenantId)

  if (kind === "LEAVE") {
    const startDate = getBusinessDateStart(
      asBusinessDate(params.body.startDate, "startDate"),
    )
    const endDate = getBusinessDateStart(
      asBusinessDate(params.body.endDate, "endDate"),
    )

    if (endDate.getTime() < startDate.getTime()) {
      throw new AppError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา", 400, "INVALID_INPUT")
    }

    const leave = await prisma.leave.create({
      data: {
        tenantId: params.tenantId,
        employeeId: employee.id,
        requestedByUserId: params.userId,
        startDate,
        endDate,
        reason,
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "leave.requested",
      entityType: "Leave",
      entityId: leave.id,
      metadata: {
        employeeId: employee.id,
        startDate,
        endDate,
      },
    })

    return leave
  }

  if (kind === "OVERTIME") {
    const workDate = getBusinessDateStart(
      asBusinessDate(params.body.workDate, "workDate"),
    )
    const overtimeMinutes = asOvertimeMinutes(params.body.overtimeHours)

    const overtime = await prisma.overtimeRequest.create({
      data: {
        tenantId: params.tenantId,
        employeeId: employee.id,
        requestedByUserId: params.userId,
        workDate,
        overtimeMinutes,
        reason,
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "overtime.requested",
      entityType: "OvertimeRequest",
      entityId: overtime.id,
      metadata: {
        employeeId: employee.id,
        workDate,
        overtimeMinutes,
      },
    })

    return overtime
  }

  if (kind === "EARLY_CHECKOUT") {
    const workDate = getBusinessDateStart(
      asBusinessDate(params.body.workDate, "workDate"),
    )

    await assertPayrollPeriodOpenForDate(params.tenantId, workDate)

    const earlyCheckoutRequest = await prisma.earlyCheckoutRequest.create({
      data: {
        tenantId: params.tenantId,
        employeeId: employee.id,
        requestedByUserId: params.userId,
        workDate,
        reason,
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "early_checkout.requested",
      entityType: "EarlyCheckoutRequest",
      entityId: earlyCheckoutRequest.id,
      metadata: {
        employeeId: employee.id,
        workDate,
      },
    })

    return earlyCheckoutRequest
  }

  const lastWorkDate = getBusinessDateStart(
    asBusinessDate(params.body.lastWorkDate, "lastWorkDate"),
  )

  const resignation = await prisma.resignationRequest.create({
    data: {
      tenantId: params.tenantId,
      employeeId: employee.id,
      requestedByUserId: params.userId,
      lastWorkDate,
      reason,
    },
  })

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: "resignation.requested",
    entityType: "ResignationRequest",
    entityId: resignation.id,
    metadata: {
      employeeId: employee.id,
      lastWorkDate,
    },
  })

  return resignation
}

async function approveLeave(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string | null,
) {
  const leave = await prisma.leave.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!leave) {
    throw new AppError("ไม่พบคำขอลานี้", 404, "NOT_FOUND")
  }

  if (leave.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const totalDays =
    Math.floor((leave.endDate.getTime() - leave.startDate.getTime()) / 86400000) + 1

  let skippedLockedDays = 0

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex += 1) {
    const workDate = addDays(leave.startDate, dayIndex)

    if (await isPayrollPeriodLockedForDate(tenantId, workDate)) {
      skippedLockedDays += 1
      continue
    }

    await prisma.attendance.upsert({
      where: {
        employeeId_workDate: {
          employeeId: leave.employeeId,
          workDate,
        },
      },
      update: {
        status: "LEAVE",
        checkIn: null,
        checkOut: null,
        workedMinutes: 0,
        lateMinutes: 0,
      },
      create: {
        employeeId: leave.employeeId,
        workDate,
        status: "LEAVE",
      },
    })
  }

  const updated = await prisma.leave.update({
    where: { id: leave.id },
    data: {
      status: "APPROVED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "leave.approved",
    entityType: "Leave",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      startDate: updated.startDate,
      endDate: updated.endDate,
      skippedLockedDays,
    },
  })

  return updated
}

async function rejectLeave(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string,
) {
  const leave = await prisma.leave.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!leave) {
    throw new AppError("ไม่พบคำขอลานี้", 404, "NOT_FOUND")
  }

  if (leave.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const updated = await prisma.leave.update({
    where: { id: leave.id },
    data: {
      status: "REJECTED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "leave.rejected",
    entityType: "Leave",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      reviewNote,
    },
  })

  return updated
}

async function approveOvertime(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string | null,
) {
  const overtime = await prisma.overtimeRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!overtime) {
    throw new AppError("ไม่พบคำขอ OT นี้", 404, "NOT_FOUND")
  }

  if (overtime.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  await assertPayrollPeriodOpenForDate(tenantId, overtime.workDate)

  const updated = await prisma.overtimeRequest.update({
    where: { id: overtime.id },
    data: {
      status: "APPROVED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "overtime.approved",
    entityType: "OvertimeRequest",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      workDate: updated.workDate,
      overtimeMinutes: updated.overtimeMinutes,
    },
  })

  return updated
}

async function rejectOvertime(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string,
) {
  const overtime = await prisma.overtimeRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!overtime) {
    throw new AppError("ไม่พบคำขอ OT นี้", 404, "NOT_FOUND")
  }

  if (overtime.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const updated = await prisma.overtimeRequest.update({
    where: { id: overtime.id },
    data: {
      status: "REJECTED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "overtime.rejected",
    entityType: "OvertimeRequest",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      reviewNote,
    },
  })

  return updated
}

async function approveResignation(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string | null,
) {
  const resignation = await prisma.resignationRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!resignation) {
    throw new AppError("ไม่พบคำขอลาออกนี้", 404, "NOT_FOUND")
  }

  if (resignation.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const openAttendance = await prisma.attendance.findFirst({
    where: {
      employeeId: resignation.employeeId,
      checkIn: { not: null },
      checkOut: null,
    },
  })

  if (openAttendance) {
    throw new AppError(
      "พนักงานยังมีรายการลงเวลาที่ยังไม่ออกงาน",
      409,
      "EMPLOYEE_HAS_OPEN_ATTENDANCE",
    )
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.resignationRequest.update({
      where: { id: resignation.id },
      data: {
        status: "APPROVED",
        reviewNote,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
      },
    })

    await tx.employee.update({
      where: {
        id: resignation.employeeId,
      },
      data: {
        active: false,
        terminatedAt: resignation.lastWorkDate,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "resignation.approved",
        entityType: "ResignationRequest",
        entityId: updated.id,
        metadata: {
          employeeId: updated.employeeId,
          lastWorkDate: updated.lastWorkDate,
        },
      },
    })

    return updated
  })
}

async function approveEarlyCheckout(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string | null,
) {
  const request = await prisma.earlyCheckoutRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอกลับก่อนเวลานี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  await assertPayrollPeriodOpenForDate(tenantId, request.workDate)

  const updated = await prisma.earlyCheckoutRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "early_checkout.approved",
    entityType: "EarlyCheckoutRequest",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      workDate: updated.workDate,
    },
  })

  return updated
}

async function rejectEarlyCheckout(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string,
) {
  const request = await prisma.earlyCheckoutRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอกลับก่อนเวลานี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const updated = await prisma.earlyCheckoutRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "early_checkout.rejected",
    entityType: "EarlyCheckoutRequest",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      reviewNote,
    },
  })

  return updated
}

async function rejectResignation(
  requestId: string,
  tenantId: string,
  userId: string,
  reviewNote: string,
) {
  const resignation = await prisma.resignationRequest.findFirst({
    where: {
      id: requestId,
      tenantId,
    },
  })

  if (!resignation) {
    throw new AppError("ไม่พบคำขอลาออกนี้", 404, "NOT_FOUND")
  }

  if (resignation.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  const updated = await prisma.resignationRequest.update({
    where: { id: resignation.id },
    data: {
      status: "REJECTED",
      reviewNote,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    },
  })

  await createAuditLog({
    tenantId,
    userId,
    action: "resignation.rejected",
    entityType: "ResignationRequest",
    entityId: updated.id,
    metadata: {
      employeeId: updated.employeeId,
      reviewNote,
    },
  })

  return updated
}

export async function reviewStaffRequest(params: {
  tenantId: string
  userId: string
  requestId: string
  body: StaffRequestReviewInput
}) {
  const kind = asRequestKind(params.body.kind)
  const status = asReviewStatus(params.body.status)
  const reviewNote = asOptionalTrimmedString(params.body.reviewNote)

  if (status === "REJECTED" && !reviewNote) {
    throw new AppError("กรุณาระบุเหตุผลเมื่อไม่อนุมัติ", 400, "INVALID_INPUT")
  }

  if (kind === "LEAVE") {
    return status === "APPROVED"
      ? approveLeave(params.requestId, params.tenantId, params.userId, reviewNote)
      : rejectLeave(params.requestId, params.tenantId, params.userId, reviewNote!)
  }

  if (kind === "OVERTIME") {
    return status === "APPROVED"
      ? approveOvertime(params.requestId, params.tenantId, params.userId, reviewNote)
      : rejectOvertime(params.requestId, params.tenantId, params.userId, reviewNote!)
  }

  if (kind === "EARLY_CHECKOUT") {
    return status === "APPROVED"
      ? approveEarlyCheckout(params.requestId, params.tenantId, params.userId, reviewNote)
      : rejectEarlyCheckout(params.requestId, params.tenantId, params.userId, reviewNote!)
  }

  return status === "APPROVED"
    ? approveResignation(params.requestId, params.tenantId, params.userId, reviewNote)
    : rejectResignation(params.requestId, params.tenantId, params.userId, reviewNote!)
}
