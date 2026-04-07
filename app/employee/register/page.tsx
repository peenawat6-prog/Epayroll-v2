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

const DAY_OFF_OPTIONS = [
  { value: "SUNDAY", th: "อาทิตย์", en: "Sunday" },
  { value: "MONDAY", th: "จันทร์", en: "Monday" },
  { value: "TUESDAY", th: "อังคาร", en: "Tuesday" },
  { value: "WEDNESDAY", th: "พุธ", en: "Wednesday" },
  { value: "THURSDAY", th: "พฤหัสบดี", en: "Thursday" },
  { value: "FRIDAY", th: "ศุกร์", en: "Friday" },
  { value: "SATURDAY", th: "เสาร์", en: "Saturday" },
] as const

const createEmptyForm = () => ({
  shopName: "",
  registrationCode: "",
  branchId: "",
  firstName: "",
  lastName: "",
  phone: "",
  position: "",
  email: "",
  password: "",
  employeeType: "FULL_TIME",
  payType: "MONTHLY",
  workShift: "MORNING",
  dayOffWeekdays: [] as string[],
  bankName: "",
  accountName: "",
  accountNumber: "",
  promptPayId: "",
})

export default function EmployeeRegisterPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [form, setForm] = useState(createEmptyForm)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([])
  const [shopSearchLoading, setShopSearchLoading] = useState(false)
  const [showShopOptions, setShowShopOptions] = useState(false)
  const [branches, setBranches] = useState<PublicBranch[]>([])
  const [loading, setLoading] = useState(false)
  const shopLookupRef = useRef<HTMLDivElement | null>(null)
  const workShiftLabels = {
    MORNING: t("กะเช้า", "Morning shift"),
    AFTERNOON: t("กะบ่าย", "Afternoon shift"),
    NIGHT: t("กะดึก", "Night shift"),
  } as const

  useEffect(() => {
    const normalizedName = form.shopName.trim()

    if (normalizedName.length < 2) {
      setShopOptions([])
      setShowShopOptions(false)
      setBranches([])
      setForm((current) => ({
        ...current,
        registrationCode: "",
        branchId: "",
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
      branchId: "",
    }))
    setBranches(shop.branches ?? [])
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
      const res = await fetch("/api/employee/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t("ส่งคำขอลงทะเบียนไม่สำเร็จ", "Registration request failed"))
      }

      setMessage(
        t(
          "ส่งคำขอลงทะเบียนแล้ว กรุณารอหัวหน้าอนุมัติ",
          "Registration request sent. Please wait for approval.",
        ),
      )
      setForm(createEmptyForm())
      setShopOptions([])
      setShowShopOptions(false)
      setBranches([])
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("ส่งคำขอลงทะเบียนไม่สำเร็จ", "Registration request failed"),
      )
    } finally {
      setLoading(false)
    }
  }

  const toggleDayOff = (weekday: string) => {
    setForm((current) => ({
      ...current,
      dayOffWeekdays: current.dayOffWeekdays.includes(weekday)
        ? current.dayOffWeekdays.filter((item) => item !== weekday)
        : [...current.dayOffWeekdays, weekday],
    }))
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">{t("สมัครบัญชีพนักงาน", "Employee account signup")}</div>
        <h1>{t("ลงทะเบียนพนักงาน", "Employee registration")}</h1>
        <p>
          {t(
            "กรอกข้อมูลและรอหัวหน้าอนุมัติ ก่อนเข้าใช้งานระบบพนักงาน",
            "Fill in your details and wait for approval before logging in.",
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
                branchId: "",
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
              {t("เลือกแล้ว", "Selected")}: {form.shopName}
            </div>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="branchId">{t("สาขาที่สมัคร", "Branch")}</label>
          <select
            id="branchId"
            value={form.branchId}
            disabled={!form.registrationCode || branches.length === 0}
            onChange={(event) =>
              setForm((current) => ({ ...current, branchId: event.target.value }))
            }
          >
            <option value="">
              {branches.length
                ? t("เลือกสาขา", "Select branch")
                : t(
                    "เลือกชื่อร้านก่อน แล้วเลือกสาขา",
                    "Select a shop first, then choose a branch",
                  )}
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="message message-success">
          {t(
            "ระบบจะออกรหัสพนักงานให้อัตโนมัติหลังส่งคำขอลงทะเบียน",
            "Employee code will be generated automatically after submission.",
          )}
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
          <label htmlFor="position">{t("ตำแหน่งงาน", "Position")}</label>
          <input
            id="position"
            value={form.position}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                position: event.target.value,
              }))
            }
            placeholder={t("เช่น Barista", "e.g. Barista")}
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="employeeType">{t("ประเภทพนักงาน", "Employee type")}</label>
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
            <label htmlFor="payType">{t("รูปแบบจ่ายเงิน", "Pay type")}</label>
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
              <option value="MONTHLY">{t("รายเดือน", "Monthly")}</option>
              <option value="DAILY">{t("รายวัน", "Daily")}</option>
              <option value="HOURLY">{t("รายชั่วโมง", "Hourly")}</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="workShift">{t("กะการทำงานประจำ", "Regular shift")}</label>
          <select
            id="workShift"
            value={form.workShift}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                workShift: event.target.value,
              }))
            }
          >
            <option value="MORNING">{workShiftLabels.MORNING}</option>
            <option value="AFTERNOON">{workShiftLabels.AFTERNOON}</option>
            <option value="NIGHT">{workShiftLabels.NIGHT}</option>
          </select>
        </div>

        <div className="field">
          <label>{t("วันหยุดประจำสัปดาห์", "Weekly days off")}</label>
          <div className="weekday-picker">
            {DAY_OFF_OPTIONS.map((day) => (
              <label key={day.value} className="weekday-option">
                <input
                  type="checkbox"
                  checked={form.dayOffWeekdays.includes(day.value)}
                  onChange={() => toggleDayOff(day.value)}
                />
                <span>{t(day.th, day.en)}</span>
              </label>
            ))}
          </div>
          <div className="table-meta">
            {t(
              "ถ้าเป็นพนักงานเงินเดือน ให้เลือกวันหยุดประจำ เช่น ทุกวันอังคารหรือวันพุธ",
              "For monthly staff, choose recurring weekly days off, e.g. every Tuesday or Wednesday.",
            )}
          </div>
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
            placeholder={t("employee@example.com", "employee@example.com")}
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
            placeholder={t("อย่างน้อย 6 ตัวอักษร", "At least 6 characters")}
            autoComplete="new-password"
          />
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="bankName">{t("ธนาคารที่รับเงิน", "Bank")}</label>
            <input
              id="bankName"
              value={form.bankName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  bankName: event.target.value,
                }))
              }
              placeholder={t("เช่น SCB, KBank, Krungthai", "e.g. SCB, KBank, Krungthai")}
            />
          </div>
          <div className="field">
            <label htmlFor="accountName">{t("ชื่อบัญชีรับเงิน", "Account name")}</label>
            <input
              id="accountName"
              value={form.accountName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountName: event.target.value,
                }))
              }
              placeholder={t("ชื่อตามสมุดบัญชี", "Account holder name")}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="accountNumber">{t("เลขบัญชีธนาคาร", "Account number")}</label>
            <input
              id="accountNumber"
              value={form.accountNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountNumber: event.target.value,
                }))
              }
              placeholder={t("กรอกเลขบัญชี", "Enter account number")}
            />
          </div>
          <div className="field">
            <label htmlFor="promptPayId">{t("พร้อมเพย์", "PromptPay")}</label>
            <input
              id="promptPayId"
              value={form.promptPayId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  promptPayId: event.target.value,
                }))
              }
              placeholder={t("เบอร์โทรหรือเลขบัตร", "Phone number or ID number")}
            />
          </div>
        </div>

        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row employee-register-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? t("กำลังส่ง...", "Sending...")
              : t("ส่งคำขอลงทะเบียน", "Submit registration")}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => router.push("/login")}
          >
            {t("กลับหน้าเข้าสู่ระบบ", "Back to login")}
          </button>
        </div>
      </form>
    </div>
  )
}
