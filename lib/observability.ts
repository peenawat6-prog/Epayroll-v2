import { headers } from "next/headers"

type LogLevel = "info" | "warn" | "error"

type LogPayload = {
  event: string
  requestId?: string
  route?: string
  tenantId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

function serialize(payload: LogPayload) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

export function logServerEvent(level: LogLevel, payload: LogPayload) {
  const line = serialize(payload)

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.log(line)
}

export function createRequestId() {
  return crypto.randomUUID()
}

export async function getCurrentRequestId() {
  const requestHeaders = await headers()
  return requestHeaders.get("x-request-id") ?? undefined
}
