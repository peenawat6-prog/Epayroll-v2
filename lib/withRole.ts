import type { UserRole } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSessionUser, type SessionUser } from "@/lib/auth"
import { hasAnyRole } from "@/lib/role"

type AppRouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>
}

type RoleProtectedHandler<TContext extends AppRouteContext> = (
  req: NextRequest,
  context: TContext,
  user: SessionUser,
) => Promise<Response>

export function withRole<TContext extends AppRouteContext>(
  handler: RoleProtectedHandler<TContext>,
  allowedRoles: UserRole | UserRole[],
) {
  const normalizedAllowedRoles = Array.isArray(allowedRoles)
    ? allowedRoles
    : [allowedRoles]

  return async (req: NextRequest, context: TContext) => {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!hasAnyRole(user.role, normalizedAllowedRoles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return handler(req, context, user)
  }
}
