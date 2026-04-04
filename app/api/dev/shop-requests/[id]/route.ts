import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { reviewShopRegistrationRequest } from "@/lib/shop-registration"
import {
  asAction,
  asOptionalTrimmedString,
  asPositiveDays,
} from "@/lib/validators"

type ShopRequestReviewBody = {
  decision?: unknown
  reviewNote?: unknown
  subscriptionDays?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req, context, access) => {
    const { id } = await context.params!
    const body = await readJsonBody<ShopRequestReviewBody>(req)
    const decision = asAction(body.decision, ["APPROVED", "REJECTED"]) as
      | "APPROVED"
      | "REJECTED"
    const reviewNote = asOptionalTrimmedString(body.reviewNote)
    const subscriptionDays = asPositiveDays(
      body.subscriptionDays ?? 365,
      "subscriptionDays",
    )

    if (decision === "REJECTED" && !reviewNote) {
      throw new AppError(
        "กรุณากรอกเหตุผลถ้าไม่อนุมัติร้านนี้",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    const reviewedRequest = await reviewShopRegistrationRequest({
      requestId: id,
      reviewedByUserId: access.user.id,
      decision,
      reviewNote,
      subscriptionDays,
    })

    return jsonResponse({
      ok: true,
      request: reviewedRequest,
    })
  },
)
