import bcrypt from "bcrypt"
import type { ManagementRegistrationStatus, UserRole } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { createAuditLog } from "@/lib/audit"

export async function submitManagementRegistrationRequest(params: {
  registrationCode: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  password: string
  requestedRole: UserRole
}) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      registrationCode: params.registrationCode,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!tenant) {
    throw new AppError("ไม่พบร้านที่เลือก", 404, "TENANT_NOT_FOUND")
  }

  const [existingUser, existingPendingRequest] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: params.email,
      },
      select: {
        id: true,
      },
    }),
    prisma.managementRegistrationRequest.findFirst({
      where: {
        tenantId: tenant.id,
        email: params.email,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    }),
  ])

  if (existingUser) {
    throw new AppError(
      "บัญชีนี้มีผู้ใช้แล้ว โปรดติดต่อทีมซัพพอร์ต",
      409,
      "EMAIL_ALREADY_EXISTS",
    )
  }

  if (existingPendingRequest) {
    throw new AppError(
      "มีคำขอลงทะเบียนสิทธิ์นี้รออนุมัติอยู่แล้ว",
      409,
      "REGISTRATION_ALREADY_PENDING",
    )
  }

  const passwordHash = await bcrypt.hash(params.password, 10)

  const request = await prisma.managementRegistrationRequest.create({
    data: {
      tenantId: tenant.id,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      email: params.email,
      passwordHash,
      requestedRole: params.requestedRole,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      requestedRole: true,
      status: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  await createAuditLog({
    tenantId: tenant.id,
    userId: null,
    action: "management.registration_requested",
    entityType: "ManagementRegistrationRequest",
    entityId: request.id,
    metadata: {
      email: request.email,
      requestedRole: request.requestedRole,
      tenantName: tenant.name,
    },
  })

  return request
}

export async function listDevManagementRegistrationRequests() {
  return prisma.managementRegistrationRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    select: {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      requestedRole: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          registrationCode: true,
        },
      },
    },
  })
}

export async function reviewManagementRegistrationRequest(params: {
  requestId: string
  reviewedByUserId: string
  decision: ManagementRegistrationStatus
  reviewNote: string | null
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid decision", 400, "INVALID_INPUT")
  }

  const request = await prisma.managementRegistrationRequest.findUnique({
    where: {
      id: params.requestId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอลงทะเบียนนี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError("คำขอนี้ถูกตรวจสอบไปแล้ว", 409, "REQUEST_ALREADY_REVIEWED")
  }

  if (params.decision === "REJECTED") {
    if (!params.reviewNote) {
      throw new AppError(
        "กรุณากรอกหมายเหตุเมื่อไม่อนุมัติ",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    const rejected = await prisma.managementRegistrationRequest.update({
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
      tenantId: request.tenantId,
      userId: params.reviewedByUserId,
      action: "management.registration_rejected",
      entityType: "ManagementRegistrationRequest",
      entityId: rejected.id,
      metadata: {
        email: rejected.email,
        requestedRole: rejected.requestedRole,
        reviewNote: rejected.reviewNote,
      },
    })

    return rejected
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: request.email,
    },
    select: {
      id: true,
    },
  })

  if (existingUser) {
    throw new AppError(
      "บัญชีนี้มีผู้ใช้แล้ว โปรดติดต่อทีมซัพพอร์ต",
      409,
      "EMAIL_ALREADY_EXISTS",
    )
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId: request.tenantId,
        email: request.email,
        passwordHash: request.passwordHash,
        role: request.requestedRole,
      },
      select: {
        id: true,
      },
    })

    const approved = await tx.managementRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "APPROVED",
        reviewNote: params.reviewNote,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: params.reviewedByUserId,
        action: "management.registration_approved",
        entityType: "ManagementRegistrationRequest",
        entityId: approved.id,
        metadata: {
          email: approved.email,
          requestedRole: approved.requestedRole,
          userId: user.id,
        },
      },
    })

    return approved
  })
}
