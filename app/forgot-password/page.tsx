"use client"

import { useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/language"

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ??
            t(
              "ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ",
              "Failed to request password reset.",
            ),
        )
      }

      setMessage(
        data.mailConfigured
          ? t(
              "หากอีเมลนี้เคยสมัครไว้ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลที่เคยสมัครไว้แล้ว",
              "If this email is registered, we have sent a password reset link to the registered email address.",
            )
          : t(
              "ระบบรับคำขอแล้ว แต่ยังไม่ได้ตั้งค่าอีเมลสำหรับส่งลิงก์รีเซ็ตรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ",
              "The request was accepted, but email delivery is not configured yet. Please contact the administrator.",
            ),
      )
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t(
              "ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ",
              "Failed to request password reset.",
            ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">Epayroll.ltd</div>
        <h1>{t("ลืมรหัสผ่าน", "Forgot password")}</h1>
        <p className="panel-subtitle">
          {t(
            "กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้",
            "Enter the email used to register and we will send a link to set a new password.",
          )}
        </p>

        <div className="field">
          <label htmlFor="forgot-email">{t("อีเมล", "Email")}</label>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        {error ? <div className="message message-error">{error}</div> : null}
        {message ? <div className="message message-success">{message}</div> : null}

        <div className="action-row login-action-row">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading
              ? t("กำลังส่ง...", "Sending...")
              : t("ส่งลิงก์รีเซ็ต", "Send reset link")}
          </button>
          <Link href="/login" className="btn btn-secondary">
            {t("กลับหน้าเข้าสู่ระบบ", "Back to sign in")}
          </Link>
        </div>
      </form>
    </div>
  )
}
