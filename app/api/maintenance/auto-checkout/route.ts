import { authorizeRequest } from "@/lib/access"
import { autoCloseDueAttendances } from "@/lib/attendance-auto-checkout"
import { getCronSecret } from "@/lib/env"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"

export const runtime = "nodejs"

async function assertMaintenanceAccess(req: Request) {
  const cronSecret = getCronSecret()
  const authHeader = req.headers.get("authorization")

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return
  }

  if (authHeader && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw new AppError("Unauthorized maintenance request", 401, "UNAUTHORIZED")
  }

  await authorizeRequest({
    roles: ROLE_GROUPS.opsView,
  })
}

export async function GET(req: Request) {
  try {
    await assertMaintenanceAccess(req)

    const result = await autoCloseDueAttendances()

    return jsonResponse({
      ok: true,
      processedCount: result.processedCount,
      closedCount: result.closedCount,
      closedIds: result.closedIds,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
