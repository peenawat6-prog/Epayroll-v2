import { getAuditLogList } from "@/lib/audit"
import { jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.auditView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const logs = await getAuditLogList(access.user.tenantId, {
      limit: Number(searchParams.get("limit") ?? 50),
      entityType: searchParams.get("entityType") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    })

    return jsonResponse({
      items: logs,
    })
  },
)
