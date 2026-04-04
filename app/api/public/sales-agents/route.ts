import { jsonResponse } from "@/lib/http"
import { listPublicSalesAgents } from "@/lib/sales-agents"

export async function GET() {
  const salesAgents = await listPublicSalesAgents()

  return jsonResponse({
    salesAgents,
  })
}
