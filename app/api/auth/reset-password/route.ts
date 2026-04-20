import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { resetPassword } from "@/lib/password-reset"
import { asPassword, asTrimmedString } from "@/lib/validators"

type ResetPasswordBody = {
  token?: unknown
  password?: unknown
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<ResetPasswordBody>(req)
    const result = await resetPassword({
      token: asTrimmedString(body.token, "token"),
      nextPassword: asPassword(body.password),
    })

    if (!result.ok) {
      throw new AppError(
        "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว",
        400,
        "INVALID_RESET_TOKEN",
      )
    }

    return jsonResponse({
      ok: true,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
