import { reviewAttendanceCorrection } from "@/lib/attendance-correction"
import { jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { asAction, asOptionalTrimmedString } from "@/lib/validators"

type ReviewCorrectionBody = {
  decision?: unknown
  reviewNote?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceApprove,
  },
  async (req, context: { params: Promise<{ id: string }> }, access) => {
    const body = await readJsonBody<ReviewCorrectionBody>(req)
    const { id } = await context.params
    const decision = asAction(body.decision, ["APPROVED", "REJECTED"]) as
      | "APPROVED"
      | "REJECTED"
    const reviewNote = asOptionalTrimmedString(body.reviewNote)

    const correction = await reviewAttendanceCorrection({
      tenantId: access.user.tenantId,
      correctionId: id,
      reviewedByUserId: access.user.id,
      decision,
      reviewNote,
    })

    return jsonResponse(correction)
  },
)
