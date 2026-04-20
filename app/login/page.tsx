"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import PasswordInput from "@/app/components/password-input"
import { markBrowserSessionActive } from "@/lib/browser-session"
import { useLanguage } from "@/lib/language"

const REMEMBERED_EMAIL_KEY = "epayroll-remembered-email"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") {
      return ""
    }

    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? ""
  })
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (!result) {
      setError(
        t(
          "ไม่สามารถเชื่อมต่อระบบล็อกอินได้",
          "Unable to connect to the login system.",
        ),
      )
      return
    }

    if (result.error) {
      setError(
        t(
          "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
          "Email or password is incorrect.",
        ),
      )
      return
    }

    const meRes = await fetch("/api/me")
    const me = await meRes.json()

    if (!meRes.ok) {
      if (meRes.status === 402) {
        router.push("/subscription-expired")
        router.refresh()
        return
      }

      setError(
        t(
          "เข้าสู่ระบบสำเร็จ แต่โหลดข้อมูลผู้ใช้ไม่สำเร็จ",
          "Signed in, but failed to load your account.",
        ),
      )
      return
    }

    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase())
    markBrowserSessionActive()
    router.push(
      me?.role === "EMPLOYEE"
        ? "/employee"
        : me?.role === "DEV"
          ? "/dev/dashboard"
          : "/dashboard",
    )
    router.refresh()
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">Epayroll.ltd</div>
        <h1>{t("เข้าสู่ระบบ", "Sign in")}</h1>

        <div className="field">
          <label htmlFor="email">{t("อีเมล", "Email")}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t("รหัสผ่าน", "Password")}</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <div style={{ marginTop: 8 }}>
            <Link href="/forgot-password" className="table-meta">
              {t("ลืมรหัสผ่าน", "Forgot password")}
            </Link>
          </div>
        </div>

        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row login-action-row">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading
              ? t("กำลังตรวจสอบ...", "Checking...")
              : t("เข้าสู่ระบบ", "Sign in")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/employee/register")}
          >
            {t("ลงทะเบียนพนักงาน", "Employee registration")}
          </button>
        </div>
      </form>
    </div>
  )
}
