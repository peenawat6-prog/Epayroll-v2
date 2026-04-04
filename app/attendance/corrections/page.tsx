'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import {
  formatThaiDate,
  formatThaiDateTime24h,
} from '@/lib/display-time'

type AttendanceRecord = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  checkInPhotoUrl: string | null
  status: string
  employee: {
    id: string
    code: string
    firstName: string
    lastName: string
    position: string
  }
}

type CorrectionItem = {
  id: string
  attendanceId: string
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  requestedStatus: string | null
  requestedWorkDate: string | null
  reason: string
  reviewNote: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  attendance: AttendanceRecord
}

type CurrentUser = {
  role: string
}

function CheckInPhotoThumb({
  photoUrl,
  alt,
}: {
  photoUrl: string | null
  alt: string
}) {
  const [broken, setBroken] = useState(false)

  if (!photoUrl || broken) {
    return <span className="table-meta">ไม่มีรูป / ไฟล์หาย</span>
  }

  return (
    <a href={photoUrl} target="_blank" rel="noreferrer" title="เปิดรูปเข้างาน">
      <img
        src={photoUrl}
        alt={alt}
        className="attendance-photo-thumb"
        onError={() => setBroken(true)}
      />
    </a>
  )
}

export default function AttendanceCorrectionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [corrections, setCorrections] = useState<CorrectionItem[]>([])
  const [selectedAttendanceId, setSelectedAttendanceId] = useState('')
  const [requestedCheckIn, setRequestedCheckIn] = useState('')
  const [requestedCheckOut, setRequestedCheckOut] = useState('')
  const [requestedWorkDate, setRequestedWorkDate] = useState('')
  const [requestedStatus, setRequestedStatus] = useState('')
  const [reason, setReason] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canApprove = useMemo(
    () =>
      user?.role === 'DEV' ||
      user?.role === 'OWNER' ||
      user?.role === 'ADMIN',
    [user],
  )

  const loadData = async () => {
    const correctionParams = new URLSearchParams()
    if (search.trim()) {
      correctionParams.set('search', search.trim())
    }
    if (statusFilter !== 'ALL') {
      correctionParams.set('status', statusFilter)
    }

    const [attendanceRes, correctionsRes] = await Promise.all([
      fetch('/api/attendance'),
      fetch(`/api/attendance/corrections?${correctionParams.toString()}`),
    ])

    const attendanceData = await attendanceRes.json()
    const correctionData = await correctionsRes.json()

    if (!attendanceRes.ok) {
      throw new Error(attendanceData.error || 'โหลด attendance ไม่สำเร็จ')
    }

    if (!correctionsRes.ok) {
      throw new Error(correctionData.error || 'โหลด correction requests ไม่สำเร็จ')
    }

    setRecords(attendanceData)
    setCorrections(correctionData.items ?? [])
  }

  useEffect(() => {
    fetch('/api/me')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then(async (currentUser) => {
        setUser(currentUser)
        await loadData()
        setLoading(false)
      })
      .catch((error: Error) => {
        if (error.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        router.push('/login')
      })
  }, [router])

  useEffect(() => {
    if (!user) {
      return
    }

    loadData().catch((error: Error) => {
      setError(error.message)
    })
  }, [search, statusFilter])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: selectedAttendanceId,
          requestedCheckIn: requestedCheckIn || undefined,
          requestedCheckOut: requestedCheckOut || undefined,
          requestedWorkDate: requestedWorkDate || undefined,
          requestedStatus: requestedStatus || undefined,
          reason,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'สร้าง correction request ไม่สำเร็จ')
      }

      setMessage('ส่งคำขอแก้ไขเวลาเรียบร้อยแล้ว')
      setSelectedAttendanceId('')
      setRequestedCheckIn('')
      setRequestedCheckOut('')
      setRequestedWorkDate('')
      setRequestedStatus('')
      setReason('')
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      if (decision === 'REJECTED' && !reviewNote.trim()) {
        throw new Error('กรุณากรอกหมายเหตุเมื่อปฏิเสธคำขอ')
      }

      const res = await fetch(`/api/attendance/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewNote: reviewNote || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'รีวิว correction request ไม่สำเร็จ')
      }

      setMessage(
        decision === 'APPROVED'
          ? 'อนุมัติคำขอแก้ไขเรียบร้อยแล้ว'
          : 'ปฏิเสธคำขอแก้ไขเรียบร้อยแล้ว',
      )
      setReviewNote('')
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
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
            <div className="badge">Correction requests {corrections.length}</div>
            <div className="badge">Approval by OWNER / ADMIN</div>
          </div>
          <h1 className="hero-title">Attendance Corrections</h1>
          <p className="hero-subtitle">
            ส่งคำขอแก้ไขเวลาและตรวจอนุมัติย้อนหลังโดยยังคง audit trail ครบถ้วน
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/attendance/history')}>
            กลับประวัติลงเวลา
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">ส่งคำขอแก้ไขเวลา</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Attendance record</label>
              <select
                value={selectedAttendanceId}
                onChange={(event) => setSelectedAttendanceId(event.target.value)}
              >
                <option value="">เลือกบันทึกที่ต้องการแก้ไข</option>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.employee.code} - {record.employee.firstName} {record.employee.lastName} -{' '}
                    {formatThaiDate(record.workDate)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันที่ใหม่</label>
              <input
                type="date"
                value={requestedWorkDate}
                onChange={(event) => setRequestedWorkDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาเข้าใหม่</label>
              <input
                type="datetime-local"
                value={requestedCheckIn}
                onChange={(event) => setRequestedCheckIn(event.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาออกใหม่</label>
              <input
                type="datetime-local"
                value={requestedCheckOut}
                onChange={(event) => setRequestedCheckOut(event.target.value)}
              />
            </div>
            <div className="field">
              <label>สถานะใหม่</label>
              <select
                value={requestedStatus}
                onChange={(event) => setRequestedStatus(event.target.value)}
              >
                <option value="">ใช้สถานะเดิม</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="LEAVE">LEAVE</option>
                <option value="DAY_OFF">DAY_OFF</option>
              </select>
            </div>
            <div className="field">
              <label>เหตุผล</label>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="เช่น ลืมกดออกงาน"
              />
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังส่ง...' : 'ส่งคำขอแก้ไข'}
            </button>
          </div>
        </form>
        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">รายการคำขอแก้ไข</h2>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>ค้นหา</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาจากรหัส, ชื่อ, เหตุผล"
            />
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>สถานะคำขอ</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>หมายเหตุสำหรับการอนุมัติ/ปฏิเสธ</label>
            <input
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="กรอก note สำหรับ review"
            />
          </div>
        </div>
        {corrections.length === 0 ? (
          <div className="empty-state">ยังไม่มี correction requests</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>รูปเข้างาน</th>
                  <th>วันที่เดิม</th>
                  <th>สถานะเดิม</th>
                  <th>คำขอใหม่</th>
                  <th>เหตุผล</th>
                  <th>สถานะคำขอ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.attendance.employee.code} {item.attendance.employee.firstName}{' '}
                      {item.attendance.employee.lastName}
                      <div className="table-meta">
                        ขอเมื่อ {formatThaiDateTime24h(item.createdAt)}
                      </div>
                    </td>
                    <td>
                      <CheckInPhotoThumb
                        photoUrl={item.attendance.checkInPhotoUrl}
                        alt={`รูปเข้างานของ ${item.attendance.employee.firstName} ${item.attendance.employee.lastName}`}
                      />
                    </td>
                    <td>{formatThaiDate(item.attendance.workDate)}</td>
                    <td>{item.attendance.status}</td>
                    <td>
                      <div className="table-meta">
                        วันที่: {formatThaiDate(item.requestedWorkDate)}
                      </div>
                      <div className="table-meta">
                        เข้า: {formatThaiDateTime24h(item.requestedCheckIn)}
                      </div>
                      <div className="table-meta">
                        ออก: {formatThaiDateTime24h(item.requestedCheckOut)}
                      </div>
                      <div className="table-meta">สถานะ: {item.requestedStatus ?? '-'}</div>
                    </td>
                    <td>{item.reason}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.status === 'APPROVED'
                            ? 'success'
                            : item.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {canApprove && item.status === 'PENDING' ? (
                        <div className="action-row">
                          <button
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => handleReview(item.id, 'APPROVED')}
                          >
                            อนุมัติ
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={saving}
                            onClick={() => handleReview(item.id, 'REJECTED')}
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      ) : (
                        <span className="table-meta">{item.reviewNote ?? 'ไม่มีหมายเหตุ'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
