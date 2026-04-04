"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/language"

type SalesRegisterForm = {
  firstName: string
  lastName: string
  phone: string
  email: string
  lineId: string
}

const DEFAULT_FORM: SalesRegisterForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  lineId: "",
}

export default function SalesRegisterPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [form, setForm] = useState<SalesRegisterForm>(DEFAULT_FORM)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setMessage("")
    setError("")

    try {
      const res = await fetch("/api/sales/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "ส่งคำขอลงทะเบียนเซลล์ไม่สำเร็จ")
      }

      setForm(DEFAULT_FORM)
      setMessage(
        data.message ||
          "ส่งคำขอลงทะเบียนเซลล์เรียบร้อยแล้ว กรุณารอทีมซัพพอร์ตอนุมัติ",
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ส่งคำขอลงทะเบียนเซลล์ไม่สำเร็จ",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t("ลงทะเบียนเซลล์", "Sales registration")}</div>
            <div className="badge">{t("ค่าคอม 50 บาทต่อร้านต่อเดือน", "50 THB per shop per month")}</div>
          </div>
          <h1 className="hero-title">{t("สมัครเป็นเซลล์ Epayroll", "Become an Epayroll sales partner")}</h1>
          <p className="hero-subtitle">
            {t(
              "กรอกข้อมูลติดต่อ แล้วรอทีมซัพพอร์ตอนุมัติก่อนเริ่มแนะนำร้านค้า",
              "Submit your contact details and wait for support approval before referring shops.",
            )}
          </p>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/login")}
          >
            {t("กลับหน้าเข้าสู่ระบบ", "Back to login")}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t("ข้อมูลเซลล์", "Sales details")}</h2>
        <p className="panel-subtitle">
          {t(
            "หลังอนุมัติแล้ว ร้านที่เลือกชื่อเซลล์ของคุณตอนสมัครจะถูกนับค่าคอมให้อัตโนมัติ",
            "Once approved, shops that select your sales profile during signup will be counted automatically.",
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t("ชื่อ", "First name")}</label>
              <input
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
              <label>{t("นามสกุล", "Last name")}</label>
              <input
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>{t("เบอร์โทร", "Phone")}</label>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("อีเมล", "Email")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>LINE ID</label>
              <input
                value={form.lineId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, lineId: event.target.value }))
                }
              />
            </div>
          </div>

          {message ? <div className="message message-success">{message}</div> : null}
          {error ? <div className="message message-error">{error}</div> : null}

          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? t("กำลังส่งคำขอ...", "Submitting...")
                : t("ส่งคำขอลงทะเบียนเซลล์", "Submit sales registration")}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
