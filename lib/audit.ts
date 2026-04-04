import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type AuditInput = {
  tenantId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

type AuditListFilters = {
  limit?: number
  entityType?: string
  action?: string
  userId?: string
  search?: string
}

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function getAuditLogList(
  tenantId: string,
  filters: AuditListFilters = {},
) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const entityType = filters.entityType?.trim() || undefined
  const action = filters.action?.trim() || undefined
  const userId = filters.userId?.trim() || undefined
  const search = filters.search?.trim() || undefined

  return prisma.auditLog.findMany({
    where: {
      tenantId,
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(search
        ? {
            OR: [
              {
                action: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                entityType: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                entityId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  })
}
