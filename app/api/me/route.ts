import { jsonResponse } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute({}, async (_req, _context, access) => {
    return jsonResponse({
      ...access.user,
      subscription: access.subscription,
    })
})
