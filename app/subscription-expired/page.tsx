"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function SubscriptionExpiredPage() {
  const router = useRouter()

  return (
    <div className="login-shell">
      <div className="panel login-card">
        <div className="badge">Subscription</div>
        <h1>การสมัครใช้งานหมดอายุแล้ว</h1>
        <p>กรุณาต่ออายุแพ็กเกจก่อนกลับไปใช้งาน dashboard และโมดูลเงินเดือน</p>

        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push("/login")}>
            กลับหน้าเข้าสู่ระบบ
          </button>
          <button
            className="btn btn-primary"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}

// End of file
