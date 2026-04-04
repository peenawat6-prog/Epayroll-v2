'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LogoutButton from '@/app/components/logout-button'
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

const ROLE_LABELS: Record<UserRole, string> = {
  DEV: 'ผู้ดูแลระบบ Dev',
  OWNER: 'เจ้าของร้าน',
  ADMIN: 'ผู้จัดการร้าน',
  HR: 'ฝ่ายบุคคล',
  FINANCE: 'ฝ่ายการเงิน',
  EMPLOYEE: 'พนักงาน',
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
            <div className="badge">สิทธิ์: {ROLE_LABELS[user.role]}</div>
            <div className="badge">รหัสร้าน: {user.tenantId}</div>
          </div>
          <h1 className="hero-title">หน้าแรกของร้าน</h1>
          <p className="hero-subtitle">
            ดูภาพรวมพนักงาน การลงเวลา และงานที่ต้องจัดการในแต่ละวันได้จากหน้านี้
          </p>
        </div>

        <div className="action-row">
          {canOpenEmployees(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/employees')}>
              สรุปข้อมูลพนักงาน
            </button>
          ) : null}
          {canOpenAttendance(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
              ลงเวลาเข้าออก
            </button>
          ) : null}
          {canOpenAttendanceReport(user.role) ? (
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/attendance/history')}
            >
              รายงานการลงเวลา
            </button>
          ) : null}
          {canOpenAttendanceCorrections(user.role) ? (
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/attendance/corrections')}
            >
              แก้ไขการลงเวลา
              {summary?.pendingAttendanceCorrections ? (
                <span className="notification-badge">
                  {summary.pendingAttendanceCorrections}
                </span>
              ) : null}
            </button>
          ) : null}
          {canOpenStaffRequests(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
              คำขอพนักงาน
              {summary?.pendingTotalRequests ? (
                <span className="notification-badge">
                  {summary.pendingTotalRequests}
                </span>
              ) : null}
            </button>
          ) : null}
          {canOpenPayroll(user.role) ? (
            <button className="btn btn-primary" onClick={() => router.push('/payroll')}>
              สรุปเงินเดือน
            </button>
          ) : null}
          {canOpenOps(user.role) ? (
            <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
              ตั้งค่าร้าน
            </button>
          ) : null}
          <LogoutButton />
        </div>
      </section>

      {!summary ? (
        <div className="panel">กำลังโหลดข้อมูล dashboard...</div>
      ) : (
        <>
          <section className="grid stats">
            <article className="stat-card">
              <p className="stat-label">พนักงานที่ใช้งานอยู่</p>
              <p className="stat-value">{summary.totalEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">เข้างานแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ออกงานแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedOutToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ยังไม่มีการลงเวลา</p>
              <p className="stat-value">{summary.absentToday}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">สถานะ Subscription</h2>
            <p className="panel-subtitle">
              แพ็กเกจ {summary.subscription.plan} / สถานะ {summary.subscription.status}
            </p>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                วันคงเหลือ: {summary.subscription.daysRemaining ?? 'ไม่ได้กำหนด'}
              </div>
              <div className="badge">
                หมดอายุ:{' '}
                {summary.subscription.expiresAt
                  ? new Date(summary.subscription.expiresAt).toLocaleDateString('th-TH')
                  : 'ไม่ได้กำหนด'}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">เมนูที่ใช้บ่อย</h2>
            <div className="action-row" style={{ marginTop: 14 }}>
              {canOpenAttendanceCorrections(user.role) ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => router.push('/attendance/corrections')}
                >
                  แก้ไขการลงเวลา
                  {summary.pendingAttendanceCorrections ? (
                    <span className="notification-badge">
                      {summary.pendingAttendanceCorrections}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canOpenStaffRequests(user.role) ? (
                <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
                  ดูคำขอลา/OT/ลาออก
                  {summary.pendingStaffRequests ? (
                    <span className="notification-badge">
                      {summary.pendingStaffRequests}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {canOpenOps(user.role) ? (
                <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
                  ตั้งค่าร้าน
                </button>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
