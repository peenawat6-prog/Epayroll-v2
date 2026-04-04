import type { UserRole } from "@prisma/client"
import { getSessionUser, type SessionUser } from "@/lib/auth"
import { AppError } from "@/lib/http"
import { hasAnyRole } from "@/lib/role"
import {
  getTenantSubscription,
  type TenantSubscription,
} from "@/lib/subscription"

type AccessOptions = {
  roles?: readonly UserRole[]
  requireSubscription?: boolean
}

export type AuthorizedAccess = {
  user: SessionUser
  subscription: TenantSubscription
}

export async function authorizeRequest(
  options: AccessOptions = {},
): Promise<AuthorizedAccess> {
  const user = await getSessionUser()

  if (!user) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED")
  }

  if (options.roles && !hasAnyRole(user.role, options.roles)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN")
  }

  const subscription = await getTenantSubscription(user.tenantId)

  if (options.requireSubscription !== false && !subscription.isActive) {
    throw new AppError("Subscription expired", 402, "SUBSCRIPTION_EXPIRED", {
      plan: subscription.plan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
    })
  }

  return {
    user,
    subscription,
  }
}

export async function getTenantAccess() {
  try {
    const access = await authorizeRequest()

    return {
      ok: true as const,
      ...access,
    }
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false as const,
        status: error.status,
        error: error.message,
        details: error.details,
      }
    }

    throw error
  }
}
