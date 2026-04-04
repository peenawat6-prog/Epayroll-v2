"use client"

import { useRouter } from "next/navigation"
import LogoutButton from "@/app/components/logout-button"

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
          <LogoutButton className="btn btn-primary" />
        </div>
      </div>
    </div>
  )
}

// End of file
