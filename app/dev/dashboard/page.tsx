"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import LogoutButton from "@/app/components/logout-button"
import { formatThaiDateTime24h } from "@/lib/display-time"
import { useLanguage } from "@/lib/language"
import { getSubscriptionStatusLabel as getSubscriptionTextLabel } from "@/lib/ui-format"

type ShopRequest = {
  id: string
  shopName: string
  branchName: string
  ownerFirstName: string
  ownerLastName: string
  ownerPhone: string | null
  ownerEmail: string
  registrationCode: string | null
  payrollPayday: number
  morningShiftStartMinutes: number
  morningShiftEndMinutes: number
  afternoonShiftStartMinutes: number
  afternoonShiftEndMinutes: number
  nightShiftStartMinutes: number
  nightShiftEndMinutes: number
  latitude: number
  longitude: number
  allowedRadiusMeters: number
  requestedSubscriptionDays: number
  salesAgentId: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  salesAgent: {
    id: string
    code: string
    firstName: string
    lastName: string
  } | null
}

type TenantItem = {
  id: string
  name: string
  registrationCode: string
  subscriptionPlan: string
  subscriptionStatus: string
  subscriptionExpiresAt: string | null
  isPubliclyVisible: boolean
  createdAt: string
  salesAgent: {
    id: string
    code: string
    firstName: string
    lastName: string
  } | null
  _count: {
    employees: number
    branches: number
  }
}

type SalesRequest = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  lineId: string | null
  status: "PENDING" | "APPROVED" | "REJECTED"
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}

type SalesAgentSummary = {
  id: string
  code: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
  lineId: string | null
  commissionPerShopBaht: number
  createdAt: string
  commissionMonth: number
  commissionYear: number
  commissionShopCount: number
  commissionAmountBaht: number
  tenants: Array<{
    id: string
    name: string
    registrationCode: string
    subscriptionStatus: string
    subscriptionExpiresAt: string | null
  }>
  _count: {
    tenants: number
  }
}

type SalesAgentForm = {
  firstName: string
  lastName: string
  phone: string
  email: string
  lineId: string
}

const DEFAULT_SALES_AGENT_FORM: SalesAgentForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  lineId: "",
}

