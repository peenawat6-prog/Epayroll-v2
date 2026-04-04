import { reviewEmployeeRegistrationRequest } from "@/lib/employee-registration"
import { jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { asAction, asOptionalTrimmedString } from "@/lib/validators"

type ReviewBody = {
  decision?: unknown
  reviewNote?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.employeeManage,
  },
  async (req, context: { params: Promise<{ id: string }> }, access) => {
    const { id } = await context.params
    const body = await readJsonBody<ReviewBody>(req)
    const decision = asAction(body.decision, ["APPROVED", "REJECTED"]) as
      | "APPROVED"
      | "REJECTED"

    const reviewed = await reviewEmployeeRegistrationRequest({
      tenantId: access.user.tenantId,
      requestId: id,
      reviewedByUserId: access.user.id,
      decision,
      reviewNote: asOptionalTrimmedString(body.reviewNote),
    })

    return jsonResponse(reviewed)
  },
)
