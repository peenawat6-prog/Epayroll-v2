"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

const WORK_SHIFT_LABELS = {
  MORNING: "กะเช้า",
  AFTERNOON: "กะบ่าย",
  NIGHT: "กะดึก",
} as const

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

export default function EmployeeRegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
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
    bankName: "",
    accountName: "",
    accountNumber: "",
    promptPayId: "",
  })
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [shopOptions, setShopOptions] = useState<ShopOption[]>([])
  const [shopSearchLoading, setShopSearchLoading] = useState(false)
  const [showShopOptions, setShowShopOptions] = useState(false)
  const [branches, setBranches] = useState<PublicBranch[]>([])
  const [loading, setLoading] = useState(false)
  const shopLookupRef = useRef<HTMLDivElement | null>(null)

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
          throw new Error(data.error || "ค้นหาร้านไม่สำเร็จ")
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
  }, [form.shopName])

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
        throw new Error(data.error || "ส่งคำขอลงทะเบียนไม่สำเร็จ")
      }

      setMessage("ส่งคำขอลงทะเบียนแล้ว กรุณารอหัวหน้าอนุมัติ")
      setForm({
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
        bankName: "",
        accountName: "",
        accountNumber: "",
        promptPayId: "",
      })
      setShopOptions([])
      setShowShopOptions(false)
      setBranches([])
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

        <div className="field shop-lookup-field" ref={shopLookupRef}>
          <label htmlFor="shopName">ชื่อร้าน</label>
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
            placeholder="พิมพ์ชื่อร้านเพื่อค้นหา"
          />
          {showShopOptions ? (
            <div className="shop-lookup-list">
              {shopSearchLoading ? (
                <button type="button" className="shop-lookup-option" disabled>
                  กำลังค้นหาร้าน...
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
                  ไม่พบชื่อร้านนี้
                </button>
              )}
            </div>
          ) : null}
          {form.registrationCode ? (
            <div className="table-meta">เลือกแล้ว: {form.shopName}</div>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="branchId">สาขาที่สมัคร</label>
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
                  ? "เลือกสาขา"
                  : "เลือกชื่อร้านก่อน แล้วเลือกสาขา"}
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
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
          <label htmlFor="workShift">กะการทำงานประจำ</label>
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
            <option value="MORNING">{WORK_SHIFT_LABELS.MORNING}</option>
            <option value="AFTERNOON">{WORK_SHIFT_LABELS.AFTERNOON}</option>
            <option value="NIGHT">{WORK_SHIFT_LABELS.NIGHT}</option>
          </select>
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
