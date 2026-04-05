"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import PasswordInput from "@/app/components/password-input"
import { useLanguage } from "@/lib/language"

type PublicBranch = {
  id: string
  name: string
}

type ShopOption = {
  id: string
  name: string
  registrationCode: string
  branches: PublicBranch[]
}

const createEmptyForm = () => ({
  shopName: "",
  registrationCode: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  requestedRole: "ADMIN",
})

function getLoginUrl() {
  if (typeof window === "undefined") {
    return "/login"
  }

  const { protocol, hostname, port } = window.location

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "/login"
  }

  if (hostname.startsWith("manage.")) {
    const mainHostname = hostname.replace(/^manage\./i, "")
    return `${protocol}//${mainHostname}${port ? `:${port}` : ""}/login`
  }

  return "/login"
}

export default function ManagementRegisterPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [form, setForm] = useState(createEmptyForm)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([])
  const [shopSearchLoading, setShopSearchLoading] = useState(false)
  const [showShopOptions, setShowShopOptions] = useState(false)
  const [loading, setLoading] = useState(false)
  const shopLookupRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const normalizedName = form.shopName.trim()

    if (normalizedName.length < 2) {
      setShopOptions([])
      setShowShopOptions(false)
      setForm((current) => ({
        ...current,
        registrationCode: "",
      }))
      return
    }

    const timer = window.setTimeout(async () => {
      setShopSearchLoading(true)

      try {
        const res = await fetch(
          `/api/public/shops?name=${encodeURIComponent(normalizedName)}`,
        )
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || t("ค้นหาร้านไม่สำเร็จ", "Shop search failed"))
        }

        setShopOptions(data.items ?? [])
        setShowShopOptions(true)
      } catch {
        setShopOptions([])
        setShowShopOptions(false)
      } finally {
        setShopSearchLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [form.shopName, t])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        shopLookupRef.current &&
        !shopLookupRef.current.contains(event.target as Node)
      ) {
        setShowShopOptions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectShop = (shop: ShopOption) => {
    setForm((current) => ({
      ...current,
      shopName: shop.name,
      registrationCode: shop.registrationCode,
    }))
    setShopOptions([])
    setShowShopOptions(false)
    setError("")
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage("")
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/management/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ||
            t(
              "ส่งคำขอลงทะเบียนสิทธิ์บริหารไม่สำเร็จ",
              "Management registration failed",
            ),
        )
      }

      setMessage(
        t(
          "ส่งคำขอลงทะเบียนแล้ว กรุณารอทีมซัพพอร์ตอนุมัติ",
          "Registration request sent. Please wait for support approval.",
        ),
      )
      setForm(createEmptyForm())
      setShopOptions([])
      setShowShopOptions(false)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t(
              "ส่งคำขอลงทะเบียนสิทธิ์บริหารไม่สำเร็จ",
              "Management registration failed",
            ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">
          {t("ลงทะเบียนผู้บริหารร้าน", "Management account registration")}
        </div>
        <h1>{t("ลงทะเบียนเจ้าของ / หุ้นส่วน / ฝ่ายงาน", "Register owner / partner / staff role")}</h1>
        <p>
          {t(
            "เลือกร้านที่ต้องการ แล้วเลือกสิทธิ์ที่ต้องการใช้งาน ระบบจะส่งคำขอให้ทีมซัพพอร์ตอนุมัติ",
            "Choose the shop and requested role. Support will review and approve the request.",
          )}
        </p>

        <div className="field shop-lookup-field" ref={shopLookupRef}>
          <label htmlFor="shopName">{t("ชื่อร้าน", "Shop name")}</label>
          <input
            id="shopName"
            value={form.shopName}
            onFocus={() => {
              if (shopOptions.length > 0) setShowShopOptions(true)
            }}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                shopName: event.target.value,
                registrationCode: "",
              }))
            }
            autoComplete="off"
            placeholder={t("พิมพ์ชื่อร้านเพื่อค้นหา", "Type shop name to search")}
          />
          {showShopOptions ? (
            <div className="shop-lookup-list">
              {shopSearchLoading ? (
                <button type="button" className="shop-lookup-option" disabled>
                  {t("กำลังค้นหาร้าน...", "Searching shops...")}
                </button>
              ) : shopOptions.length ? (
                shopOptions.map((shop) => (
                  <button
                    key={shop.id}
                    type="button"
                    className="shop-lookup-option"
                    onClick={() => selectShop(shop)}
                  >
                    <strong>{shop.name}</strong>
                    <span>{shop.registrationCode}</span>
                  </button>
                ))
              ) : (
                <button type="button" className="shop-lookup-option" disabled>
                  {t("ไม่พบชื่อร้านนี้", "No matching shop found")}
                </button>
              )}
            </div>
          ) : null}
          {form.registrationCode ? (
            <div className="table-meta">
              {t("เลือกร้านแล้ว", "Selected shop")}: {form.shopName}
            </div>
          ) : null}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="firstName">{t("ชื่อจริง", "First name")}</label>
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
            <label htmlFor="lastName">{t("นามสกุล", "Last name")}</label>
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
          <label htmlFor="phone">{t("เบอร์โทร", "Phone")}</label>
          <input
            id="phone"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="requestedRole">{t("สิทธิ์ที่ขอใช้งาน", "Requested role")}</label>
          <select
            id="requestedRole"
            value={form.requestedRole}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                requestedRole: event.target.value,
              }))
            }
          >
            <option value="OWNER">{t("เจ้าของร้าน / หุ้นส่วน", "Owner / partner")}</option>
            <option value="ADMIN">{t("แอดมินร้าน", "Store admin")}</option>
            <option value="HR">{t("ฝ่ายบุคคล", "HR")}</option>
            <option value="FINANCE">{t("ฝ่ายการเงิน", "Finance")}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="email">{t("อีเมลสำหรับล็อกอิน", "Login email")}</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t("ตั้งรหัสผ่าน", "Password")}</label>
          <PasswordInput
            id="password"
            value={form.password}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                password: value,
              }))
            }
            autoComplete="new-password"
          />
        </div>

        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row login-action-row">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t("กำลังส่ง...", "Sending...") : t("ส่งคำขอลงทะเบียน", "Submit request")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              window.location.href = getLoginUrl()
            }}
          >
            {t("กลับหน้าเข้าสู่ระบบ", "Back to login")}
          </button>
        </div>
      </form>
    </div>
  )
}
