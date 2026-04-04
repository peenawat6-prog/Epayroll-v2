import bcrypt from "bcrypt"
import type { ShopRegistrationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { createAuditLog } from "@/lib/audit"

function normalizeCodeSource(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase()
}

async function generateUniqueRegistrationCode(shopName: string) {
  const prefix = normalizeCodeSource(shopName) || "SHOP"

  for (let index = 0; index < 12; index += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
    const registrationCode = `${prefix}-${suffix}`
    const existingTenant = await prisma.tenant.findUnique({
      where: {
        registrationCode,
      },
      select: {
        id: true,
      },
    })

    if (!existingTenant) {
      return registrationCode
    }
  }

  throw new AppError(
    "ไม่สามารถสร้างรหัสร้านได้ กรุณาลองใหม่อีกครั้ง",
    500,
    "REGISTRATION_CODE_GENERATION_FAILED",
  )
}

export async function registerShopAndOwner(params: {
  shopName: string
  ownerFirstName: string
  ownerLastName: string
  ownerPhone: string | null
  ownerEmail: string
  ownerPassword: string
  branchName: string
  payrollPayday: number
  morningShiftStartMinutes: number
  morningShiftEndMinutes: number
  afternoonShiftStartMinutes: number
  afternoonShiftEndMinutes: number
  nightShiftStartMinutes: number
  nightShiftEndMinutes: number
  latitude: number
  longitude: number
  allowedRadiusMeters: number
}) {
  const [existingUser, existingTenant] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: params.ownerEmail,
      },
      select: {
        id: true,
      },
    }),
    prisma.tenant.findFirst({
      where: {
        name: {
          equals: params.shopName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),
  ])

  if (existingUser) {
    throw new AppError("อีเมลนี้มีบัญชีอยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  if (existingTenant) {
    throw new AppError("มีร้านชื่อนี้อยู่ในระบบแล้ว", 409, "SHOP_ALREADY_EXISTS")
  }

  const [registrationCode, passwordHash] = await Promise.all([
    generateUniqueRegistrationCode(params.shopName),
    bcrypt.hash(params.ownerPassword, 10),
  ])
  const subscriptionExpiresAt = new Date()
  subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + 365)

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: params.shopName,
        registrationCode,
        subscriptionPlan: "starter",
        subscriptionStatus: "TRIAL",
        subscriptionExpiresAt,
        payrollPayday: params.payrollPayday,
        workStartMinutes: params.morningShiftStartMinutes,
        workEndMinutes: params.morningShiftEndMinutes,
        morningShiftStartMinutes: params.morningShiftStartMinutes,
        morningShiftEndMinutes: params.morningShiftEndMinutes,
        afternoonShiftStartMinutes: params.afternoonShiftStartMinutes,
        afternoonShiftEndMinutes: params.afternoonShiftEndMinutes,
        nightShiftStartMinutes: params.nightShiftStartMinutes,
        nightShiftEndMinutes: params.nightShiftEndMinutes,
        latitude: params.latitude,
        longitude: params.longitude,
        allowedRadiusMeters: params.allowedRadiusMeters,
      },
      select: {
        id: true,
        name: true,
        registrationCode: true,
        latitude: true,
        longitude: true,
      },
    })

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: params.ownerEmail,
        passwordHash,
        role: "OWNER",
      },
      select: {
        id: true,
        email: true,
      },
    })

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: params.branchName,
        latitude: params.latitude,
        longitude: params.longitude,
        allowedRadiusMeters: params.allowedRadiusMeters,
      },
      select: {
        id: true,
        name: true,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        action: "shop.registered",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: {
          shopName: tenant.name,
          branchId: branch.id,
          branchName: branch.name,
          ownerName: `${params.ownerFirstName} ${params.ownerLastName}`,
          ownerPhone: params.ownerPhone,
          ownerEmail: owner.email,
          registrationCode: tenant.registrationCode,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
        },
      },
    })

    return {
      tenant,
      owner,
      branch,
    }
  })

  await createAuditLog({
    tenantId: result.tenant.id,
    userId: result.owner.id,
    action: "shop.owner_created",
    entityType: "User",
    entityId: result.owner.id,
    metadata: {
      email: result.owner.email,
      role: "OWNER",
    },
  })

  return result
}

