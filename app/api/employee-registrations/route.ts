import { listEmployeeRegistrationRequests } from "@/lib/employee-registration"
import { jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.employeeManage,
  },
  async (_req, _context, access) => {
    const items = await listEmployeeRegistrationRequests(access.user.tenantId)
    return jsonResponse({ items })
  },
)
