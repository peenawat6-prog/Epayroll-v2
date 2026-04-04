import { authorizeRequest } from "@/lib/access"
import { purgeOldAttendancePhotos } from "@/lib/attendance-photo-maintenance"
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

    const result = await purgeOldAttendancePhotos()

    return jsonResponse({
      ok: true,
      cutoffDate: result.cutoffDate.toISOString(),
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
