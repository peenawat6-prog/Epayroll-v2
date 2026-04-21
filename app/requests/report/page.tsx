'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDate, formatThaiDateTime24h } from '@/lib/display-time'
import { useLanguage } from '@/lib/language'
import { getRequestStatusLabel } from '@/lib/ui-format'

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

function getRequestKindLabel(kind: StaffRequestItem['kind'], t: (th: string, en: string) => string) {
  if (kind === 'LEAVE') return t('ขอลางาน', 'Leave request')
  if (kind === 'OVERTIME') return t('ขออนุมัติ OT', 'OT request')
  if (kind === 'EARLY_CHECKOUT') return t('ขอกลับก่อนเวลา', 'Early checkout request')
  return t('ยื่นลาออก', 'Resignation request')
}

function getDetailText(item: StaffRequestItem, t: (th: string, en: string) => string) {
  if (item.kind === 'LEAVE') {
    return `${formatThaiDate(item.startDate)} - ${formatThaiDate(item.endDate)}`
  }

  if (item.kind === 'OVERTIME') {
    return `${formatThaiDate(item.workDate)} / ${((item.overtimeMinutes ?? 0) / 60).toFixed(2)} ${t('ชม.', 'hrs')}`
  }

  if (item.kind === 'EARLY_CHECKOUT') {
    return formatThaiDate(item.workDate)
  }

  return formatThaiDate(item.lastWorkDate)
}

export default function StaffRequestReportPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [requests, setRequests] = useState<StaffRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then(() => fetch('/api/staff-requests'))
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || t('โหลดรายงานคำขอไม่สำเร็จ', 'Failed to load request report'))
        }
        setRequests(data)
        setLoading(false)
      })
      .catch((error: Error) => {
        if (error.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        if (error.message === 'unauthorized') {
          router.push('/login')
          return
        }

        setErrorMessage(error.message)
        setLoading(false)
      })
  }, [router, t])

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t('ทั้งหมด', 'Total')} {requests.length}</div>
          </div>
          <h1 className="hero-title">{t('รายงานคำขอทั้งหมด', 'All request report')}</h1>
          <p className="hero-subtitle">
            {t(
              'รวมคำขอทุกสถานะ ทั้งรอตรวจ อนุมัติ ไม่อนุมัติ และคำขอที่เลยวันที่เกี่ยวข้องแล้ว',
              'All request statuses are shown here, including pending, approved, rejected, and past requests.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
            {t('กลับหน้าคำขอ', 'Back to requests')}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
        {requests.length === 0 ? (
          <div className="empty-state">{t('ยังไม่มีคำขอในระบบ', 'No requests yet')}</div>
        ) : (
          <div className="mobile-card-list">
            {requests.map((item) => (
              <article key={`${item.kind}-${item.id}`} className="record-card">
                <div className="record-card-head">
                  <div>
                    <strong>{item.employeeCode} - {item.employeeName}</strong>
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
                    {getRequestStatusLabel(item.status, language)}
                  </span>
                </div>
                <div className="record-card-body">
                  <div className="record-line">
                    <span>{t('ประเภทคำขอ', 'Request type')}</span>
                    <strong>{getRequestKindLabel(item.kind, t)}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('รายละเอียด', 'Details')}</span>
                    <strong>{getDetailText(item, t)}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('วันที่ส่ง', 'Submitted at')}</span>
                    <strong>{formatThaiDateTime24h(item.createdAt)}</strong>
                  </div>
                  <div className="record-line">
                    <span>{t('วันที่ตรวจ', 'Reviewed at')}</span>
                    <strong>{formatThaiDateTime24h(item.reviewedAt)}</strong>
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
