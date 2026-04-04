import { jsonResponse, readJsonBody } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { updateTenantPublicVisibility } from "@/lib/shop-registration"

type TenantVisibilityBody = {
  isPubliclyVisible?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req, context, access) => {
    const { id } = await context.params!
    const body = await readJsonBody<TenantVisibilityBody>(req)
    const isPubliclyVisible = body.isPubliclyVisible !== false

    const tenant = await updateTenantPublicVisibility({
      tenantId: id,
      devUserId: access.user.id,
      isPubliclyVisible,
    })

    return jsonResponse({
      ok: true,
      tenant,
    })
  },
)
