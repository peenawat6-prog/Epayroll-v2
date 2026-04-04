'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'
import { getRoleLabel, getSubscriptionStatusLabel } from '@/lib/ui-format'
import type { UserRole } from '@prisma/client'

type CurrentUser = {
  id: string
  email: string
  role: UserRole
  tenantId: string
}

type Summary = {
  totalEmployees: number
  checkedInToday: number
  checkedOutToday: number
  absentToday: number
  pendingEmployeeRegistrations: number
  pendingStaffRequests: number
  pendingAttendanceCorrections: number
  pendingTotalRequests: number
  subscription: {
    plan: string
    status: string
    expiresAt: string | null
    daysRemaining: number | null
  }
}

function canOpenEmployees(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN', 'HR', 'FINANCE'].includes(role)
}

function canOpenAttendance(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN', 'HR'].includes(role)
}

function canOpenAttendanceReport(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN', 'HR', 'FINANCE'].includes(role)
}

function canOpenAttendanceCorrections(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN'].includes(role)
}

function canOpenStaffRequests(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN', 'HR'].includes(role)
}

function canOpenPayroll(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN', 'FINANCE'].includes(role)
}

function canOpenOps(role: UserRole) {
  return ['DEV', 'OWNER', 'ADMIN'].includes(role)
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    Promise.all([
      fetch('/api/me').then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      }),
      fetch('/api/dashboard-summary').then((res) => {
        if (!res.ok) throw new Error('summary')
        return res.json()
      }),
    ])
      .then(([currentUser, summaryData]) => {
        if (!mounted) return
        setUser(currentUser)
        setSummary(summaryData)
        setLoading(false)
      })
      .catch((error: Error) => {
        if (!mounted) return
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })

    return () => {
      mounted = false
    }
  }, [router])

  if (loading) {
    return <div className="page">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{getRoleLabel(user.role, language)}</div>
            </div>
          <h1 className="hero-title">{t('หน้าแรกของร้าน', 'Shop dashboard')}</h1>
          <p className="hero-subtitle">
            {t(
              'ดูภาพรวมพนักงาน การลงเวลา และงานที่ต้องจัดการในแต่ละวันได้จากหน้านี้',
              'Track staff, attendance, and daily actions from this dashboard.',
            )}
          </p>
        </div>

        <div className="action-row">
          {canOpenEmployees(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/employees')}>
              {t('สรุปข้อมูลพนักงาน', 'Employee summary')}
            </button>
          ) : null}
          {canOpenAttendance(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
              {t('ลงเวลาเข้าออก', 'Clock in/out')}
            </button>
          ) : null}
          {canOpenAttendanceReport(user.role) ? (
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/attendance/history')}
            >
              {t('รายงานการลงเวลา', 'Attendance report')}
            </button>
          ) : null}
          {canOpenAttendanceCorrections(user.role) ? (
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/attendance/corrections')}
            >
              {t('แก้ไขการลงเวลา', 'Fix attendance')}
              {summary?.pendingAttendanceCorrections ? (
                <span className="notification-badge">
                  {summary.pendingAttendanceCorrections}
                </span>
              ) : null}
            </button>
          ) : null}
          {canOpenStaffRequests(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
              {t('คำขอพนักงาน', 'Staff requests')}
              {summary?.pendingTotalRequests ? (
                <span className="notification-badge">
                  {summary.pendingTotalRequests}
                </span>
              ) : null}
            </button>
          ) : null}
          {canOpenPayroll(user.role) ? (
            <button className="btn btn-primary" onClick={() => router.push('/payroll')}>
              {t('สรุปเงินเดือน', 'Payroll summary')}
            </button>
          ) : null}
          {canOpenOps(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
              {t('ตั้งค่าร้าน', 'Shop settings')}
            </button>
          ) : null}
          <button
            className="btn btn-secondary"
            onClick={() => window.open('/api/manual/user-manual', '_blank')}
          >
            {t('ดาวน์โหลดคู่มือ PDF', 'Download PDF manual')}
          </button>
          <LogoutButton />
        </div>
      </section>

      {!summary ? (
        <div className="panel">{t('กำลังโหลดข้อมูล dashboard...', 'Loading dashboard data...')}</div>
      ) : (
        <>
          <section className="grid stats">
            <article className="stat-card">
              <p className="stat-label">{t('พนักงานที่ใช้งานอยู่', 'Active employees')}</p>
              <p className="stat-value">{summary.totalEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('เข้างานแล้ววันนี้', 'Checked in today')}</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('ออกงานแล้ววันนี้', 'Checked out today')}</p>
              <p className="stat-value">{summary.checkedOutToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('ยังไม่มีการลงเวลา', 'Not checked in yet')}</p>
              <p className="stat-value">{summary.absentToday}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('สถานะ Subscription', 'Subscription status')}</h2>
            <p className="panel-subtitle">
              {t('สถานะการใช้งาน', 'Subscription')}:{' '}
              {getSubscriptionStatusLabel(summary.subscription.status, language)}
            </p>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                {t('วันคงเหลือ', 'Days left')}:{' '}
                {summary.subscription.daysRemaining ?? t('ไม่ได้กำหนด', 'Not set')}
              </div>
              <div className="badge">
                {t('หมดอายุ', 'Expires')}:{' '}
                {summary.subscription.expiresAt
                  ? new Date(summary.subscription.expiresAt).toLocaleDateString(
                      language === 'th' ? 'th-TH' : 'en-US',
                    )
                  : t('ไม่ได้กำหนด', 'Not set')}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('เมนูที่ใช้บ่อย', 'Quick actions')}</h2>
            <div className="action-row" style={{ marginTop: 14 }}>
              {canOpenAttendanceCorrections(user.role) ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => router.push('/attendance/corrections')}
                >
                  {t('แก้ไขการลงเวลา', 'Fix attendance')}
                  {summary.pendingAttendanceCorrections ? (
                    <span className="notification-badge">
                      {summary.pendingAttendanceCorrections}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canOpenStaffRequests(user.role) ? (
                <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
                  {t('ดูคำขอลา/OT/ลาออก', 'Leave / OT / resignation requests')}
                  {summary.pendingStaffRequests ? (
                    <span className="notification-badge">
                      {summary.pendingStaffRequests}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canOpenOps(user.role) ? (
                <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
                  {t('ตั้งค่าร้าน', 'Shop settings')}
                </button>
              ) : null}
              <button
                className="btn btn-secondary"
                onClick={() => window.open('/api/manual/user-manual', '_blank')}
              >
                {t('ดาวน์โหลดคู่มือ PDF', 'Download PDF manual')}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
