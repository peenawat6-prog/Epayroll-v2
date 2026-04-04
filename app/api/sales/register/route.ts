import { handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { submitSalesAgentRegistrationRequest } from "@/lib/sales-agents"
import {
  asEmail,
  asOptionalTrimmedString,
  asTrimmedString,
} from "@/lib/validators"

type SalesRegisterBody = {
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  lineId?: unknown
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<SalesRegisterBody>(req)
    const firstName = asTrimmedString(body.firstName, "firstName")
    const lastName = asTrimmedString(body.lastName, "lastName")
    const phone = asOptionalTrimmedString(body.phone)
    const email = asEmail(body.email, "email")
    const lineId = asOptionalTrimmedString(body.lineId)

    const request = await submitSalesAgentRegistrationRequest({
      firstName,
      lastName,
      phone,
      email,
      lineId,
    })

    return jsonResponse(
      {
        ok: true,
        request,
        message:
          "ส่งคำขอลงทะเบียนเซลล์เรียบร้อยแล้ว กรุณารอทีมซัพพอร์ตอนุมัติ",
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}
