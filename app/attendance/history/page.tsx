/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDate } from '@/lib/display-time'
import { useLanguage } from '@/lib/language'

type AttendanceRecord = {
  id: string
  workDate: string
  checkInPhotoUrl: string | null
  checkOutPhotoUrl: string | null
  employee: {
    id: string
    firstName: string
    lastName: string
  }
}

type GroupedAttendanceRecord = {
  workDate: string
  items: AttendanceRecord[]
}

function AttendancePhotoLink({
  photoUrl,
  alt,
  label,
}: {
  photoUrl: string | null
  alt: string
  label: string
}) {
  const [broken, setBroken] = useState(false)

  if (!photoUrl || broken) {
    return null
  }

  return (
    <a
      href={photoUrl}
      target="_blank"
      rel="noreferrer"
      className="table-meta"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      title={label}
    >
      <img
        src={photoUrl}
        alt={alt}
        className="attendance-photo-thumb"
        onError={() => setBroken(true)}
      />
      <span>{label}</span>
    </a>
  )
}

export default function AttendanceHistoryPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then(() =>
        fetch('/api/attendance')
          .then((res) => res.json())
          .then((data) => {
            setRecords(data)
            setLoading(false)
          })
          .catch(() => {
            setRecords([])
            setLoading(false)
          }),
      )
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  const groupedRecords = useMemo<GroupedAttendanceRecord[]>(() => {
    const groups = new Map<string, AttendanceRecord[]>()

    for (const record of records) {
      const key = record.workDate
      const existing = groups.get(key) ?? []
      existing.push(record)
      groups.set(key, existing)
    }

    return Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([workDate, items]) => ({
        workDate,
        items: items.sort((a, b) =>
          `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
            `${b.employee.firstName} ${b.employee.lastName}`,
            'th',
          ),
        ),
      }))
  }, [records])

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
              'ดูย้อนหลังตามวันที่และกดดูรูปยืนยันของพนักงานแต่ละคนได้จากหน้านี้',
              'Review records by date and open each employee verification photo from this page.',
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
        {groupedRecords.length === 0 ? (
          <div className="empty-state">{t('ไม่มีบันทึกการลงเวลา', 'No attendance records')}</div>
        ) : (
          <div className="mobile-card-list">
            {groupedRecords.map((group) => (
              <article key={group.workDate} className="record-card">
                <div className="record-card-head">
                  <strong>{formatThaiDate(group.workDate)}</strong>
                </div>
                <div className="record-card-body">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        paddingTop: 10,
                        paddingBottom: 10,
                        borderBottom: '1px solid rgba(84, 205, 147, 0.18)',
                      }}
                    >
                      <strong>
                        {item.employee.firstName} {item.employee.lastName}
                      </strong>
                      <div
                        className="badge-row"
                        style={{ marginTop: 8, justifyContent: 'flex-start' }}
                      >
                        <AttendancePhotoLink
                          photoUrl={item.checkInPhotoUrl}
                          alt={`${t('รูปเข้างานของ', 'Check-in photo of')} ${item.employee.firstName} ${item.employee.lastName}`}
                          label={t('ดูรูปเข้า', 'Open check-in photo')}
                        />
                        <AttendancePhotoLink
                          photoUrl={item.checkOutPhotoUrl}
                          alt={`${t('รูปออกงานของ', 'Check-out photo of')} ${item.employee.firstName} ${item.employee.lastName}`}
                          label={t('ดูรูปออก', 'Open check-out photo')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
