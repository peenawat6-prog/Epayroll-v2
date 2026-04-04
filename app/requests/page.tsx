'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import {
  formatThaiDate,
  formatThaiDateTime24h,
} from '@/lib/display-time'

type CurrentUser = {
  role: string
}

type EmployeeOption = {
  id: string
  code: string
  firstName: string
  lastName: string
  active: boolean
}

type StaffRequestItem = {
  id: string
  kind: 'LEAVE' | 'OVERTIME' | 'EARLY_CHECKOUT' | 'RESIGNATION'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reason: string | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
  employeeCode: string
  employeeName: string
  employeePosition: string
  startDate: string | null
  endDate: string | null
  workDate: string | null
  overtimeMinutes: number | null
  lastWorkDate: string | null
}

const KIND_LABELS = {
  LEAVE: 'ขอลางาน',
  OVERTIME: 'ขออนุมัติ OT',
  EARLY_CHECKOUT: 'ขอกลับก่อนเวลา',
  RESIGNATION: 'ยื่นลาออก',
} as const

const STATUS_LABELS = {
  PENDING: 'รอตรวจ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ไม่อนุมัติ',
} as const

function formatDate(value: string | null) {
  return formatThaiDate(value)
}

function formatDateTime(value: string | null) {
  return formatThaiDateTime24h(value)
}

function getDetailText(item: StaffRequestItem) {
  if (item.kind === 'LEAVE') {
    return `ลา ${formatDate(item.startDate)} ถึง ${formatDate(item.endDate)}`
  }

  if (item.kind === 'OVERTIME') {
    return `วันที่ ${formatDate(item.workDate)} / ${((item.overtimeMinutes ?? 0) / 60).toFixed(2)} ชม.`
  }

  if (item.kind === 'EARLY_CHECKOUT') {
    return `ขอกลับก่อนเวลา วันที่ ${formatDate(item.workDate)}`
  }

  return `ทำงานวันสุดท้าย ${formatDate(item.lastWorkDate)}`
}

