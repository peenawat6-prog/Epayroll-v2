import { jsonResponse, readJsonBody } from "@/lib/http"
import { handleApiError } from "@/lib/http"
import { submitEmployeeRegistrationRequest } from "@/lib/employee-registration"
import {
  asEmail,
  asEmployeeType,
  asOptionalTrimmedString,
  asPassword,
  asPayType,
  asTrimmedString,
} from "@/lib/validators"

type RegisterBody = {
  registrationCode?: unknown
  code?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  position?: unknown
  email?: unknown
  password?: unknown
  employeeType?: unknown
  payType?: unknown
  bankName?: unknown
  accountName?: unknown
  accountNumber?: unknown
  promptPayId?: unknown
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<RegisterBody>(req)

    const registration = await submitEmployeeRegistrationRequest({
      registrationCode: asTrimmedString(body.registrationCode, "registrationCode"),
      code: asTrimmedString(body.code, "code"),
      firstName: asTrimmedString(body.firstName, "firstName"),
      lastName: asTrimmedString(body.lastName, "lastName"),
      phone: asOptionalTrimmedString(body.phone),
      position: asTrimmedString(body.position, "position"),
      email: asEmail(body.email, "email"),
      password: asPassword(body.password),
      employeeType: asEmployeeType(body.employeeType),
      payType: asPayType(body.payType),
      bankName: asTrimmedString(body.bankName, "bankName"),
      accountName: asTrimmedString(body.accountName, "accountName"),
      accountNumber: asTrimmedString(body.accountNumber, "accountNumber"),
      promptPayId: asOptionalTrimmedString(body.promptPayId),
    })

    return jsonResponse(
      {
        ok: true,
        registration,
        message: "ส่งคำขอลงทะเบียนแล้ว กรุณารอหัวหน้าอนุมัติ",
      },
      201,
    )
  } catch (error) {
    return handleApiError(error)
  }
}
