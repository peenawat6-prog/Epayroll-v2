import { jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { extendTenantSubscription } from "@/lib/shop-registration"
import { asPositiveDays } from "@/lib/validators"

type SubscriptionExtensionBody = {
  extraDays?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req, context, access) => {
    const { id } = await context.params!
    const body = await readJsonBody<SubscriptionExtensionBody>(req)
    const extraDays = asPositiveDays(body.extraDays ?? 30, "extraDays")
    const tenant = await extendTenantSubscription({
      tenantId: id,
      devUserId: access.user.id,
      extraDays,
    })

    return jsonResponse({
      ok: true,
      tenant,
    })
  },
)
