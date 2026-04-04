import { createAttendanceCorrection, getAttendanceCorrectionList } from "@/lib/attendance-correction"
import { jsonResponse, readJsonBody, AppError } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  asAttendanceStatus,
  asAction,
  asOptionalBusinessDate,
  asOptionalSearchString,
  asTrimmedString,
} from "@/lib/validators"

type AttendanceCorrectionBody = {
  attendanceId?: unknown
  requestedCheckIn?: unknown
  requestedCheckOut?: unknown
  requestedStatus?: unknown
  requestedWorkDate?: unknown
  reason?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const search = asOptionalSearchString(searchParams.get("search"))
    const statusParam = asOptionalSearchString(searchParams.get("status"))
    const status =
      statusParam === undefined
        ? undefined
        : (asAction(statusParam, ["PENDING", "APPROVED", "REJECTED"]) as
            | "PENDING"
            | "APPROVED"
            | "REJECTED")

    const items = await getAttendanceCorrectionList(access.user.tenantId, {
      search,
      status,
    })
    return jsonResponse({ items })
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceManage,
  },
  async (req, _context, access) => {
    const body = await readJsonBody<AttendanceCorrectionBody>(req)
    const attendanceId = asTrimmedString(body.attendanceId, "attendanceId")
    const reason = asTrimmedString(body.reason, "reason")
    const requestedCheckIn = asOptionalBusinessDate(body.requestedCheckIn)
    const requestedCheckOut = asOptionalBusinessDate(body.requestedCheckOut)
    const requestedWorkDate = asOptionalBusinessDate(body.requestedWorkDate)
    const requestedStatus =
      body.requestedStatus === undefined || body.requestedStatus === null || body.requestedStatus === ""
        ? undefined
        : asAttendanceStatus(body.requestedStatus)

    if (
      !requestedCheckIn &&
      !requestedCheckOut &&
      !requestedWorkDate &&
      requestedStatus === undefined
    ) {
      throw new AppError(
        "At least one correction field must be provided",
        400,
        "INVALID_INPUT",
      )
    }

    if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) {
      throw new AppError(
        "requestedCheckOut must be after requestedCheckIn",
        400,
        "INVALID_INPUT",
      )
    }

    const correction = await createAttendanceCorrection({
      tenantId: access.user.tenantId,
      attendanceId,
      requestedByUserId: access.user.id,
      requestedCheckIn,
      requestedCheckOut,
      requestedStatus,
      requestedWorkDate,
      reason,
    })

    return jsonResponse(correction, 201)
  },
)
