import bcrypt from "bcrypt"
import type { EmployeeRegistrationStatus, WorkShift } from "@prisma/client"
import { assertCanAddActiveEmployee } from "@/lib/business-limits"
import { generateNextEmployeeCode } from "@/lib/employee-code"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { createAuditLog } from "@/lib/audit"
import { assertTenantSubscriptionSnapshotActive } from "@/lib/subscription"

export async function submitEmployeeRegistrationRequest(params: {
  registrationCode: string
  branchId: string | null
  firstName: string
  lastName: string
  phone: string | null
  position: string
  email: string
  password: string
  employeeType: "FULL_TIME" | "PART_TIME"
  payType: "MONTHLY" | "DAILY" | "HOURLY"
  workShift: WorkShift
  dayOffWeekdays: string[]
  bankName: string
  accountName: string
  accountNumber: string
  promptPayId: string | null
}) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      registrationCode: params.registrationCode,
    },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  })

  if (!tenant) {
    throw new AppError("รหัสร้านไม่ถูกต้อง", 404, "TENANT_NOT_FOUND")
  }

  assertTenantSubscriptionSnapshotActive(tenant)

  await assertCanAddActiveEmployee(tenant.id)

  if (params.branchId) {
    const branch = await prisma.branch.findFirst({
      where: {
        id: params.branchId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
      },
    })

    if (!branch) {
      throw new AppError("ไม่พบสาขาที่เลือก", 404, "BRANCH_NOT_FOUND")
    }
  }

  const code = await generateNextEmployeeCode(tenant.id)

  const [existingUser, existingEmployee, existingPendingRequest] =
    await Promise.all([
      prisma.user.findUnique({
        where: {
          email: params.email,
        },
        select: {
          id: true,
        },
      }),
      prisma.employee.findUnique({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code,
          },
        },
        select: {
          id: true,
        },
      }),
      prisma.employeeRegistrationRequest.findFirst({
        where: {
          tenantId: tenant.id,
          status: "PENDING",
          email: params.email,
        },
        select: {
          id: true,
        },
      }),
    ])

  if (existingUser) {
    throw new AppError(
      "บัญชีนี้มีผู้ใช้แล้ว โปรดติดต่อเจ้าของร้าน",
      409,
      "EMAIL_ALREADY_EXISTS",
    )
  }

  if (existingEmployee) {
    throw new AppError("รหัสพนักงานนี้ถูกใช้งานแล้ว", 409, "EMPLOYEE_CODE_EXISTS")
  }

  if (existingPendingRequest) {
    throw new AppError(
      "มีคำขอลงทะเบียนที่รออนุมัติอยู่แล้ว",
      409,
      "REGISTRATION_ALREADY_PENDING",
    )
  }

  const passwordHash = await bcrypt.hash(params.password, 10)

  const registration = await prisma.employeeRegistrationRequest.create({
    data: {
      tenantId: tenant.id,
      branchId: params.branchId,
      code,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      position: params.position,
      email: params.email,
      passwordHash,
      employeeType: params.employeeType,
      payType: params.payType,
      workShift: params.workShift,
      dayOffWeekdays: params.dayOffWeekdays,
      bankName: params.bankName,
      accountName: params.accountName,
      accountNumber: params.accountNumber,
      promptPayId: params.promptPayId,
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
      position: true,
      email: true,
      workShift: true,
      dayOffWeekdays: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      promptPayId: true,
      status: true,
      createdAt: true,
    },
  })

  await createAuditLog({
    tenantId: tenant.id,
    userId: null,
    action: "employee.registration_requested",
    entityType: "EmployeeRegistrationRequest",
    entityId: registration.id,
    metadata: {
      code: registration.code,
      email: registration.email,
      position: registration.position,
      tenantName: tenant.name,
    },
  })

  return registration
}

