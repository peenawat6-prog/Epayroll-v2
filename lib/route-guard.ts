import type { UserRole } from "@prisma/client"
import { authorizeRequest, type AuthorizedAccess } from "@/lib/access"
import { handleApiError } from "@/lib/http"

type RouteOptions = {
  roles?: readonly UserRole[]
  requireSubscription?: boolean
}

type RouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>
}

type AuthorizedRouteHandler<TContext extends RouteContext> = (
  req: Request,
  context: TContext,
  access: AuthorizedAccess,
) => Promise<Response>

export function withAuthorizedRoute<TContext extends RouteContext = RouteContext>(
  options: RouteOptions,
  handler: AuthorizedRouteHandler<TContext>,
) {
  return async (req: Request, context: TContext) => {
    try {
      const access = await authorizeRequest(options)
      return await handler(req, context, access)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
