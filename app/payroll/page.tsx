'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'
import {
  formatThaiDate,
  formatThaiDateTime24h,
} from '@/lib/display-time'

type PayrollSummaryItem = {
  employeeId: string
  employeeCode: string
  employeeName: string
  payType: string
  presentDays: number
  absentDays: number
  workedHours: number
  overtimeHours: number
  lateMinutes: number
  basePay: number
  overtimePay: number
  deduction: number
  netPay: number
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  promptPayId: string | null
  paymentStatus: string
}

type PayrollResponse = {
  month: number
  year: number
  payday: number
  periodStart: string
  periodEnd: string
  status: 'OPEN' | 'LOCKED'
  locked: boolean
  lockedAt: string | null
  lockedByUserId: string | null
  source: 'preview' | 'saved' | 'locked'
  items: PayrollSummaryItem[]
}

export default function PayrollPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [summary, setSummary] = useState<PayrollSummaryItem[]>([])
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [paymentSavingId, setPaymentSavingId] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [csvReady, setCsvReady] = useState(false)
  const [periodInfo, setPeriodInfo] = useState<PayrollResponse | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const today = new Date()
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const canUnlock = userRole === 'OWNER'
  const canUnlockCurrentPeriod =
    canUnlock &&
    Boolean(periodInfo?.locked) &&
    Boolean(
      periodInfo && Date.now() <= new Date(periodInfo.periodEnd).getTime(),
    )

  const loadPayroll = () => {
    setLoading(true)
    setErrorMessage('')
    fetch(`/api/payroll/run?month=${month}&year=${year}`)
      .then(async (res) => {
        const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || t('โหลด payroll ไม่สำเร็จ', 'Failed to load payroll'))
      }
      return data as PayrollResponse
      })
      .then((data: PayrollResponse) => {
        setPeriodInfo(data)
        setSummary(data.items ?? [])
        setLoading(false)
      })
      .catch((error: Error) => {
        setSummary([])
        setPeriodInfo(null)
        setErrorMessage(error.message)
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
        setUserRole(currentUser.role)
        loadPayroll()
      })
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  const persistPayroll = async (action: 'save' | 'lock' | 'unlock') => {
    setSaving(true)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const body: Record<string, unknown> = {
        month: Number(month),
        year: Number(year),
        action,
      }

      if (action === 'unlock') {
        body.reason = unlockReason
      }

      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('บันทึก payroll ไม่สำเร็จ', 'Failed to save payroll'))
      }

      setPeriodInfo(data)
      setSummary(data.items ?? [])
      setStatusMessage(
        action === 'lock'
          ? t('ยืนยันสรุปเงินเดือนเรียบร้อยแล้ว', 'Payroll summary confirmed')
          : action === 'unlock'
            ? t('เปิดงวดเงินเดือนกลับมาแก้ไขได้แล้ว', 'Payroll period reopened')
            : t('บันทึกสรุปเงินเดือนเรียบร้อยแล้ว', 'Payroll summary saved'),
      )
      if (action === 'unlock') {
        setUnlockReason('')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('เกิดข้อผิดพลาด', 'Something went wrong'))
    } finally {
      setSaving(false)
    }
  }

  const updatePaymentStatus = async (
    employeeId: string,
    paymentStatus: 'PAID' | 'FAILED' | 'PENDING',
  ) => {
    setPaymentSavingId(employeeId)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const res = await fetch('/api/payroll/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId,
          month: Number(month),
          year: Number(year),
          paymentStatus,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('อัปเดตสถานะการโอนไม่สำเร็จ', 'Failed to update payment status'))
      }

      await loadPayroll()
      setStatusMessage(
        paymentStatus === 'PAID'
          ? t('อัปเดตสถานะเป็นโอนแล้วเรียบร้อย', 'Marked as paid')
          : paymentStatus === 'FAILED'
            ? t('บันทึกสถานะโอนไม่สำเร็จเรียบร้อย', 'Marked as failed')
            : t('เปลี่ยนสถานะกลับเป็นรอโอนเรียบร้อย', 'Moved back to pending'),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t('อัปเดตสถานะการโอนไม่สำเร็จ', 'Failed to update payment status'),
      )
    } finally {
      setPaymentSavingId('')
    }
  }

  const exportCsv = async () => {
    if (summary.length === 0) return

    const header = [
      'employeeCode',
      'employeeName',
      'payType',
      'presentDays',
      'absentDays',
      'workedHours',
      'overtimeHours',
      'lateMinutes',
      'basePay',
      'overtimePay',
      'deduction',
      'netPay',
      'bankName',
      'accountNumber',
      'promptPayId',
      'paymentStatus',
    ]
    const rows = summary.map(item => [
      item.employeeCode,
      item.employeeName,
      item.payType,
      item.presentDays.toString(),
      item.absentDays.toString(),
      item.workedHours.toFixed(2),
      item.overtimeHours.toFixed(2),
      item.lateMinutes.toString(),
      item.basePay.toFixed(2),
      item.overtimePay.toFixed(2),
      item.deduction.toFixed(2),
      item.netPay.toFixed(2),
      item.bankName ?? '',
      item.accountNumber ?? '',
      item.promptPayId ?? '',
      item.paymentStatus,
    ])

    const csvContent = [
      header.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `payroll_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCsvReady(true)
  }

  if (loading && summary.length === 0) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t('ดูยอดรวมพนักงานทุกคนในหน้าเดียว', 'Review all employees in one page')}</div>
            <div className="badge">
              {t('สถานะงวด', 'Period status')}:{' '}
              {periodInfo?.locked
                ? t('ยืนยันสรุปเงินเดือนแล้ว', 'Payroll confirmed')
                : t('ยังแก้ไขได้', 'Editable')}
            </div>
          </div>
          <h1 className="hero-title">{t('สรุปเงินเดือน', 'Payroll summary')}</h1>
          <p className="hero-subtitle">
            {t(
              'ดูยอดจ่ายสุทธิพร้อมข้อมูลบัญชีรับเงิน เหมาะกับการตรวจยอดและโอนเงินผ่านมือถือ',
              'Check net pay and bank info for transfer review on mobile.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            {t('ดาวน์โหลดรายการโอน', 'Download transfer list')}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {periodInfo ? (
          <div className="badge-row" style={{ marginBottom: 16 }}>
            <div className="badge">
              {t('รอบเงินเดือน', 'Payroll period')}: {formatThaiDate(periodInfo.periodStart)} -{' '}
              {formatThaiDate(periodInfo.periodEnd)}
            </div>
            <div className="badge">{t('วันจ่ายเงินเดือน', 'Payday')}: {periodInfo.payday}</div>
            {periodInfo.locked &&
            Date.now() > new Date(periodInfo.periodEnd).getTime() ? (
              <div className="badge">
                {t(
                  'งวดนี้ยืนยันสรุปเงินเดือนแล้ว ไม่เปิดให้แก้ย้อนหลัง',
                  'This period is confirmed and cannot be reopened retroactively.',
                )}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field">
            <label>{t('เดือน', 'Month')}</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('ปี', 'Year')}</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          {canUnlockCurrentPeriod ? (
            <div className="field">
              <label>{t('เหตุผลที่ต้องเปิดงวดกลับมาแก้', 'Reason to reopen period')}</label>
              <input
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder={t('เช่น พบรายการลงเวลาผิด', 'e.g. Found incorrect attendance')}
              />
            </div>
          ) : null}
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={loadPayroll}>
            {t('โหลดข้อมูลใหม่', 'Reload')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => persistPayroll('save')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกยอด', 'Save')}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => persistPayroll('lock')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? t('กำลังยืนยัน...', 'Confirming...') : t('ยืนยันสรุปเงินเดือน', 'Confirm payroll')}
          </button>
          {canUnlockCurrentPeriod ? (
            <button
              className="btn btn-secondary"
              onClick={() => persistPayroll('unlock')}
              disabled={saving || !unlockReason.trim()}
            >
              {saving ? t('กำลังเปิดงวด...', 'Reopening...') : t('เปิดงวดกลับมาแก้', 'Reopen period')}
            </button>
          ) : null}
        </div>
        {periodInfo?.lockedAt ? (
          <div className="message message-success">
            {t('งวดนี้ยืนยันสรุปเงินเดือนเมื่อ', 'Payroll confirmed at')}{' '}
            {formatThaiDateTime24h(periodInfo.lockedAt)}
          </div>
        ) : null}
        {csvReady ? (
          <div className="message message-success">
            {t('ดาวน์โหลดรายการโอนเรียบร้อยแล้ว', 'Transfer list downloaded')}
          </div>
        ) : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
        {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty-state">{t('กำลังคำนวณสรุปเงินเดือน...', 'Calculating payroll summary...')}</div>
        ) : (
          <>
            <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('รหัส', 'Code')}</th>
                  <th>{t('ชื่อ', 'Name')}</th>
                  <th>{t('ประเภทจ่าย', 'Pay type')}</th>
                  <th>{t('วัน/ชั่วโมงทำงาน', 'Days / hours')}</th>
                  <th>{t('ล่วงเวลา', 'OT')}</th>
                  <th>{t('ขาดงาน', 'Absent')}</th>
                  <th>{t('เข้าสาย (นาที)', 'Late (min)')}</th>
                  <th>{t('ค่าจ้าง', 'Pay')}</th>
                  <th>{t('ข้อมูลรับเงิน', 'Payment info')}</th>
                  <th>{t('สถานะโอน', 'Payment status')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.employeeId}>
                    <td>{item.employeeCode}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.payType}</td>
                    <td>
                      <div>{item.presentDays} {t('วัน', 'days')}</div>
                      <div className="table-meta">{item.workedHours.toFixed(2)} {t('ชั่วโมง', 'hrs')}</div>
                    </td>
                    <td>
                      <div>{item.overtimeHours.toFixed(2)} {t('ชั่วโมง', 'hrs')}</div>
                      <div className="table-meta">{item.overtimePay.toFixed(2)} {t('บาท', 'THB')}</div>
                    </td>
                    <td>{item.absentDays}</td>
                    <td>{item.lateMinutes}</td>
                    <td>
                      <div>{t('ฐาน', 'Base')} {item.basePay.toFixed(2)}</div>
                      <div className="table-meta">{t('หัก', 'Deduct')} {item.deduction.toFixed(2)}</div>
                      <div className="table-meta"><strong>{t('สุทธิ', 'Net')} {item.netPay.toFixed(2)}</strong></div>
                    </td>
                    <td>
                      <div>{item.bankName ?? t('ยังไม่ได้กรอก', 'Not provided')}</div>
                      <div className="table-meta">{item.accountNumber ?? '-'}</div>
                      <div className="table-meta">{t('พร้อมเพย์', 'PromptPay')}: {item.promptPayId ?? '-'}</div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.paymentStatus === 'PAID'
                            ? 'success'
                            : item.paymentStatus === 'FAILED'
                              ? 'danger'
                              : 'warning'
                        }`}
                      >
                          {item.paymentStatus === 'PAID'
                          ? t('จ่ายแล้ว', 'Paid')
                          : item.paymentStatus === 'FAILED'
                            ? t('จ่ายไม่สำเร็จ', 'Failed')
                          : t('รอโอน', 'Pending')}
                      </span>
                      <div className="action-row" style={{ marginTop: 10 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={
                            !periodInfo?.locked ||
                            paymentSavingId === item.employeeId
                          }
                          onClick={() =>
                            updatePaymentStatus(item.employeeId, 'PAID')
                          }
                        >
                          {t('โอนแล้ว', 'Paid')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={
                            !periodInfo?.locked ||
                            paymentSavingId === item.employeeId
                          }
                          onClick={() =>
                            updatePaymentStatus(item.employeeId, 'FAILED')
                          }
                        >
                          {t('โอนไม่สำเร็จ', 'Mark failed')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={
                            !periodInfo?.locked ||
                            paymentSavingId === item.employeeId
                          }
                          onClick={() =>
                            updatePaymentStatus(item.employeeId, 'PENDING')
                          }
                        >
                          {t('กลับไปรอโอน', 'Back to pending')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="mobile-card-list mobile-only">
              {summary.map((item) => (
                <article key={item.employeeId} className="record-card">
                  <div className="record-card-head">
                    <strong>{item.employeeName}</strong>
                    <span
                      className={`status-pill ${
                        item.paymentStatus === 'PAID'
                          ? 'success'
                          : item.paymentStatus === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }`}
                    >
                      {item.paymentStatus === 'PAID'
                        ? t('จ่ายแล้ว', 'Paid')
                        : item.paymentStatus === 'FAILED'
                          ? t('จ่ายไม่สำเร็จ', 'Failed')
                          : t('รอโอน', 'Pending')}
                    </span>
                  </div>
                  <div className="record-card-body">
                    <div className="record-line"><span>{t('รหัส', 'Code')}</span><strong>{item.employeeCode}</strong></div>
                    <div className="record-line"><span>{t('ประเภทจ่าย', 'Pay type')}</span><strong>{item.payType}</strong></div>
                    <div className="record-line"><span>{t('มาทำงาน', 'Worked')}</span><strong>{item.presentDays} {t('วัน', 'days')}</strong></div>
                    <div className="record-line"><span>{t('ชั่วโมงรวม', 'Total hours')}</span><strong>{item.workedHours.toFixed(2)}</strong></div>
                    <div className="record-line"><span>{t('ล่วงเวลา', 'OT')}</span><strong>{item.overtimeHours.toFixed(2)} {t('ชม.', 'hrs')}</strong></div>
                    <div className="record-line"><span>{t('หักเงิน', 'Deduction')}</span><strong>{item.deduction.toFixed(2)} {t('บาท', 'THB')}</strong></div>
                    <div className="record-line"><span>{t('ยอดสุทธิ', 'Net pay')}</span><strong>{item.netPay.toFixed(2)} {t('บาท', 'THB')}</strong></div>
                    <div className="record-line"><span>{t('ธนาคาร', 'Bank')}</span><strong>{item.bankName ?? t('ยังไม่ได้กรอก', 'Not provided')}</strong></div>
                    <div className="record-line"><span>{t('เลขบัญชี', 'Account number')}</span><strong>{item.accountNumber ?? '-'}</strong></div>
                    <div className="record-line"><span>{t('พร้อมเพย์', 'PromptPay')}</span><strong>{item.promptPayId ?? '-'}</strong></div>
                  </div>
                  <div className="action-row" style={{ marginTop: 14 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={
                        !periodInfo?.locked || paymentSavingId === item.employeeId
                      }
                      onClick={() => updatePaymentStatus(item.employeeId, 'PAID')}
                    >
                      {t('โอนแล้ว', 'Paid')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={
                        !periodInfo?.locked || paymentSavingId === item.employeeId
                      }
                      onClick={() => updatePaymentStatus(item.employeeId, 'FAILED')}
                    >
                      {t('โอนไม่สำเร็จ', 'Mark failed')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={
                        !periodInfo?.locked || paymentSavingId === item.employeeId
                      }
                      onClick={() => updatePaymentStatus(item.employeeId, 'PENDING')}
                    >
                      {t('กลับไปรอโอน', 'Back to pending')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