function formatMinutes(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function getDaysRemaining(expiresAt: string | null) {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function getRequestStatusLabel(status: string) {
  if (status === "APPROVED") return "อนุมัติแล้ว"
  if (status === "REJECTED") return "ไม่อนุมัติ"
  return "รออนุมัติ"
}

function getSubscriptionStatusLabel(status: string) {
  return getSubscriptionTextLabel(status, "th")
}

function getStatusPillClass(status: string) {
  if (status === "APPROVED" || status === "ACTIVE") return "status-pill success"
  if (status === "REJECTED" || status === "EXPIRED") return "status-pill danger"
  return "status-pill warning"
}

function getSalesAgentName(
  agent: { code: string; firstName: string; lastName: string } | null,
) {
  if (!agent) return "ไม่ได้ระบุเซลล์"
  return `${agent.firstName} ${agent.lastName} (${agent.code})`
}

export default function DevDashboardPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const now = new Date()
  const [requests, setRequests] = useState<ShopRequest[]>([])
  const [salesRequests, setSalesRequests] = useState<SalesRequest[]>([])
  const [salesAgents, setSalesAgents] = useState<SalesAgentSummary[]>([])
  const [salesAgentForm, setSalesAgentForm] = useState<SalesAgentForm>(
    DEFAULT_SALES_AGENT_FORM,
  )
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [commissionMonth, setCommissionMonth] = useState(
    String(now.getMonth() + 1),
  )
  const [commissionYear, setCommissionYear] = useState(
    String(now.getFullYear()),
  )
  const [subscriptionDaysByRequestId, setSubscriptionDaysByRequestId] = useState<Record<string, string>>({})
  const [reviewNoteByRequestId, setReviewNoteByRequestId] = useState<Record<string, string>>({})
  const [salesReviewNoteByRequestId, setSalesReviewNoteByRequestId] = useState<Record<string, string>>({})
  const [extraDaysByTenantId, setExtraDaysByTenantId] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadDashboard = async (
    nextMonth = Number(commissionMonth),
    nextYear = Number(commissionYear),
  ) => {
    const meRes = await fetch("/api/me")
    if (!meRes.ok) {
      throw new Error(meRes.status === 402 ? "subscription" : "unauthorized")
    }
    const me = await meRes.json()

    if (me?.role !== "DEV") {
      router.push(me?.role === "EMPLOYEE" ? "/employee" : "/dashboard")
      return
    }

    const res = await fetch(
      `/api/dev/shop-dashboard?commissionMonth=${nextMonth}&commissionYear=${nextYear}`,
    )
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "โหลดข้อมูลร้านไม่สำเร็จ")
    }

    setRequests(data.requests ?? [])
    setSalesRequests(data.salesRequests ?? [])
    setSalesAgents(data.salesAgents ?? [])
    setTenants(data.tenants ?? [])
  }

  useEffect(() => {
    let mounted = true

    loadDashboard()
      .then(() => {
        if (mounted) setLoading(false)
      })
      .catch((caughtError: Error) => {
        if (!mounted) return
        if (caughtError.message === "unauthorized") {
          router.push("/login")
          return
        }
        setError(caughtError.message)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [router])

  const reviewRequest = async (requestId: string, decision: "APPROVED" | "REJECTED") => {
    setSavingId(requestId)
    setError("")
    setMessage("")

    try {
      const res = await fetch(`/api/dev/shop-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          reviewNote: reviewNoteByRequestId[requestId] || undefined,
          subscriptionDays: Number(subscriptionDaysByRequestId[requestId] || 365),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "บันทึกคำขอเปิดร้านไม่สำเร็จ")
      }

      setMessage(
        decision === "APPROVED"
          ? "อนุมัติร้านใหม่เรียบร้อยแล้ว"
          : "ไม่อนุมัติคำขอเปิดร้านเรียบร้อยแล้ว",
      )
      await loadDashboard()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "บันทึกคำขอเปิดร้านไม่สำเร็จ",
      )
    } finally {
      setSavingId(null)
    }
  }

  const reviewSalesRequest = async (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    setSavingId(requestId)
    setError("")
    setMessage("")

    try {
      const res = await fetch(`/api/dev/sales-requests/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
          reviewNote: salesReviewNoteByRequestId[requestId] || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "บันทึกคำขอเซลล์ไม่สำเร็จ")
      }

      setMessage(
        decision === "APPROVED"
          ? "อนุมัติเซลล์เรียบร้อยแล้ว"
          : "ไม่อนุมัติคำขอเซลล์เรียบร้อยแล้ว",
      )
      await loadDashboard()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "บันทึกคำขอเซลล์ไม่สำเร็จ",
      )
    } finally {
      setSavingId(null)
    }
  }

  const createSalesAgent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingId("create-sales-agent")
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/dev/sales-agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salesAgentForm),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "เพิ่มเซลล์ไม่สำเร็จ")
      }

      setSalesAgentForm(DEFAULT_SALES_AGENT_FORM)
      setMessage(data.message || "เพิ่มเซลล์เรียบร้อยแล้ว")
      await loadDashboard()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "เพิ่มเซลล์ไม่สำเร็จ",
      )
    } finally {
      setSavingId(null)
    }
  }

  const extendSubscription = async (tenantId: string) => {
    setSavingId(tenantId)
    setError("")
    setMessage("")

    try {
      const res = await fetch(`/api/dev/tenants/${tenantId}/subscription`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extraDays: Number(extraDaysByTenantId[tenantId] || 30),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "ต่ออายุร้านไม่สำเร็จ")
      }

      setMessage("ต่ออายุร้านค้าเรียบร้อยแล้ว")
      await loadDashboard()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ต่ออายุร้านไม่สำเร็จ",
      )
    } finally {
      setSavingId(null)
    }
  }

  const updateTenantVisibility = async (
    tenantId: string,
    isPubliclyVisible: boolean,
  ) => {
    setSavingId(tenantId)
    setError("")
    setMessage("")

    try {
      const res = await fetch(`/api/dev/tenants/${tenantId}/visibility`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isPubliclyVisible,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "ปรับการแสดงร้านไม่สำเร็จ")
      }

      setMessage(
        isPubliclyVisible
          ? "เปิดให้ค้นหาร้านนี้ได้แล้ว"
          : "ซ่อนร้านนี้จากหน้าลงทะเบียนแล้ว",
      )
      await loadDashboard()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ปรับการแสดงร้านไม่สำเร็จ",
      )
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>
  }

  const pendingShopCount = requests.filter(
    (request) => request.status === "PENDING",
  ).length
  const pendingSalesCount = salesRequests.filter(
    (request) => request.status === "PENDING",
  ).length
  const totalCommission = salesAgents.reduce(
    (sum, agent) => sum + agent.commissionAmountBaht,
    0,
  )

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">แดชบอร์ดทีมซัพพอร์ต</div>
            <div className="badge">ร้านรออนุมัติ {pendingShopCount}</div>
            <div className="badge">เซลล์รออนุมัติ {pendingSalesCount}</div>
            <div className="badge">ร้านค้าทั้งหมด {tenants.length} ร้าน</div>
          </div>
          <h1 className="hero-title">แดชบอร์ดทีมซัพพอร์ต</h1>
          <p className="hero-subtitle">
            อนุมัติร้านใหม่ อนุมัติเซลล์ ดูวันหมดอายุร้าน และสรุปค่าคอมรายเดือน
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push("/audit")}>
            {t("ดูประวัติระบบ", "Audit log")}
          </button>
          <LogoutButton />
        </div>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      <section className="panel">
        <h2 className="panel-title">สรุปค่าคอมเซลล์รายเดือน</h2>
        <p className="panel-subtitle">
          คิดค่าคอม 50 บาทต่อร้านต่อเดือน ถ้าร้านยังไม่หมดอายุในเดือนที่เลือก
        </p>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label>เดือน</label>
            <select
              value={commissionMonth}
              onChange={(event) => setCommissionMonth(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
                (monthValue) => (
                  <option key={monthValue} value={monthValue}>
                    {monthValue}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="field">
            <label>ปี</label>
            <input
              type="number"
              value={commissionYear}
              onChange={(event) => setCommissionYear(event.target.value)}
            />
          </div>
        </div>

        <div className="action-row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              loadDashboard(Number(commissionMonth), Number(commissionYear))
            }
          >
            ดูสรุปค่าคอม
          </button>
          <div className="badge">ยอดรวม {totalCommission} บาท</div>
        </div>

        {salesAgents.length === 0 ? (
          <div className="empty-state">ยังไม่มีเซลล์ที่อนุมัติแล้ว</div>
        ) : (
          <div className="mobile-card-list" style={{ marginTop: 16 }}>
            {salesAgents.map((agent) => (
              <article key={agent.id} className="record-card">
                <div className="record-card-head">
                  <strong>
                    {agent.firstName} {agent.lastName}
                  </strong>
                  <span className="status-pill success">
                    {agent.commissionAmountBaht} บาท
                  </span>
                </div>
                <div className="record-card-body">
                  <div className="record-line">
                    <span>รหัสเซลล์</span>
                    <strong>{agent.code}</strong>
                  </div>
                  <div className="record-line">
                    <span>ร้านที่นับค่าคอมเดือนนี้</span>
                    <strong>{agent.commissionShopCount} ร้าน</strong>
                  </div>
                  <div className="record-line">
                    <span>ร้านที่ผูกกับเซลล์ทั้งหมด</span>
                    <strong>{agent._count.tenants} ร้าน</strong>
                  </div>
                  <div className="record-line">
                    <span>เบอร์โทร</span>
                    <strong>{agent.phone || "-"}</strong>
                  </div>
                  <div className="record-line">
                    <span>LINE ID</span>
                    <strong>{agent.lineId || "-"}</strong>
                  </div>
                </div>
                {agent.tenants.length ? (
                  <div className="table-meta" style={{ marginTop: 10 }}>
                    ร้านที่นับรอบนี้: {" "}
                    {agent.tenants
                      .map((tenant) => `${tenant.name} (${tenant.registrationCode})`)
                      .join(", ")}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">เพิ่มเซลล์ใหม่</h2>
        <p className="panel-subtitle">
          ทีมซัพพอร์ตสร้างเซลล์ในหน้านี้ได้เลย เซลล์จะพร้อมให้ร้านเลือกทันที
        </p>

        <form onSubmit={createSalesAgent}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>ชื่อ</label>
              <input
                value={salesAgentForm.firstName}
                onChange={(event) =>
                  setSalesAgentForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>นามสกุล</label>
              <input
                value={salesAgentForm.lastName}
                onChange={(event) =>
                  setSalesAgentForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>เบอร์โทร</label>
              <input
                value={salesAgentForm.phone}
                onChange={(event) =>
                  setSalesAgentForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>อีเมล</label>
              <input
                type="email"
                value={salesAgentForm.email}
                onChange={(event) =>
                  setSalesAgentForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>LINE ID</label>
              <input
                value={salesAgentForm.lineId}
                onChange={(event) =>
                  setSalesAgentForm((current) => ({
                    ...current,
                    lineId: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="action-row" style={{ marginTop: 16 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingId === "create-sales-agent"}
            >
              เพิ่มเซลล์
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">คำขอลงทะเบียนเซลล์</h2>
        <p className="panel-subtitle">
          ทีมซัพพอร์ตอนุมัติเซลล์ก่อน เซลล์ถึงจะถูกเลือกได้ตอนร้านสมัคร
        </p>

        {salesRequests.length === 0 ? (
          <div className="empty-state">ยังไม่มีคำขอลงทะเบียนเซลล์</div>
        ) : (
          <div className="mobile-card-list" style={{ marginTop: 16 }}>
            {salesRequests.map((request) => (
              <article key={request.id} className="record-card">
                <div className="record-card-head">
                  <strong>
                    {request.firstName} {request.lastName}
                  </strong>
                  <span className={getStatusPillClass(request.status)}>
                    {getRequestStatusLabel(request.status)}
                  </span>
                </div>
                <div className="record-card-body">
                  <div className="record-line">
                    <span>อีเมล</span>
                    <strong>{request.email}</strong>
                  </div>
                  <div className="record-line">
                    <span>เบอร์โทร</span>
                    <strong>{request.phone || "-"}</strong>
                  </div>
                  <div className="record-line">
                    <span>LINE ID</span>
                    <strong>{request.lineId || "-"}</strong>
                  </div>
                  <div className="record-line">
                    <span>วันที่ส่งคำขอ</span>
                    <strong>{formatThaiDateTime24h(request.createdAt)}</strong>
                  </div>
                  <div className="record-line">
                    <span>หมายเหตุซัพพอร์ต</span>
                    <strong>{request.reviewNote || "-"}</strong>
                  </div>
                </div>

                {request.status === "PENDING" ? (
                  <>
                    <div className="field" style={{ marginTop: 14 }}>
                      <label>หมายเหตุซัพพอร์ต</label>
                      <input
                        value={salesReviewNoteByRequestId[request.id] ?? ""}
                        onChange={(event) =>
                          setSalesReviewNoteByRequestId((current) => ({
                            ...current,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="action-row" style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingId === request.id}
                        onClick={() =>
                          reviewSalesRequest(request.id, "APPROVED")
                        }
                      >
                        อนุมัติเซลล์
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={savingId === request.id}
                        onClick={() =>
                          reviewSalesRequest(request.id, "REJECTED")
                        }
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">คำขอเปิดร้านใหม่</h2>
        <p className="panel-subtitle">
          ทีมซัพพอร์ตเท่านั้นที่อนุมัติร้านใหม่ได้ เจ้าของร้านจะล็อกอินได้หลังอนุมัติแล้ว
        </p>

        {requests.length === 0 ? (
          <div className="empty-state">ยังไม่มีคำขอเปิดร้าน</div>
        ) : (
          <div className="mobile-card-list" style={{ marginTop: 16 }}>
            {requests.map((request) => (
              <article key={request.id} className="record-card">
                <div className="record-card-head">
                  <strong>{request.shopName}</strong>
                  <span className={getStatusPillClass(request.status)}>
                    {getRequestStatusLabel(request.status)}
                  </span>
                </div>
                <div className="record-card-body">
                  <div className="record-line">
                    <span>สาขาหลัก</span>
                    <strong>{request.branchName}</strong>
                  </div>
                  <div className="record-line">
                    <span>เจ้าของร้าน</span>
                    <strong>
                      {request.ownerFirstName} {request.ownerLastName}
                    </strong>
                  </div>
                  <div className="record-line">
                    <span>เซลล์ผู้ขาย</span>
                    <strong>{getSalesAgentName(request.salesAgent)}</strong>
                  </div>
                  <div className="record-line">
                    <span>อีเมลเจ้าของ</span>
                    <strong>{request.ownerEmail}</strong>
                  </div>
                  <div className="record-line">
                    <span>เบอร์โทร</span>
                    <strong>{request.ownerPhone ?? "-"}</strong>
                  </div>
                  <div className="record-line">
                    <span>ตำแหน่งร้าน</span>
                    <strong>
                      ตั้งค่าแล้ว ({request.allowedRadiusMeters} เมตร)
                    </strong>
                  </div>
                  <div className="record-line">
                    <span>วันจ่ายเงินเดือน</span>
                    <strong>{request.payrollPayday}</strong>
                  </div>
                  <div className="record-line">
                    <span>กะเช้า</span>
                    <strong>
                      {formatMinutes(request.morningShiftStartMinutes)} - {" "}
                      {formatMinutes(request.morningShiftEndMinutes)}
                    </strong>
                  </div>
                  <div className="record-line">
                    <span>กะบ่าย</span>
                    <strong>
                      {formatMinutes(request.afternoonShiftStartMinutes)} - {" "}
                      {formatMinutes(request.afternoonShiftEndMinutes)}
                    </strong>
                  </div>
                  <div className="record-line">
                    <span>กะดึก</span>
                    <strong>
                      {formatMinutes(request.nightShiftStartMinutes)} - {" "}
                      {formatMinutes(request.nightShiftEndMinutes)}
                    </strong>
                  </div>
                  <div className="record-line">
                    <span>วันที่ส่งคำขอ</span>
                    <strong>{formatThaiDateTime24h(request.createdAt)}</strong>
                  </div>
                  <div className="record-line">
                    <span>หมายเหตุซัพพอร์ต</span>
                    <strong>{request.reviewNote ?? "-"}</strong>
                  </div>
                </div>

                {request.status === "PENDING" ? (
                  <>
                    <div className="form-grid" style={{ marginTop: 14 }}>
                      <div className="field">
                        <label>จำนวนวันที่เปิดใช้งาน</label>
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          value={subscriptionDaysByRequestId[request.id] ?? "365"}
                          onChange={(event) =>
                            setSubscriptionDaysByRequestId((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>หมายเหตุซัพพอร์ต</label>
                        <input
                          value={reviewNoteByRequestId[request.id] ?? ""}
                          onChange={(event) =>
                            setReviewNoteByRequestId((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          placeholder="ถ้าไม่อนุมัติ ควรกรอกเหตุผล"
                        />
                      </div>
                    </div>
                    <div className="action-row" style={{ marginTop: 14 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={savingId === request.id}
                        onClick={() => reviewRequest(request.id, "APPROVED")}
                      >
                        อนุมัติเปิดร้าน
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={savingId === request.id}
                        onClick={() => reviewRequest(request.id, "REJECTED")}
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">ร้านค้าที่อยู่ในระบบ</h2>
        <p className="panel-subtitle">
          ดูวันหมดอายุร้าน เพิ่มวันใช้งาน และซ่อนร้านที่ไม่ต้องการให้พนักงานค้นเจอ
        </p>

        {tenants.length === 0 ? (
          <div className="empty-state">ยังไม่มีร้านค้าในระบบ</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ร้าน</th>
                  <th>เซลล์ผู้ขาย</th>
                  <th>สถานะร้าน</th>
                  <th>ค้นหาในหน้าลงทะเบียน</th>
                  <th>วันหมดอายุ</th>
                  <th>วันคงเหลือ</th>
                  <th>สาขา</th>
                  <th>พนักงาน</th>
                  <th>เพิ่มวัน</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const daysRemaining = getDaysRemaining(
                    tenant.subscriptionExpiresAt,
                  )

                  return (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.name}</strong>
                        <div className="table-meta">
                          เริ่มใช้ {formatThaiDateTime24h(tenant.createdAt)}
                        </div>
                      </td>
                      <td>{getSalesAgentName(tenant.salesAgent)}</td>
                      <td>
                        <span
                          className={getStatusPillClass(
                            tenant.subscriptionStatus,
                          )}
                        >
                          {getSubscriptionStatusLabel(
                            tenant.subscriptionStatus,
                          )}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            tenant.isPubliclyVisible
                              ? "status-pill success"
                              : "status-pill danger"
                          }
                        >
                          {tenant.isPubliclyVisible ? "แสดงอยู่" : "ซ่อนอยู่"}
                        </span>
                      </td>
                      <td>
                        {tenant.subscriptionExpiresAt
                          ? formatThaiDateTime24h(tenant.subscriptionExpiresAt)
                          : "-"}
                      </td>
                      <td>
                        {daysRemaining === null ? "-" : `${daysRemaining} วัน`}
                      </td>
                      <td>{tenant._count.branches}</td>
                      <td>{tenant._count.employees}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          value={extraDaysByTenantId[tenant.id] ?? "30"}
                          onChange={(event) =>
                            setExtraDaysByTenantId((current) => ({
                              ...current,
                              [tenant.id]: event.target.value,
                            }))
                          }
                          style={{ minWidth: 88 }}
                        />
                      </td>
                      <td>
                        <div className="stacked-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={savingId === tenant.id}
                            onClick={() => extendSubscription(tenant.id)}
                          >
                            เพิ่มวันใช้งาน
                          </button>
                          <button
                            type="button"
                            className={
                              tenant.isPubliclyVisible
                                ? "btn btn-danger"
                                : "btn btn-secondary"
                            }
                            disabled={savingId === tenant.id}
                            onClick={() =>
                              updateTenantVisibility(
                                tenant.id,
                                !tenant.isPubliclyVisible,
                              )
                            }
                          >
                            {tenant.isPubliclyVisible
                              ? "ซ่อนร้าน"
                              : "เปิดแสดงร้าน"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
