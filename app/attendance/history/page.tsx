/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState } from 'react'
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
    code: string
    firstName: string
    lastName: string
  }
}

function CheckInPhotoThumb({
  photoUrl,
  alt,
  missingLabel,
  openTitle,
}: {
  photoUrl: string | null
  alt: string
  missingLabel: string
  openTitle: string
}) {
  const [broken, setBroken] = useState(false)

  if (!photoUrl || broken) {
    return <span className="table-meta">{missingLabel}</span>
  }

  return (
    <a href={photoUrl} target="_blank" rel="noreferrer" title={openTitle}>
      <img
        src={photoUrl}
        alt={alt}
        className="attendance-photo-thumb"
        onError={() => setBroken(true)}
      />
    </a>
  )
}

export default function AttendanceHistoryPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then(() => {
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
      })
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

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
              'ดูเวลาเข้าออกงานและรูปยืนยันตัวตนย้อนหลังได้ที่นี่',
              'Review attendance times and verification photos here.',
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
            {t('ขอแก้ไขเวลา', 'Request time correction')}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {records.length === 0 ? (
          <div className="empty-state">{t('ไม่มีบันทึกการลงเวลา', 'No attendance records')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('รหัสพนักงาน', 'Employee code')}</th>
                  <th>{t('ชื่อพนักงาน', 'Employee name')}</th>
                  <th>{t('วันที่', 'Date')}</th>
                  <th>{t('รูปเข้างาน', 'Check-in photo')}</th>
                  <th>{t('รูปออกงาน', 'Check-out photo')}</th>
                  <th>{t('เวลาเข้า', 'Check-in')}</th>
                  <th>{t('เวลาออก', 'Check-out')}</th>
                  <th>{t('สถานะ', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employee.code}</td>
                    <td>{`${r.employee.firstName} ${r.employee.lastName}`}</td>
                    <td>{formatThaiDate(r.workDate)}</td>
                    <td>
                      <CheckInPhotoThumb
                        photoUrl={r.checkInPhotoUrl}
                        alt={`${t('รูปเข้างานของ', 'Check-in photo of')} ${r.employee.firstName} ${r.employee.lastName}`}
                        missingLabel={t('ไม่มีรูป / ไฟล์หาย', 'No photo / missing file')}
                        openTitle={t('เปิดรูปเข้างาน', 'Open check-in photo')}
                      />
                    </td>
                    <td>
                      <CheckInPhotoThumb
                        photoUrl={r.checkOutPhotoUrl}
                        alt={`${t('รูปออกงานของ', 'Check-out photo of')} ${r.employee.firstName} ${r.employee.lastName}`}
                        missingLabel={t('ยังไม่มีรูปออกงาน', 'No check-out photo yet')}
                        openTitle={t('เปิดรูปออกงาน', 'Open check-out photo')}
                      />
                    </td>
                    <td>{formatThaiTime24h(r.checkIn)}</td>
                    <td>
                      <div>{formatThaiTime24h(r.checkOut)}</div>
                      {r.checkedOutBySystem ? (
                        <div className="table-meta">
                          {t("ออกงานโดยระบบ", "Checked out by system")}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          r.status === 'LATE'
                            ? 'warning'
                            : r.status === 'ABSENT'
                              ? 'danger'
                              : 'success'
                        }`}
                      >
                        {getAttendanceStatusLabel(r.status, language)}
                      </span>
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
