import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { reviewSalesAgentRegistrationRequest } from "@/lib/sales-agents"
import { asAction, asOptionalTrimmedString } from "@/lib/validators"

type SalesRequestReviewBody = {
  decision?: unknown
  reviewNote?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req, context, access) => {
    const { id } = await context.params!
    const body = await readJsonBody<SalesRequestReviewBody>(req)
    const decision = asAction(body.decision, ["APPROVED", "REJECTED"]) as
      | "APPROVED"
      | "REJECTED"
    const reviewNote = asOptionalTrimmedString(body.reviewNote)

    if (decision === "REJECTED" && !reviewNote) {
      throw new AppError(
        "กรุณากรอกเหตุผลถ้าไม่อนุมัติเซลล์นี้",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    const reviewedRequest = await reviewSalesAgentRegistrationRequest({
      requestId: id,
      reviewedByUserId: access.user.id,
      decision,
      reviewNote,
    })

    return jsonResponse({
      ok: true,
      request: reviewedRequest,
    })
  },
)