export async function submitShopRegistrationRequest(params: {
  shopName: string
  branchName: string
  ownerFirstName: string
  ownerLastName: string
  ownerPhone: string | null
  ownerEmail: string
  ownerPassword: string
  payrollPayday: number
  morningShiftStartMinutes: number
  morningShiftEndMinutes: number
  afternoonShiftStartMinutes: number
  afternoonShiftEndMinutes: number
  nightShiftStartMinutes: number
  nightShiftEndMinutes: number
  latitude: number
  longitude: number
  allowedRadiusMeters: number
  salesAgentId: string | null
}) {
  const [existingUser, existingTenant, pendingRequest, salesAgent] =
    await Promise.all([
    prisma.user.findUnique({
      where: {
        email: params.ownerEmail,
      },
      select: {
        id: true,
      },
    }),
    prisma.tenant.findFirst({
      where: {
        name: {
          equals: params.shopName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.shopRegistrationRequest.findFirst({
      where: {
        ownerEmail: params.ownerEmail,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    }),
    params.salesAgentId
      ? prisma.salesAgent.findFirst({
          where: {
            id: params.salesAgentId,
            active: true,
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve(null),
  ])

  if (existingUser) {
    throw new AppError("อีเมลนี้มีบัญชีอยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  if (existingTenant) {
    throw new AppError("มีร้านชื่อนี้อยู่ในระบบแล้ว", 409, "SHOP_ALREADY_EXISTS")
  }

  if (pendingRequest) {
    throw new AppError(
      "มีคำขอเปิดร้านที่รออนุมัติอยู่แล้ว",
      409,
      "SHOP_REQUEST_ALREADY_PENDING",
    )
  }

  if (params.salesAgentId && !salesAgent) {
    throw new AppError("ไม่พบเซลล์ที่เลือกไว้", 404, "SALES_AGENT_NOT_FOUND")
  }

  const ownerPasswordHash = await bcrypt.hash(params.ownerPassword, 10)

  return prisma.shopRegistrationRequest.create({
    data: {
      shopName: params.shopName,
      branchName: params.branchName,
      ownerFirstName: params.ownerFirstName,
      ownerLastName: params.ownerLastName,
      ownerPhone: params.ownerPhone,
      ownerEmail: params.ownerEmail,
      ownerPasswordHash,
      payrollPayday: params.payrollPayday,
      morningShiftStartMinutes: params.morningShiftStartMinutes,
      morningShiftEndMinutes: params.morningShiftEndMinutes,
      afternoonShiftStartMinutes: params.afternoonShiftStartMinutes,
      afternoonShiftEndMinutes: params.afternoonShiftEndMinutes,
      nightShiftStartMinutes: params.nightShiftStartMinutes,
      nightShiftEndMinutes: params.nightShiftEndMinutes,
      latitude: params.latitude,
      longitude: params.longitude,
      allowedRadiusMeters: params.allowedRadiusMeters,
      salesAgentId: params.salesAgentId,
    },
    select: {
      id: true,
      shopName: true,
      ownerEmail: true,
      status: true,
      createdAt: true,
      salesAgentId: true,
    },
  })
}

export async function listDevShopRegistrationRequests() {
  return prisma.shopRegistrationRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    select: {
      id: true,
      tenantId: true,
      shopName: true,
      branchName: true,
      ownerFirstName: true,
      ownerLastName: true,
      ownerPhone: true,
      ownerEmail: true,
      registrationCode: true,
      payrollPayday: true,
      morningShiftStartMinutes: true,
      morningShiftEndMinutes: true,
      afternoonShiftStartMinutes: true,
      afternoonShiftEndMinutes: true,
      nightShiftStartMinutes: true,
      nightShiftEndMinutes: true,
      latitude: true,
      longitude: true,
      allowedRadiusMeters: true,
      requestedSubscriptionDays: true,
      salesAgentId: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          registrationCode: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
          salesAgent: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      salesAgent: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })
}

export async function reviewShopRegistrationRequest(params: {
  requestId: string
  reviewedByUserId: string
  decision: ShopRegistrationStatus
  reviewNote: string | null
  subscriptionDays: number
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid decision", 400, "INVALID_INPUT")
  }

  const request = await prisma.shopRegistrationRequest.findUnique({
    where: {
      id: params.requestId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอเปิดร้านนี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError(
      "คำขอเปิดร้านนี้ถูกตรวจสอบไปแล้ว",
      409,
      "SHOP_REQUEST_ALREADY_REVIEWED",
    )
  }

  if (params.decision === "REJECTED") {
    if (!params.reviewNote) {
      throw new AppError(
        "กรุณากรอกหมายเหตุเมื่อไม่อนุมัติ",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    return prisma.shopRegistrationRequest.update({
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
  }

  const [existingUser, existingTenant] = await Promise.all([
    prisma.user.findUnique({
      where: {
        email: request.ownerEmail,
      },
      select: {
        id: true,
      },
    }),
    prisma.tenant.findFirst({
      where: {
        name: {
          equals: request.shopName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    }),
  ])

  if (existingUser) {
    throw new AppError("อีเมลนี้มีบัญชีอยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  if (existingTenant) {
    throw new AppError("มีร้านชื่อนี้อยู่ในระบบแล้ว", 409, "SHOP_ALREADY_EXISTS")
  }

  const registrationCode = await generateUniqueRegistrationCode(request.shopName)
  const subscriptionExpiresAt = new Date()
  subscriptionExpiresAt.setDate(
    subscriptionExpiresAt.getDate() + params.subscriptionDays,
  )

  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: request.shopName,
        registrationCode,
        salesAgentId: request.salesAgentId,
        subscriptionPlan: "starter",
        subscriptionStatus: "TRIAL",
        subscriptionExpiresAt,
        payrollPayday: request.payrollPayday,
        workStartMinutes: request.morningShiftStartMinutes,
        workEndMinutes: request.morningShiftEndMinutes,
        morningShiftStartMinutes: request.morningShiftStartMinutes,
        morningShiftEndMinutes: request.morningShiftEndMinutes,
        afternoonShiftStartMinutes: request.afternoonShiftStartMinutes,
        afternoonShiftEndMinutes: request.afternoonShiftEndMinutes,
        nightShiftStartMinutes: request.nightShiftStartMinutes,
        nightShiftEndMinutes: request.nightShiftEndMinutes,
        latitude: request.latitude,
        longitude: request.longitude,
        allowedRadiusMeters: request.allowedRadiusMeters,
      },
      select: {
        id: true,
        name: true,
        registrationCode: true,
        subscriptionExpiresAt: true,
      },
    })

    const owner = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: request.ownerEmail,
        passwordHash: request.ownerPasswordHash,
        role: "OWNER",
      },
      select: {
        id: true,
        email: true,
      },
    })

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: request.branchName,
        latitude: request.latitude,
        longitude: request.longitude,
        allowedRadiusMeters: request.allowedRadiusMeters,
      },
      select: {
        id: true,
        name: true,
      },
    })

    const approved = await tx.shopRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        tenantId: tenant.id,
        status: "APPROVED",
        reviewNote: params.reviewNote,
        registrationCode: tenant.registrationCode,
        requestedSubscriptionDays: params.subscriptionDays,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: params.reviewedByUserId,
        action: "shop.registration_approved",
        entityType: "ShopRegistrationRequest",
        entityId: approved.id,
        metadata: {
          shopName: tenant.name,
          branchId: branch.id,
          branchName: branch.name,
          ownerEmail: owner.email,
          registrationCode: tenant.registrationCode,
          subscriptionExpiresAt: tenant.subscriptionExpiresAt,
          subscriptionDays: params.subscriptionDays,
          salesAgentId: request.salesAgentId,
        },
      },
    })

    return approved
  })
}

export async function listDevTenants() {
  return prisma.tenant.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    select: {
      id: true,
      name: true,
      registrationCode: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      isPubliclyVisible: true,
      createdAt: true,
      salesAgent: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          employees: true,
          branches: true,
        },
      },
    },
  })
}

