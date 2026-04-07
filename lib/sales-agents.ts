import type { SalesAgentRegistrationStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"

function normalizeSalesCode(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase()
}

async function generateUniqueSalesAgentCode(firstName: string, lastName: string) {
  const prefix = normalizeSalesCode(`${firstName}${lastName}`) || "SALE"

  for (let index = 0; index < 12; index += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
    const code = `${prefix}-${suffix}`
    const existingAgent = await prisma.salesAgent.findUnique({
      where: { code },
      select: { id: true },
    })

    if (!existingAgent) {
      return code
    }
  }

  throw new AppError(
    "ไม่สามารถสร้างรหัสเซลล์ได้ กรุณาลองใหม่อีกครั้ง",
    500,
    "SALES_AGENT_CODE_GENERATION_FAILED",
  )
}

export async function submitSalesAgentRegistrationRequest(params: {
  firstName: string
  lastName: string
  phone: string | null
  email: string
  lineId: string | null
}) {
  const [existingAgent, pendingRequest] = await Promise.all([
    prisma.salesAgent.findUnique({
      where: { email: params.email },
      select: { id: true },
    }),
    prisma.salesAgentRegistrationRequest.findFirst({
      where: {
        email: params.email,
        status: "PENDING",
      },
      select: { id: true },
    }),
  ])

  if (existingAgent) {
    throw new AppError("อีเมลนี้มีบัญชีเซลล์อยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  if (pendingRequest) {
    throw new AppError(
      "มีคำขอลงทะเบียนเซลล์ที่รออนุมัติอยู่แล้ว",
      409,
      "SALES_AGENT_REQUEST_ALREADY_PENDING",
    )
  }

  return prisma.salesAgentRegistrationRequest.create({
    data: {
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      email: params.email,
      lineId: params.lineId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
    },
  })
}

export async function createSalesAgentByDev(params: {
  firstName: string
  lastName: string
  phone: string | null
  email: string
  lineId: string | null
}) {
  const existingAgent = await prisma.salesAgent.findUnique({
    where: {
      email: params.email,
    },
    select: {
      id: true,
    },
  })

  if (existingAgent) {
    throw new AppError("อีเมลนี้มีบัญชีเซลล์อยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  const code = await generateUniqueSalesAgentCode(
    params.firstName,
    params.lastName,
  )

  return prisma.salesAgent.create({
    data: {
      code,
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      email: params.email,
      lineId: params.lineId,
      active: true,
      commissionPerShopBaht: 50,
    },
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      lineId: true,
      commissionPerShopBaht: true,
      createdAt: true,
      _count: {
        select: {
          tenants: true,
        },
      },
    },
  })
}

export async function listPublicSalesAgents() {
  return prisma.salesAgent.findMany({
    where: {
      active: true,
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
    take: 200,
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
    },
  })
}

export async function listDevSalesAgentRegistrationRequests() {
  return prisma.salesAgentRegistrationRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      lineId: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
    },
  })
}

export async function listDevSalesAgentsWithCommission(params: {
  month: number
  year: number
}) {
  const monthStart = new Date(params.year, params.month - 1, 1, 0, 0, 0, 0)
  const nextMonthStart = new Date(params.year, params.month, 1, 0, 0, 0, 0)

  const salesAgents = await prisma.salesAgent.findMany({
    where: {
      active: true,
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      lineId: true,
      commissionPerShopBaht: true,
      createdAt: true,
      tenants: {
        where: {
          createdAt: {
            lt: nextMonthStart,
          },
          subscriptionExpiresAt: {
            gte: monthStart,
          },
        },
        select: {
          id: true,
          name: true,
          registrationCode: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      _count: {
        select: {
          tenants: true,
        },
      },
    },
  })

  return salesAgents.map((agent) => {
    const commissionShopCount = agent.tenants.length

    return {
      ...agent,
      commissionMonth: params.month,
      commissionYear: params.year,
      commissionShopCount,
      commissionAmountBaht: commissionShopCount * agent.commissionPerShopBaht,
    }
  })
}

export async function reviewSalesAgentRegistrationRequest(params: {
  requestId: string
  reviewedByUserId: string
  decision: SalesAgentRegistrationStatus
  reviewNote: string | null
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid decision", 400, "INVALID_INPUT")
  }

  const request = await prisma.salesAgentRegistrationRequest.findUnique({
    where: {
      id: params.requestId,
    },
  })

  if (!request) {
    throw new AppError("ไม่พบคำขอลงทะเบียนเซลล์นี้", 404, "NOT_FOUND")
  }

  if (request.status !== "PENDING") {
    throw new AppError(
      "คำขอลงทะเบียนเซลล์นี้ถูกตรวจสอบไปแล้ว",
      409,
      "SALES_AGENT_REQUEST_ALREADY_REVIEWED",
    )
  }

  if (params.decision === "REJECTED") {
    if (!params.reviewNote) {
      throw new AppError(
        "กรุณากรอกหมายเหตุเมื่อไม่อนุมัติเซลล์",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    return prisma.salesAgentRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "REJECTED",
        reviewNote: params.reviewNote,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
      },
    })
  }

  const existingAgent = await prisma.salesAgent.findUnique({
    where: {
      email: request.email,
    },
    select: {
      id: true,
    },
  })

  if (existingAgent) {
    throw new AppError("อีเมลนี้มีบัญชีเซลล์อยู่แล้ว", 409, "EMAIL_ALREADY_EXISTS")
  }

  const code = await generateUniqueSalesAgentCode(
    request.firstName,
    request.lastName,
  )

  return prisma.$transaction(async (tx) => {
    await tx.salesAgent.create({
      data: {
        code,
        firstName: request.firstName,
        lastName: request.lastName,
        phone: request.phone,
        email: request.email,
        lineId: request.lineId,
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })

    return tx.salesAgentRegistrationRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "APPROVED",
        reviewNote: params.reviewNote,
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
      },
    })
  })
}
