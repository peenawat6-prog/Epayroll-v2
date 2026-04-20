"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import PasswordInput from "@/app/components/password-input"
import { useLanguage } from "@/lib/language"

export default function ResetPasswordPage() {
  const { t } = useLanguage()
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token")?.trim() ?? "")
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      if (!token) {
        throw new Error(
          t(
            "ไม่พบโทเค็นรีเซ็ตรหัสผ่าน",
            "Password reset token is missing.",
          ),
        )
      }

      if (password !== confirmPassword) {
        throw new Error(
          t(
            "ยืนยันรหัสผ่านไม่ตรงกัน",
            "Password confirmation does not match.",
          ),
        )
      }

      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ??
            t(
              "รีเซ็ตรหัสผ่านไม่สำเร็จ",
              "Failed to reset password.",
            ),
        )
      }

      setMessage(
        t(
          "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
          "Your password has been reset. Please sign in with the new password.",
        ),
      )
      setPassword("")
      setConfirmPassword("")
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t(
              "รีเซ็ตรหัสผ่านไม่สำเร็จ",
              "Failed to reset password.",
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
        <h1>{t("ตั้งรหัสผ่านใหม่", "Set a new password")}</h1>

        <div className="field">
          <label htmlFor="new-password">{t("รหัสผ่านใหม่", "New password")}</label>
          <PasswordInput
            id="new-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
        </div>

        <div className="field">
          <label htmlFor="confirm-password">{t("ยืนยันรหัสผ่านใหม่", "Confirm new password")}</label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
        </div>

        {error ? <div className="message message-error">{error}</div> : null}
        {message ? <div className="message message-success">{message}</div> : null}

        <div className="action-row login-action-row">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading
              ? t("กำลังบันทึก...", "Saving...")
              : t("บันทึกรหัสผ่านใหม่", "Save new password")}
          </button>
          <Link href="/login" className="btn btn-secondary">
            {t("กลับหน้าเข้าสู่ระบบ", "Back to sign in")}
          </Link>
        </div>
      </form>
    </div>
  )
}
