import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { reviewManagementRegistrationRequest } from "@/lib/management-registration"
import { asAction, asOptionalTrimmedString } from "@/lib/validators"

type ManagementRequestReviewBody = {
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
    const body = await readJsonBody<ManagementRequestReviewBody>(req)
    const decision = asAction(body.decision, ["APPROVED", "REJECTED"]) as
      | "APPROVED"
      | "REJECTED"
    const reviewNote = asOptionalTrimmedString(body.reviewNote)

    if (decision === "REJECTED" && !reviewNote) {
      throw new AppError(
        "กรุณากรอกเหตุผลถ้าไม่อนุมัติคำขอนี้",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    const reviewedRequest = await reviewManagementRegistrationRequest({
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
