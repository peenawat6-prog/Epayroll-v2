import { NextResponse } from "next/server"

export async function POST(req: Request) {
  void req

  return NextResponse.json(
    {
      error: "Use the NextAuth credentials flow at /api/auth/callback/credentials",
      code: "LEGACY_LOGIN_DISABLED",
    },
    { status: 410 },
  )
}
