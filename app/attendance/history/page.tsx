/* eslint-disable @next/next/no-img-element */
'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDate, formatThaiTime24h } from '@/lib/display-time'
import { useLanguage } from '@/lib/language'
import { getAttendanceStatusLabel } from '@/lib/ui-format'

type AttendanceRecord = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  checkInPhotoUrl: string | null
  checkOutPhotoUrl: string | null
  checkedOutBySystem: boolean
  status: string
  employee: {
    id: string
    firstName: string
    lastName: string
  }
}

type CurrentUser = {
  role: string
}

type ExpandedPhoto = {
  attendanceId: string
  kind: 'check-in' | 'check-out'
} | null

function toDatetimeLocalValue(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function AttendancePhotoPreview({
  photoUrl,
  alt,
  missingLabel,
}: {
  photoUrl: string | null
  alt: string
  missingLabel: string
}) {
  const [broken, setBroken] = useState(false)

  if (!photoUrl || broken) {
    return <div className="table-meta">{missingLabel}</div>
  }

  return (
    <a href={photoUrl} target="_blank" rel="noreferrer" title={alt}>
      <img
        src={photoUrl}
        alt={alt}
        className="attendance-photo-thumb"
        onError={() => setBroken(true)}
        style={{ marginTop: 8 }}
      />
    </a>
  )
}

export default function AttendanceHistoryPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState('')
  const [editCheckIn, setEditCheckIn] = useState('')
  const [editCheckOut, setEditCheckOut] = useState('')
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto>(null)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const canDirectEdit =
    user?.role === 'DEV' ||
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'HR'

  const loadRecords = () => {
    setLoading(true)
    return fetch('/api/attendance')
      .then((res) => res.json())
      .then((data) => {
        setRecords(data)
        setLoading(false)
      })
      .catch(() => {
        setRecords([])
        setLoading(false)
      })
  }

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then((currentUser) => {
        setUser(currentUser)
        return loadRecords()
      })
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  const togglePhoto = (attendanceId: string, kind: 'check-in' | 'check-out') => {
    setExpandedPhoto((current) =>
      current?.attendanceId === attendanceId && current.kind === kind
        ? null
        : { attendanceId, kind },
    )
  }

  const startEditing = (record: AttendanceRecord) => {
    setMessage('')
    setErrorMessage('')
    setEditingId(record.id)
    setEditCheckIn(toDatetimeLocalValue(record.checkIn))
    setEditCheckOut(toDatetimeLocalValue(record.checkOut))
  }

  const cancelEditing = () => {
    setEditingId('')
    setEditCheckIn('')
    setEditCheckOut('')
  }

  const saveAttendanceUpdate = async (attendanceId: string) => {
    setSaving(true)
    setMessage('')
    setErrorMessage('')

    try {
      const res = await fetch(`/api/attendance/${attendanceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkIn: editCheckIn || null,
          checkOut: editCheckOut || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error ||
            t('บันทึกการแก้ไขเวลาไม่สำเร็จ', 'Failed to update attendance time.'),
        )
      }

      setMessage(
        t(
          'บันทึกเวลาเข้าออกงานเรียบร้อยแล้ว ระบบจะคำนวณเวลาและค่าแรงจากข้อมูลใหม่อัตโนมัติ',
          'Attendance updated. Payroll will use the updated time automatically.',
        ),
      )
      cancelEditing()
      await loadRecords()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('บันทึกการแก้ไขเวลาไม่สำเร็จ', 'Failed to update attendance time.'),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t('รายการล่าสุด', 'Latest records')}</div>
          </div>
          <h1 className="hero-title">{t('ประวัติการลงเวลา', 'Attendance history')}</h1>
          <p className="hero-subtitle">
            {t(
              'ดูวันที่ ชื่อพนักงาน เวลาเข้าออก สถานะ และกดดูรูปยืนยันได้จากหน้านี้',
              'Review date, employee name, check-in/out time, status, and verification photos.',
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
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            {t('คำขอแก้เวลา', 'Correction requests')}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {message ? <div className="message message-success">{message}</div> : null}
        {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
        {records.length === 0 ? (
          <div className="empty-state">{t('ไม่มีบันทึกการลงเวลา', 'No attendance records')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('วันที่', 'Date')}</th>
                  <th>{t('ชื่อพนักงาน', 'Employee name')}</th>
                  <th>{t('เวลาเข้า', 'Check-in')}</th>
                  <th>{t('เวลาออก', 'Check-out')}</th>
                  <th>{t('สถานะ', 'Status')}</th>
                  <th>{t('การจัดการ', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const fullName = `${record.employee.firstName} ${record.employee.lastName}`
                  const showingCheckInPhoto =
                    expandedPhoto?.attendanceId === record.id &&
                    expandedPhoto.kind === 'check-in'
                  const showingCheckOutPhoto =
                    expandedPhoto?.attendanceId === record.id &&
                    expandedPhoto.kind === 'check-out'

                  return (
                    <Fragment key={record.id}>
                      <tr>
                        <td>{formatThaiDate(record.workDate)}</td>
                        <td>
                          <div>
                            <strong>{fullName}</strong>
                          </div>
                          <div className="action-row" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => togglePhoto(record.id, 'check-in')}
                            >
                              {t('รูปเข้า', 'Check-in photo')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={() => togglePhoto(record.id, 'check-out')}
                            >
                              {t('รูปออก', 'Check-out photo')}
                            </button>
                          </div>
                          {showingCheckInPhoto ? (
                            <AttendancePhotoPreview
                              photoUrl={record.checkInPhotoUrl}
                              alt={`${t('รูปเข้างานของ', 'Check-in photo of')} ${fullName}`}
                              missingLabel={t('ไม่มีรูปเข้างาน', 'No check-in photo')}
                            />
                          ) : null}
                          {showingCheckOutPhoto ? (
                            <AttendancePhotoPreview
                              photoUrl={record.checkOutPhotoUrl}
                              alt={`${t('รูปออกงานของ', 'Check-out photo of')} ${fullName}`}
                              missingLabel={t('ไม่มีรูปออกงาน', 'No check-out photo')}
                            />
                          ) : null}
                        </td>
                        <td>{formatThaiTime24h(record.checkIn)}</td>
                        <td>
                          <div>{formatThaiTime24h(record.checkOut)}</div>
                          {record.checkedOutBySystem ? (
                            <div className="table-meta">
                              {t('ออกงานโดยระบบ', 'Checked out by system')}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              record.status === 'LATE'
                                ? 'warning'
                                : record.status === 'ABSENT'
                                  ? 'danger'
                                  : 'success'
                            }`}
                          >
                            {getAttendanceStatusLabel(record.status, language)}
                          </span>
                        </td>
                        <td>
                          {canDirectEdit ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => startEditing(record)}
                            >
                              {editingId === record.id
                                ? t('กำลังแก้ไข', 'Editing')
                                : t('แก้ไขเวลา', 'Edit time')}
                            </button>
                          ) : (
                            <span className="table-meta">-</span>
                          )}
                        </td>
                      </tr>
                      {canDirectEdit && editingId === record.id ? (
                        <tr>
                          <td colSpan={6}>
                            <article className="record-card">
                              <div className="record-card-head">
                                <strong>{t('แก้ไขเวลาเข้าออกงาน', 'Edit attendance time')}</strong>
                              </div>
                              <div className="record-card-body">
                                <div className="field">
                                  <label>{t('วันและเวลาเข้าใหม่', 'New check-in date and time')}</label>
                                  <input
                                    type="datetime-local"
                                    step={60}
                                    value={editCheckIn}
                                    onChange={(event) => setEditCheckIn(event.target.value)}
                                  />
                                </div>
                                <div className="field" style={{ marginTop: 12 }}>
                                  <label>{t('วันและเวลาออกใหม่', 'New check-out date and time')}</label>
                                  <input
                                    type="datetime-local"
                                    step={60}
                                    value={editCheckOut}
                                    onChange={(event) => setEditCheckOut(event.target.value)}
                                  />
                                </div>
                                <div className="table-meta" style={{ marginTop: 10 }}>
                                  {t(
                                    'เมื่อบันทึกแล้ว ระบบจะอัปเดต attendance จริงทันที และ payroll จะคำนวณจากเวลาใหม่อัตโนมัติ',
                                    'Saving will update the real attendance record immediately and payroll will use the updated time automatically.',
                                  )}
                                </div>
                              </div>
                              <div className="action-row" style={{ marginTop: 14 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={saving}
                                  onClick={() => saveAttendanceUpdate(record.id)}
                                >
                                  {saving
                                    ? t('กำลังบันทึก...', 'Saving...')
                                    : t('บันทึกเวลาใหม่', 'Save updated time')}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  disabled={saving}
                                  onClick={cancelEditing}
                                >
                                  {t('ยกเลิก', 'Cancel')}
                                </button>
                              </div>
                            </article>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
