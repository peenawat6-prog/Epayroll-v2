"use client"

import { useEffect, useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { markBrowserSessionActive } from "@/lib/browser-session"

const REMEMBERED_EMAIL_KEY = "epayroll-remembered-email"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)

    if (rememberedEmail) {
      setEmail(rememberedEmail)
    }
  }, [])

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
      setError("ไม่สามารถเชื่อมต่อระบบล็อกอินได้")
      return
    }

    if (result.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
      return
    }

    const meRes = await fetch("/api/me")
    const me = await meRes.json()

    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase())
    markBrowserSessionActive()
    router.push(me?.role === "EMPLOYEE" ? "/employee" : "/dashboard")
    router.refresh()
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">Cafe SaaS</div>
        <h1>เข้าสู่ระบบ</h1>

        <div className="field">
          <label htmlFor="email">อีเมล</label>
          <input
            id="email"
            type="email"
            placeholder="owner@demo.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input
            id="password"
            type="password"
            placeholder="demo1234"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/employee/register")}
          >
            ลงทะเบียนพนักงาน
          </button>
        </div>
      </form>
    </div>
  )
}
