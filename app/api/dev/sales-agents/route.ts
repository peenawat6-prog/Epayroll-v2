import { jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { createSalesAgentByDev } from "@/lib/sales-agents"
import {
  asEmail,
  asOptionalTrimmedString,
  asTrimmedString,
} from "@/lib/validators"

type CreateSalesAgentBody = {
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  email?: unknown
  lineId?: unknown
}

export const POST = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req) => {
    const body = await readJsonBody<CreateSalesAgentBody>(req)
    const salesAgent = await createSalesAgentByDev({
      firstName: asTrimmedString(body.firstName, "firstName"),
      lastName: asTrimmedString(body.lastName, "lastName"),
      phone: asOptionalTrimmedString(body.phone),
      email: asEmail(body.email, "email"),
      lineId: asOptionalTrimmedString(body.lineId),
    })

    return jsonResponse(
      {
        ok: true,
        salesAgent,
        message: "เพิ่มเซลล์เรียบร้อยแล้ว",
      },
      201,
    )
  },
)
