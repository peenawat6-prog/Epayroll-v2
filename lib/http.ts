import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

type ErrorPayload = {
  error: string
  code?: string
  details?: unknown
}

export class AppError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    message: string,
    status = 400,
    code = "BAD_REQUEST",
    details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

export function jsonError(
  error: string,
  status = 400,
  code?: string,
  details?: unknown,
) {
  const payload: ErrorPayload = { error }

  if (code) {
    payload.code = code
  }

  if (details !== undefined) {
    payload.details = details
  }

  return jsonResponse(payload, status)
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new AppError("Invalid JSON body", 400, "INVALID_JSON")
  }
}

export function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.code, error.details)
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2002") {
      return jsonError("Duplicate record", 409, "DUPLICATE_RECORD")
    }

    if (error.code === "P2025") {
      return jsonError("Record not found", 404, "NOT_FOUND")
    }
  }

  console.error(error)
  return jsonError("Internal server error", 500, "INTERNAL_SERVER_ERROR")
}