export async function listEmployeeRegistrationRequests(tenantId: string) {
  return prisma.employeeRegistrationRequest.findMany({
    where: {
      tenantId,
      status: "PENDING",
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      branch: {
        select: {
          id: true,
          name: true,
        },
      },
      phone: true,
      position: true,
      email: true,
      employeeType: true,
      payType: true,
      workShift: true,
      dayOffWeekdays: true,
      bankName: true,
      accountName: true,
      accountNumber: true,
      promptPayId: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  })
}

export async function reviewEmployeeRegistrationRequest(params: {
  tenantId: string
  requestId: string
  reviewedByUserId: string
  decision: EmployeeRegistrationStatus
  reviewNote: string | null
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid decision", 400, "INVALID_INPUT")
  }

  const request = await prisma.employeeRegistrationRequest.findFirst({
    where: {
      id: params.requestId,
      tenantId: params.tenantId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอลงทะเบียนนี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError(
      "คำขอนี้ถูกตรวจสอบไปแล้ว",
      409,
      "REGISTRATION_ALREADY_REVIEWED",
    )
  }

  if (params.decision === "REJECTED" && !params.reviewNote) {
    throw new AppError(
      "กรุณากรอกหมายเหตุเมื่อไม่อนุมัติ",
      400,
      "REVIEW_NOTE_REQUIRED",
    )
  }

  if (params.decision === "REJECTED") {
    const rejected = await prisma.employeeRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "REJECTED",
        reviewNote: params.reviewNote,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
    })

    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.reviewedByUserId,
      action: "employee.registration_rejected",
      entityType: "EmployeeRegistrationRequest",
      entityId: rejected.id,
      metadata: {
        code: rejected.code,
        email: rejected.email,
        reviewNote: rejected.reviewNote,
      },
    })

    return rejected
  }

  const [existingUser, existingEmployee] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: request.email,
      },
      select: {
        id: true,
      },
    }),
    prisma.employee.findUnique({
      where: {
        tenantId_code: {
          tenantId: params.tenantId,
          code: request.code,
        },
      },
      select: {
        id: true,
      },
    }),
  ])

  if (existingUser) {
    throw new AppError(
      "บัญชีนี้มีผู้ใช้แล้ว โปรดติดต่อเจ้าของร้าน",
      409,
      "EMAIL_ALREADY_EXISTS",
    )
  }

  if (existingEmployee) {
    request.code = await generateNextEmployeeCode(params.tenantId)
  }

  return prisma.$transaction(async (tx) => {
    await assertCanAddActiveEmployee(params.tenantId, tx)

    const user = await tx.user.create({
      data: {
        tenantId: params.tenantId,
        email: request.email,
        passwordHash: request.passwordHash,
        role: "EMPLOYEE",
      },
      select: {
        id: true,
      },
    })

    const employee = await tx.employee.create({
      data: {
        tenantId: params.tenantId,
        branchId: request.branchId,
        userId: user.id,
        code: request.code,
        firstName: request.firstName,
        lastName: request.lastName,
        phone: request.phone,
        position: request.position,
        employeeType: request.employeeType,
        payType: request.payType,
        workShift: request.workShift,
        dayOffWeekdays: request.dayOffWeekdays,
        startDate: new Date(),
        active: true,
        ...(request.bankName && request.accountName && request.accountNumber
          ? {
              bank: {
                create: {
                  bankName: request.bankName,
                  accountName: request.accountName,
                  accountNumber: request.accountNumber,
                  promptPayId: request.promptPayId,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    })

    const approved = await tx.employeeRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        code: request.code,
        status: "APPROVED",
        reviewNote: params.reviewNote,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.reviewedByUserId,
        action: "employee.registration_approved",
        entityType: "EmployeeRegistrationRequest",
        entityId: approved.id,
        metadata: {
          code: approved.code,
          email: approved.email,
          employeeId: employee.id,
          branchId: request.branchId,
          workShift: request.workShift,
          dayOffWeekdays: request.dayOffWeekdays,
        },
      },
    })

    return approved
  })
}