export async function updateTenantPublicVisibility(params: {
  tenantId: string
  devUserId: string
  isPubliclyVisible: boolean
}) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: params.tenantId,
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!tenant) {
    throw new AppError("ไม่พบร้านค้านี้", 404, "NOT_FOUND")
  }

  const updatedTenant = await prisma.tenant.update({
    where: {
      id: params.tenantId,
    },
    data: {
      isPubliclyVisible: params.isPubliclyVisible,
    },
    select: {
      id: true,
      name: true,
      registrationCode: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      isPubliclyVisible: true,
      createdAt: true,
      salesAgent: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
        },
      },
      _count: {
        select: {
          employees: true,
          branches: true,
        },
      },
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.devUserId,
      action: params.isPubliclyVisible
        ? "tenant.public_search_enabled"
        : "tenant.public_search_hidden",
      entityType: "Tenant",
      entityId: params.tenantId,
      metadata: {
        shopName: tenant.name,
        isPubliclyVisible: params.isPubliclyVisible,
      },
    },
  })

  return updatedTenant
}

export async function extendTenantSubscription(params: {
  tenantId: string
  devUserId: string
  extraDays: number
}) {
  const tenant = await prisma.tenant.findUnique({
    where: {
      id: params.tenantId,
    },
    select: {
      id: true,
      subscriptionExpiresAt: true,
    },
  })

  if (!tenant) {
    throw new AppError("ไม่พบร้านค้านี้", 404, "NOT_FOUND")
  }

  const baseDate =
    tenant.subscriptionExpiresAt &&
    tenant.subscriptionExpiresAt.getTime() > Date.now()
      ? tenant.subscriptionExpiresAt
      : new Date()
  const subscriptionExpiresAt = new Date(baseDate)
  subscriptionExpiresAt.setDate(
    subscriptionExpiresAt.getDate() + params.extraDays,
  )

  const updatedTenant = await prisma.tenant.update({
    where: {
      id: params.tenantId,
    },
    data: {
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt,
    },
    select: {
      id: true,
      name: true,
      registrationCode: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.devUserId,
      action: "tenant.subscription_extended",
      entityType: "Tenant",
      entityId: params.tenantId,
      metadata: {
        extraDays: params.extraDays,
        subscriptionExpiresAt: updatedTenant.subscriptionExpiresAt,
      },
    },
  })

  return updatedTenant
}
