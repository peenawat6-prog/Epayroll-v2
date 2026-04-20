import { jsonResponse, readJsonBody, handleApiError } from "@/lib/http"
import { requestPasswordReset } from "@/lib/password-reset"
import { asEmail } from "@/lib/validators"

type ForgotPasswordBody = {
  email?: unknown
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBody<ForgotPasswordBody>(req)
    const result = await requestPasswordReset(asEmail(body.email, "email"))

    return jsonResponse({
      ok: true,
      emailSent: result.emailSent,
      mailConfigured: result.mailConfigured,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
