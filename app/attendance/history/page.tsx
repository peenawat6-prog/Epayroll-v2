'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDate, formatThaiTime24h } from '@/lib/display-time'

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
  }
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

export default function AttendanceHistoryPage() {
  const router = useRouter()
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
            <div className="badge">ย้อนหลังล่าสุด 90 รายการ</div>
          </div>
          <h1 className="hero-title">ประวัติการลงเวลา</h1>
          <p className="hero-subtitle">สำหรับเจ้าของร้าน ฝ่ายบุคคล และการตรวจสอบย้อนหลัง</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
            กลับหน้าลงเวลา
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            ขอแก้ไขเวลา
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {records.length === 0 ? (
          <div className="empty-state">ไม่มีบันทึกการลงเวลา</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสพนักงาน</th>
                  <th>ชื่อพนักงาน</th>
                  <th>วันที่</th>
                  <th>รูปเข้างาน</th>
                  <th>เวลาเข้า</th>
                  <th>เวลาออก</th>
                  <th>สถานะ</th>
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
                        alt={`รูปเข้างานของ ${r.employee.firstName} ${r.employee.lastName}`}
                      />
                    </td>
                    <td>{formatThaiTime24h(r.checkIn)}</td>
                    <td>{formatThaiTime24h(r.checkOut)}</td>
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
                        {r.status}
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