export default function StaffRequestsPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [requests, setRequests] = useState<StaffRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [overtimeForm, setOvertimeForm] = useState({
    employeeId: '',
    workDate: '',
    overtimeHours: '',
    reason: '',
  })
  const [resignationForm, setResignationForm] = useState({
    employeeId: '',
    lastWorkDate: '',
    reason: '',
  })
  const [earlyCheckoutForm, setEarlyCheckoutForm] = useState({
    employeeId: '',
    workDate: '',
    reason: '',
  })

  const canReview =
    user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'HR'

  const loadRequests = async () => {
    const res = await fetch('/api/staff-requests')
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'โหลดคำขอไม่สำเร็จ')
    }

    setRequests(data)
  }

  useEffect(() => {
    let mounted = true

    Promise.all([
      fetch('/api/me').then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      }),
      fetch('/api/employees').then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'โหลดรายชื่อพนักงานไม่สำเร็จ')
        return data
      }),
      fetch('/api/staff-requests').then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'โหลดคำขอไม่สำเร็จ')
        return data
      }),
    ])
      .then(([currentUser, employeeRows, requestRows]) => {
        if (!mounted) return
        setUser(currentUser)
        setEmployees(employeeRows)
        setRequests(requestRows)
        setLoading(false)
      })
      .catch((error: Error) => {
        if (!mounted) return

        if (error.message === 'subscription' || error.message === 'unauthorized') {
          router.push(
            error.message === 'subscription' ? '/subscription-expired' : '/login',
          )
          return
        }

        setErrorMessage(error.message)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [router])

  const submitRequest = async (
    body: Record<string, unknown>,
    onDone: () => void,
    successText: string,
  ) => {
    setSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      const res = await fetch('/api/staff-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'ส่งคำขอไม่สำเร็จ')
      }

      onDone()
      await loadRequests()
      setMessage(successText)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const reviewRequest = async (
    id: string,
    kind: StaffRequestItem['kind'],
    status: 'APPROVED' | 'REJECTED',
  ) => {
    setSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      const res = await fetch(`/api/staff-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind,
          status,
          reviewNote: reviewNotes[id] ?? '',
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'ตรวจคำขอไม่สำเร็จ')
      }

      await loadRequests()
      setMessage(status === 'APPROVED' ? 'อนุมัติคำขอเรียบร้อยแล้ว' : 'บันทึกการไม่อนุมัติเรียบร้อยแล้ว')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ตรวจคำขอไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">เมนูคำขอพนักงาน</div>
            <div className="badge">สิทธิ์: {user?.role}</div>
            {requests.filter((item) => item.status === 'PENDING').length ? (
              <div className="badge">
                รอตรวจ {requests.filter((item) => item.status === 'PENDING').length} คำขอ
              </div>
            ) : null}
          </div>
          <h1 className="hero-title">ขอลางาน / ขอ OT / ยื่นลาออก</h1>
          <p className="hero-subtitle">
            ส่งคำขอล่วงหน้า และให้หัวหน้าตรวจอนุมัติได้จากหน้าเดียว รวมถึงการขอกลับก่อนเวลา
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
            กลับหน้าลงเวลา
          </button>
          <LogoutButton />
        </div>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {errorMessage ? (
        <div className="message message-error">{errorMessage}</div>
      ) : null}

      <section className="grid stats">
        <article className="panel">
          <h2 className="panel-title">ขอลางาน</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>พนักงาน</label>
              <select
                value={leaveForm.employeeId}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, employeeId: e.target.value })
                }
              >
                <option value="">เลือกพนักงาน</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันที่เริ่มลา</label>
              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, startDate: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>วันที่สิ้นสุด</label>
              <input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, endDate: e.target.value })
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>เหตุผลการลา</label>
            <textarea
              rows={3}
              value={leaveForm.reason}
              onChange={(e) =>
                setLeaveForm({ ...leaveForm, reason: e.target.value })
              }
            />
          </div>
          <div className="action-row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={() =>
                submitRequest(
                  { kind: 'LEAVE', ...leaveForm },
                  () =>
                    setLeaveForm({
                      employeeId: '',
                      startDate: '',
                      endDate: '',
                      reason: '',
                    }),
                  'ส่งคำขอลางานเรียบร้อยแล้ว',
                )
              }
            >
              ส่งคำขอลางาน
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">ขออนุมัติ OT</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>พนักงาน</label>
              <select
                value={overtimeForm.employeeId}
                onChange={(e) =>
                  setOvertimeForm({ ...overtimeForm, employeeId: e.target.value })
                }
              >
                <option value="">เลือกพนักงาน</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันที่ทำ OT</label>
              <input
                type="date"
                value={overtimeForm.workDate}
                onChange={(e) =>
                  setOvertimeForm({ ...overtimeForm, workDate: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>จำนวนชั่วโมง</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={overtimeForm.overtimeHours}
                onChange={(e) =>
                  setOvertimeForm({
                    ...overtimeForm,
                    overtimeHours: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>เหตุผลขอ OT</label>
            <textarea
              rows={3}
              value={overtimeForm.reason}
              onChange={(e) =>
                setOvertimeForm({ ...overtimeForm, reason: e.target.value })
              }
            />
          </div>
          <div className="action-row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={() =>
                submitRequest(
                  { kind: 'OVERTIME', ...overtimeForm },
                  () =>
                    setOvertimeForm({
                      employeeId: '',
                      workDate: '',
                      overtimeHours: '',
                      reason: '',
                    }),
                  'ส่งคำขอ OT เรียบร้อยแล้ว',
                )
              }
            >
              ส่งคำขอ OT
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">ยื่นลาออก</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>พนักงาน</label>
              <select
                value={resignationForm.employeeId}
                onChange={(e) =>
                  setResignationForm({
                    ...resignationForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">เลือกพนักงาน</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันทำงานวันสุดท้าย</label>
              <input
                type="date"
                value={resignationForm.lastWorkDate}
                onChange={(e) =>
                  setResignationForm({
                    ...resignationForm,
                    lastWorkDate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>เหตุผลลาออก</label>
            <textarea
              rows={3}
              value={resignationForm.reason}
              onChange={(e) =>
                setResignationForm({ ...resignationForm, reason: e.target.value })
              }
            />
          </div>
          <div className="action-row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-danger"
              disabled={saving}
              onClick={() =>
                submitRequest(
                  { kind: 'RESIGNATION', ...resignationForm },
                  () =>
                    setResignationForm({
                      employeeId: '',
                      lastWorkDate: '',
                      reason: '',
                    }),
                  'ส่งคำขอลาออกเรียบร้อยแล้ว',
                )
              }
            >
              ส่งคำขอลาออก
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">ขอกลับก่อนเวลา</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>พนักงาน</label>
              <select
                value={earlyCheckoutForm.employeeId}
                onChange={(e) =>
                  setEarlyCheckoutForm({
                    ...earlyCheckoutForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">เลือกพนักงาน</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันที่ต้องการกลับก่อน</label>
              <input
                type="date"
                value={earlyCheckoutForm.workDate}
                onChange={(e) =>
                  setEarlyCheckoutForm({
                    ...earlyCheckoutForm,
                    workDate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>เหตุผลกลับก่อนเวลา</label>
            <textarea
              rows={3}
              value={earlyCheckoutForm.reason}
              onChange={(e) =>
                setEarlyCheckoutForm({
                  ...earlyCheckoutForm,
                  reason: e.target.value,
                })
              }
            />
          </div>
          <div className="action-row" style={{ marginTop: 14 }}>
            <button
              className="btn btn-primary"
              disabled={saving}
              onClick={() =>
                submitRequest(
                  { kind: 'EARLY_CHECKOUT', ...earlyCheckoutForm },
                  () =>
                    setEarlyCheckoutForm({
                      employeeId: '',
                      workDate: '',
                      reason: '',
                    }),
                  'ส่งคำขอกลับก่อนเวลาเรียบร้อยแล้ว',
                )
              }
            >
              ส่งคำขอกลับก่อนเวลา
            </button>
          </div>
        </article>
      </section>

      <section className="panel">
        <h2 className="panel-title">รายการคำขอล่าสุด</h2>
        {requests.length === 0 ? (
          <div className="empty-state">ยังไม่มีคำขอพนักงาน</div>
        ) : (
          <div style={{ marginTop: 16 }}>
            {requests.map((item) => (
              <article key={`${item.kind}-${item.id}`} className="record-card">
                <div className="record-card-head">
                  <div>
                    <strong>
                      {item.employeeCode} - {item.employeeName}
                    </strong>
                    <div className="table-meta">{item.employeePosition}</div>
                  </div>
                  <span
                    className={`status-pill ${
                      item.status === 'APPROVED'
                        ? 'success'
                        : item.status === 'REJECTED'
                          ? 'danger'
                          : 'warning'
                    }`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </div>

                <div className="record-card-body">
                  <div className="record-line">
                    <span>ประเภทคำขอ</span>
                    <strong>{KIND_LABELS[item.kind]}</strong>
                  </div>
                  <div className="record-line">
                    <span>รายละเอียด</span>
                    <strong>{getDetailText(item)}</strong>
                  </div>
                  <div className="record-line">
                    <span>วันที่ส่ง</span>
                    <strong>{formatDateTime(item.createdAt)}</strong>
                  </div>
                  <div className="record-line">
                    <span>เหตุผล</span>
                    <strong>{item.reason || '-'}</strong>
                  </div>
                  <div className="record-line">
                    <span>หมายเหตุผู้ตรวจ</span>
                    <strong>{item.reviewNote || '-'}</strong>
                  </div>
                </div>

                {canReview && item.status === 'PENDING' ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="field">
                      <label>หมายเหตุผู้ตรวจ</label>
                      <textarea
                        rows={2}
                        value={reviewNotes[item.id] ?? ''}
                        onChange={(e) =>
                          setReviewNotes({
                            ...reviewNotes,
                            [item.id]: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="action-row" style={{ marginTop: 12 }}>
                      <button
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => reviewRequest(item.id, item.kind, 'APPROVED')}
                      >
                        อนุมัติ
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={saving}
                        onClick={() => reviewRequest(item.id, item.kind, 'REJECTED')}
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
