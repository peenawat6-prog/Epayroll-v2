import type { SubscriptionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type TenantSubscription = {
  plan: string
  status: SubscriptionStatus | "EXPIRED"
  expiresAt: Date | null
  isActive: boolean
  daysRemaining: number | null
}

export async function getTenantSubscription(
  tenantId: string,
): Promise<TenantSubscription> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  })

  if (!tenant) {
    return {
      plan: "starter",
      status: "EXPIRED",
      expiresAt: null,
      isActive: false,
      daysRemaining: null,
    }
  }

  const expiresAt = tenant.subscriptionExpiresAt
  const now = new Date()

  if (!expiresAt || expiresAt.getTime() < now.getTime()) {
    return {
      plan: tenant.subscriptionPlan,
      status: "EXPIRED",
      expiresAt,
      isActive: false,
      daysRemaining: expiresAt
        ? Math.max(
            0,
            Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : null,
    }
  }

  return {
    plan: tenant.subscriptionPlan,
    status: tenant.subscriptionStatus,
    expiresAt,
    isActive:
      tenant.subscriptionStatus === "ACTIVE" ||
      tenant.subscriptionStatus === "TRIAL",
    daysRemaining: Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    ),
  }
}

export async function isSubscriptionActive(tenantId: string): Promise<boolean> {
  const subscription = await getTenantSubscription(tenantId)
  return subscription.isActive
}
