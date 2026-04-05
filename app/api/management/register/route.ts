import { jsonResponse, readJsonBody } from "@/lib/http"
import { handleApiError } from "@/lib/http"
import { submitManagementRegistrationRequest } from "@/lib/management-registration"
import {
  asEmail,
  asManagementRegistrationRole,
  asOptionalTrimmedString,
  asPassword,
  asTrimmedString,
} from "@/lib/validators"

type RegisterBody = {
  registrationCode?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  password?: unknown
  requestedRole?: unknown
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<RegisterBody>(req)

    const registration = await submitManagementRegistrationRequest({
      registrationCode: asTrimmedString(body.registrationCode, "registrationCode"),
      firstName: asTrimmedString(body.firstName, "firstName"),
      lastName: asTrimmedString(body.lastName, "lastName"),
      phone: asOptionalTrimmedString(body.phone),
      email: asEmail(body.email, "email"),
      password: asPassword(body.password),
      requestedRole: asManagementRegistrationRole(body.requestedRole),
    })

    return jsonResponse(
      {
        ok: true,
        registration,
        message: "ส่งคำขอลงทะเบียนสิทธิ์บริหารแล้ว กรุณารอทีมซัพพอร์ตอนุมัติ",
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}
