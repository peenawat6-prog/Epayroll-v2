"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function EmployeeRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    registrationCode: "",
    firstName: "",
    lastName: "",
    phone: "",
    position: "",
    email: "",
    password: "",
    employeeType: "FULL_TIME",
    payType: "MONTHLY",
    bankName: "",
    accountName: "",
    accountNumber: "",
    promptPayId: "",
  })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/employee/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "ส่งคำขอลงทะเบียนไม่สำเร็จ")
      }

      setMessage("ส่งคำขอลงทะเบียนแล้ว กรุณารอหัวหน้าอนุมัติ")
      setForm({
        registrationCode: "",
        firstName: "",
        lastName: "",
        phone: "",
        position: "",
        email: "",
        password: "",
        employeeType: "FULL_TIME",
        payType: "MONTHLY",
        bankName: "",
        accountName: "",
        accountNumber: "",
        promptPayId: "",
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ส่งคำขอลงทะเบียนไม่สำเร็จ",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">สมัครบัญชีพนักงาน</div>
        <h1>ลงทะเบียนพนักงาน</h1>
        <p>กรอกข้อมูลและรอหัวหน้าอนุมัติ ก่อนเข้าใช้งานระบบพนักงาน</p>

        <div className="field">
          <label htmlFor="registrationCode">รหัสร้าน</label>
          <input
            id="registrationCode"
            value={form.registrationCode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                registrationCode: event.target.value,
              }))
            }
            placeholder="เช่น DEMO-CAFE"
          />
        </div>

        <div className="message message-success">
          ระบบจะออกรหัสพนักงานให้อัตโนมัติหลังส่งคำขอลงทะเบียน
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="firstName">ชื่อจริง</label>
            <input
              id="firstName"
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  firstName: event.target.value,
                }))
              }
            />
          </div>
          <div className="field">
            <label htmlFor="lastName">นามสกุล</label>
            <input
              id="lastName"
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastName: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="phone">เบอร์โทร</label>
          <input
            id="phone"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="position">ตำแหน่งงาน</label>
          <input
            id="position"
            value={form.position}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                position: event.target.value,
              }))
            }
            placeholder="เช่น Barista"
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="employeeType">ประเภทพนักงาน</label>
            <select
              id="employeeType"
              value={form.employeeType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  employeeType: event.target.value,
                }))
              }
            >
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="payType">รูปแบบจ่ายเงิน</label>
            <select
              id="payType"
              value={form.payType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payType: event.target.value,
                }))
              }
            >
              <option value="MONTHLY">รายเดือน</option>
              <option value="DAILY">รายวัน</option>
              <option value="HOURLY">รายชั่วโมง</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="email">อีเมลสำหรับล็อกอิน</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="employee@example.com"
          />
        </div>

        <div className="field">
          <label htmlFor="password">ตั้งรหัสผ่าน</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            placeholder="อย่างน้อย 6 ตัวอักษร"
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="bankName">ธนาคารที่รับเงิน</label>
            <input
              id="bankName"
              value={form.bankName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bankName: event.target.value,
                }))
              }
              placeholder="เช่น SCB, KBank, Krungthai"
            />
          </div>
          <div className="field">
            <label htmlFor="accountName">ชื่อบัญชีรับเงิน</label>
            <input
              id="accountName"
              value={form.accountName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountName: event.target.value,
                }))
              }
              placeholder="ชื่อตามสมุดบัญชี"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="accountNumber">เลขบัญชีธนาคาร</label>
            <input
              id="accountNumber"
              value={form.accountNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountNumber: event.target.value,
                }))
              }
              placeholder="กรอกเลขบัญชี"
            />
          </div>
          <div className="field">
            <label htmlFor="promptPayId">พร้อมเพย์</label>
            <input
              id="promptPayId"
              value={form.promptPayId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  promptPayId: event.target.value,
                }))
              }
              placeholder="เบอร์โทรหรือเลขบัตร"
            />
          </div>
        </div>

        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "กำลังส่ง..." : "ส่งคำขอลงทะเบียน"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/login")}
          >
            กลับหน้าเข้าสู่ระบบ
          </button>
        </div>
      </form>
    </div>
  )
}
