'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'
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

function formatDate(value: string | null) {
  return formatThaiDate(value)
}

function formatDateTime(value: string | null) {
  return formatThaiDateTime24h(value)
}

function getDetailText(item: StaffRequestItem, t: (th: string, en: string) => string) {
  if (item.kind === 'LEAVE') {
    return `${t('ลา', 'Leave from')} ${formatDate(item.startDate)} ${t('ถึง', 'to')} ${formatDate(item.endDate)}`
  }

  if (item.kind === 'OVERTIME') {
    return `${t('วันที่', 'Date')} ${formatDate(item.workDate)} / ${((item.overtimeMinutes ?? 0) / 60).toFixed(2)} ${t('ชม.', 'hrs')}`
  }

  if (item.kind === 'EARLY_CHECKOUT') {
    return `${t('ขอกลับก่อนเวลา วันที่', 'Leave early on')} ${formatDate(item.workDate)}`
  }

  return `${t('ทำงานวันสุดท้าย', 'Last work date')} ${formatDate(item.lastWorkDate)}`
}

export default function StaffRequestsPage() {
  const router = useRouter()
  const { t } = useLanguage()
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
  const kindLabels = {
    LEAVE: t('ขอลางาน', 'Leave request'),
    OVERTIME: t('ขออนุมัติ OT', 'OT request'),
    EARLY_CHECKOUT: t('ขอกลับก่อนเวลา', 'Early checkout request'),
    RESIGNATION: t('ยื่นลาออก', 'Resignation request'),
  } as const

  const statusLabels = {
    PENDING: t('รอตรวจ', 'Pending'),
    APPROVED: t('อนุมัติแล้ว', 'Approved'),
    REJECTED: t('ไม่อนุมัติ', 'Rejected'),
  } as const

  const loadRequests = async () => {
    const res = await fetch('/api/staff-requests')
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || t('โหลดคำขอไม่สำเร็จ', 'Failed to load requests'))
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
        if (!res.ok) {
          throw new Error(
            data.error || t('โหลดรายชื่อพนักงานไม่สำเร็จ', 'Failed to load employees'),
          )
        }
        return data
      }),
      fetch('/api/staff-requests').then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('โหลดคำขอไม่สำเร็จ', 'Failed to load requests'))
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
        throw new Error(data.error || t('ส่งคำขอไม่สำเร็จ', 'Failed to submit request'))
      }

      onDone()
      await loadRequests()
      setMessage(successText)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('ส่งคำขอไม่สำเร็จ', 'Failed to submit request'),
      )
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
        throw new Error(data.error || t('ตรวจคำขอไม่สำเร็จ', 'Failed to review request'))
      }

      await loadRequests()
      setMessage(
        status === 'APPROVED'
          ? t('อนุมัติคำขอเรียบร้อยแล้ว', 'Request approved')
          : t('บันทึกการไม่อนุมัติเรียบร้อยแล้ว', 'Request rejection saved'),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('ตรวจคำขอไม่สำเร็จ', 'Failed to review request'),
      )
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
            <div className="badge">{t('เมนูคำขอพนักงาน', 'Staff request menu')}</div>
            <div className="badge">{t('สิทธิ์', 'Role')}: {user?.role}</div>
            {requests.filter((item) => item.status === 'PENDING').length ? (
              <div className="badge">
                {t('รอตรวจ', 'Pending')}{' '}
                {requests.filter((item) => item.status === 'PENDING').length}{' '}
                {t('คำขอ', 'requests')}
              </div>
            ) : null}
          </div>
          <h1 className="hero-title">
            {t('ขอลางาน / ขอ OT / ยื่นลาออก', 'Leave / OT / resignation requests')}
          </h1>
          <p className="hero-subtitle">
            {t(
              'ส่งคำขอล่วงหน้า และให้หัวหน้าตรวจอนุมัติได้จากหน้าเดียว รวมถึงการขอกลับก่อนเวลา',
              'Submit advance requests and let managers approve in one place, including early checkout.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
            {t('กลับหน้าลงเวลา', 'Back to attendance')}
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
          <h2 className="panel-title">{t('ขอลางาน', 'Leave request')}</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t('พนักงาน', 'Employee')}</label>
              <select
                value={leaveForm.employeeId}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, employeeId: e.target.value })
                }
              >
                <option value="">{t('เลือกพนักงาน', 'Select employee')}</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('วันที่เริ่มลา', 'Leave start date')}</label>
              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, startDate: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>{t('วันที่สิ้นสุด', 'Leave end date')}</label>
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
            <label>{t('เหตุผลการลา', 'Leave reason')}</label>
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
                  t('ส่งคำขอลางานเรียบร้อยแล้ว', 'Leave request submitted'),
                )
              }
            >
              {t('ส่งคำขอลางาน', 'Submit leave request')}
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">{t('ขออนุมัติ OT', 'OT request')}</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t('พนักงาน', 'Employee')}</label>
              <select
                value={overtimeForm.employeeId}
                onChange={(e) =>
                  setOvertimeForm({ ...overtimeForm, employeeId: e.target.value })
                }
              >
                <option value="">{t('เลือกพนักงาน', 'Select employee')}</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('วันที่ทำ OT', 'OT date')}</label>
              <input
                type="date"
                value={overtimeForm.workDate}
                onChange={(e) =>
                  setOvertimeForm({ ...overtimeForm, workDate: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label>{t('จำนวนชั่วโมง', 'Hours')}</label>
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
            <label>{t('เหตุผลขอ OT', 'OT reason')}</label>
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
                  t('ส่งคำขอ OT เรียบร้อยแล้ว', 'OT request submitted'),
                )
              }
            >
              {t('ส่งคำขอ OT', 'Submit OT request')}
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">{t('ยื่นลาออก', 'Resignation request')}</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t('พนักงาน', 'Employee')}</label>
              <select
                value={resignationForm.employeeId}
                onChange={(e) =>
                  setResignationForm({
                    ...resignationForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">{t('เลือกพนักงาน', 'Select employee')}</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('วันทำงานวันสุดท้าย', 'Last work date')}</label>
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
            <label>{t('เหตุผลลาออก', 'Resignation reason')}</label>
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
                  t('ส่งคำขอลาออกเรียบร้อยแล้ว', 'Resignation request submitted'),
                )
              }
            >
              {t('ส่งคำขอลาออก', 'Submit resignation')}
            </button>
          </div>
        </article>

        <article className="panel">
          <h2 className="panel-title">{t('ขอกลับก่อนเวลา', 'Early checkout request')}</h2>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t('พนักงาน', 'Employee')}</label>
              <select
                value={earlyCheckoutForm.employeeId}
                onChange={(e) =>
                  setEarlyCheckoutForm({
                    ...earlyCheckoutForm,
                    employeeId: e.target.value,
                  })
                }
              >
                <option value="">{t('เลือกพนักงาน', 'Select employee')}</option>
                {employees.filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.firstName} {item.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('วันที่ต้องการกลับก่อน', 'Early checkout date')}</label>
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
            <label>{t('เหตุผลกลับก่อนเวลา', 'Reason')}</label>
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
                  t('ส่งคำขอกลับก่อนเวลาเรียบร้อยแล้ว', 'Early checkout request submitted'),
                )
              }
            >
              {t('ส่งคำขอกลับก่อนเวลา', 'Submit early checkout')}
            </button>
          </div>
        </article>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t('รายการคำขอล่าสุด', 'Latest requests')}</h2>
        {requests.length === 0 ? (
          <div className="empty-state">{t('ยังไม่มีคำขอพนักงาน', 'No requests yet')}</div>
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
                    {statusLabels[item.status]}
                  </span>
                </div>

                <div className="record-card-body">
                  <div className="record-line">
                    <span>{t('ประเภทคำขอ', 'Request type')}</span>
                    <strong>{kindLabels[item.kind]}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('รายละเอียด', 'Details')}</span>
                    <strong>{getDetailText(item, t)}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('วันที่ส่ง', 'Submitted at')}</span>
                    <strong>{formatDateTime(item.createdAt)}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('เหตุผล', 'Reason')}</span>
                    <strong>{item.reason || '-'}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('หมายเหตุผู้ตรวจ', 'Reviewer note')}</span>
                    <strong>{item.reviewNote || '-'}</strong>
                  </div>
                </div>

                {canReview && item.status === 'PENDING' ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="field">
                      <label>{t('หมายเหตุผู้ตรวจ', 'Reviewer note')}</label>
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
                        {t('อนุมัติ', 'Approve')}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={saving}
                        onClick={() => reviewRequest(item.id, item.kind, 'REJECTED')}
                      >
                        {t('ไม่อนุมัติ', 'Reject')}
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
