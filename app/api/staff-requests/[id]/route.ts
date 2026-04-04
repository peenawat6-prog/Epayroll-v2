import { jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { reviewStaffRequest } from "@/lib/staff-requests"

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.staffRequestReview,
  },
  async (req, context, access) => {
    const params = await context.params

    return jsonResponse(
      await reviewStaffRequest({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        requestId: params?.id ?? "",
        body: await readJsonBody(req),
      }),
    )
  },
)
