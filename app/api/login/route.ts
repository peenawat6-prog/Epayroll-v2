import bcrypt from "bcrypt"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const passwordMatched = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatched) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  })
}
