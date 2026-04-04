import { prisma } from "@/lib/prisma"
import { jsonResponse } from "@/lib/http"
import { validateServerEnv } from "@/lib/env"
import { logServerEvent } from "@/lib/observability"

export async function GET() {
  try {
    validateServerEnv()
    await prisma.$queryRaw`SELECT 1`

    logServerEvent("info", {
      event: "health.ok",
      route: "/api/health",
      metadata: {
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
    })

    return jsonResponse({
      ok: true,
      database: "up",
      app: "up",
      nodeEnv: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "0.0.0",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logServerEvent("error", {
      event: "health.failed",
      route: "/api/health",
      metadata: {
        error: error instanceof Error ? error.message : "unknown",
      },
    })

    return jsonResponse(
      {
        ok: false,
        database: "down",
        app: "degraded",
        nodeEnv: process.env.NODE_ENV ?? "development",
        version: process.env.npm_package_version ?? "0.0.0",
        timestamp: new Date().toISOString(),
      },
      500,
    )
  }
}
