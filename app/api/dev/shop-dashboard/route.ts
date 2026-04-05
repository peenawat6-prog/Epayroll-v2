import { jsonResponse } from "@/lib/http"
import { listDevManagementRegistrationRequests } from "@/lib/management-registration"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  listDevSalesAgentRegistrationRequests,
  listDevSalesAgentsWithCommission,
} from "@/lib/sales-agents"
import {
  listDevShopRegistrationRequests,
  listDevTenants,
} from "@/lib/shop-registration"
import { asMonth, asYear } from "@/lib/validators"

export const GET = withAuthorizedRoute(
  {
    roles: ["DEV"],
    requireSubscription: false,
  },
  async (req) => {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const commissionMonth = asMonth(
      searchParams.get("commissionMonth"),
      now.getMonth() + 1,
    )
    const commissionYear = asYear(
      searchParams.get("commissionYear"),
      now.getFullYear(),
    )

    const [requests, tenants, salesRequests, salesAgents, managementRequests] = await Promise.all([
      listDevShopRegistrationRequests(),
      listDevTenants(),
      listDevSalesAgentRegistrationRequests(),
      listDevSalesAgentsWithCommission({
        month: commissionMonth,
        year: commissionYear,
      }),
      listDevManagementRegistrationRequests(),
    ])

    return jsonResponse({
      requests,
      tenants,
      salesRequests,
      salesAgents,
      managementRequests,
      commissionMonth,
      commissionYear,
    })
  },
)
