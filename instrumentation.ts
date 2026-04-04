import { validateServerEnv } from "@/lib/env"
import { logServerEvent } from "@/lib/observability"

export async function register() {
  validateServerEnv()

  logServerEvent("info", {
    event: "app.startup.validated_env",
    metadata: {
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
  })

  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.VERCEL !== "1") {
    const { scheduleAttendancePhotoCleanup } = await import(
      "@/lib/attendance-photo-maintenance"
    )
    scheduleAttendancePhotoCleanup()
  }
}
