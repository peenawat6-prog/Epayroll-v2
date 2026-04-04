import { jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { listStaffRequests, submitStaffRequest } from "@/lib/staff-requests"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.staffRequestSubmit,
  },
  async (_req, _context, access) => {
    return jsonResponse(await listStaffRequests(access.user.tenantId))
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.staffRequestSubmit,
  },
  async (req, _context, access) => {
    return jsonResponse(
      await submitStaffRequest({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        body: await readJsonBody(req),
      }),
      201,
    )
  },
)
