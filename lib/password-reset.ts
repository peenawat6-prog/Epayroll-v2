import bcrypt from "bcrypt"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { sendMail, isMailerConfigured } from "@/lib/mailer"

const RESET_TOKEN_TTL_MINUTES = 30

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function getResetPasswordUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000"
  return `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      tenantId: true,
    },
  })

  if (!user) {
    return {
      accepted: true,
      emailSent: false,
      mailConfigured: isMailerConfigured(),
    }
  }

  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashResetToken(rawToken)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        tokenHash: {
          not: tokenHash,
        },
      },
      data: {
        usedAt: new Date(),
      },
    })
  })

  const resetUrl = getResetPasswordUrl(rawToken)
  let emailSent = false

  if (isMailerConfigured()) {
    await sendMail({
      to: user.email,
      subject: "Epayroll: รีเซ็ตรหัสผ่าน",
      text: `มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:\n${resetUrl}\n\nลิงก์นี้ใช้ได้ 30 นาที`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #173126;">
          <h2 style="margin-bottom: 12px;">รีเซ็ตรหัสผ่าน Epayroll</h2>
          <p>มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#54cd93;color:#fff;text-decoration:none;border-radius:999px;font-weight:700;">
              ตั้งรหัสผ่านใหม่
            </a>
          </p>
          <p>หรือเปิดลิงก์นี้ในเบราว์เซอร์:</p>
          <p>${resetUrl}</p>
          <p>ลิงก์นี้ใช้ได้ 30 นาที</p>
        </div>
      `,
    })
    emailSent = true
  }

  await createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    action: "auth.password_reset_requested",
    entityType: "User",
    entityId: user.id,
    metadata: {
      email: user.email,
      emailSent,
      mailConfigured: isMailerConfigured(),
      expiresAt,
    },
  })

  return {
    accepted: true,
    emailSent,
    mailConfigured: isMailerConfigured(),
  }
}

export async function resetPassword(params: {
  token: string
  nextPassword: string
}) {
  const tokenHash = hashResetToken(params.token)
  const now = new Date()
  const token = await prisma.passwordResetToken.findUnique({
    where: {
      tokenHash,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          tenantId: true,
        },
      },
    },
  })

  if (!token || token.usedAt || token.expiresAt.getTime() < now.getTime()) {
    return {
      ok: false as const,
    }
  }

  const passwordHash = await bcrypt.hash(params.nextPassword, 10)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: token.userId,
      },
      data: {
        passwordHash,
      },
    })

    await tx.passwordResetToken.update({
      where: {
        id: token.id,
      },
      data: {
        usedAt: now,
      },
    })

    await tx.passwordResetToken.updateMany({
      where: {
        userId: token.userId,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    })
  })

  await createAuditLog({
    tenantId: token.user.tenantId,
    userId: token.user.id,
    action: "auth.password_reset_completed",
    entityType: "User",
    entityId: token.user.id,
    metadata: {
      email: token.user.email,
    },
  })

  return {
    ok: true as const,
  }
}
