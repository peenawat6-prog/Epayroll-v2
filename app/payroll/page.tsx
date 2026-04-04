'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
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
        throw new Error(data.error || 'โหลด payroll ไม่สำเร็จ')
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
        throw new Error(data.error || 'บันทึก payroll ไม่สำเร็จ')
      }

      setPeriodInfo(data)
      setSummary(data.items ?? [])
      setStatusMessage(
        action === 'lock'
          ? 'ยืนยันสรุปเงินเดือนเรียบร้อยแล้ว'
          : action === 'unlock'
            ? 'เปิดงวดเงินเดือนกลับมาแก้ไขได้แล้ว'
            : 'บันทึกสรุปเงินเดือนเรียบร้อยแล้ว',
      )
      if (action === 'unlock') {
        setUnlockReason('')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
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
        throw new Error(data.error || 'อัปเดตสถานะการโอนไม่สำเร็จ')
      }

      await loadPayroll()
      setStatusMessage(
        paymentStatus === 'PAID'
          ? 'อัปเดตสถานะเป็นโอนแล้วเรียบร้อย'
          : paymentStatus === 'FAILED'
            ? 'บันทึกสถานะโอนไม่สำเร็จเรียบร้อย'
            : 'เปลี่ยนสถานะกลับเป็นรอโอนเรียบร้อย',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'อัปเดตสถานะการโอนไม่สำเร็จ',
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
            <div className="badge">ดูยอดรวมพนักงานทุกคนในหน้าเดียว</div>
            <div className="badge">
              สถานะงวด:{' '}
              {periodInfo?.locked ? 'ยืนยันสรุปเงินเดือนแล้ว' : 'ยังแก้ไขได้'}
            </div>
          </div>
          <h1 className="hero-title">สรุปเงินเดือน</h1>
          <p className="hero-subtitle">ดูยอดจ่ายสุทธิพร้อมข้อมูลบัญชีรับเงิน เหมาะกับการตรวจยอดและโอนเงินผ่านมือถือ</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            ดาวน์โหลดรายการโอน
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        {periodInfo ? (
          <div className="badge-row" style={{ marginBottom: 16 }}>
            <div className="badge">
              รอบเงินเดือน: {formatThaiDate(periodInfo.periodStart)} -{' '}
              {formatThaiDate(periodInfo.periodEnd)}
            </div>
            <div className="badge">วันจ่ายเงินเดือน: วันที่ {periodInfo.payday}</div>
            {periodInfo.locked &&
            Date.now() > new Date(periodInfo.periodEnd).getTime() ? (
              <div className="badge">
                งวดนี้ยืนยันสรุปเงินเดือนแล้ว ไม่เปิดให้แก้ย้อนหลัง
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field">
            <label>เดือน</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>ปี</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          {canUnlockCurrentPeriod ? (
            <div className="field">
              <label>เหตุผลที่ต้องเปิดงวดกลับมาแก้</label>
              <input
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="เช่น พบรายการลงเวลาผิด"
              />
            </div>
          ) : null}
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={loadPayroll}>
            โหลดข้อมูลใหม่
          </button>
          <button
            className="btn btn-primary"
            onClick={() => persistPayroll('save')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกยอด'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => persistPayroll('lock')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? 'กำลังยืนยัน...' : 'ยืนยันสรุปเงินเดือน'}
          </button>
          {canUnlockCurrentPeriod ? (
            <button
              className="btn btn-secondary"
              onClick={() => persistPayroll('unlock')}
              disabled={saving || !unlockReason.trim()}
            >
              {saving ? 'กำลังเปิดงวด...' : 'เปิดงวดกลับมาแก้'}
            </button>
          ) : null}
        </div>
        {periodInfo?.lockedAt ? (
          <div className="message message-success">
            งวดนี้ยืนยันสรุปเงินเดือนเมื่อ{' '}
            {formatThaiDateTime24h(periodInfo.lockedAt)}
          </div>
        ) : null}
        {csvReady ? <div className="message message-success">ดาวน์โหลดรายการโอนเรียบร้อยแล้ว</div> : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
        {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty-state">กำลังคำนวณสรุปเงินเดือน...</div>
        ) : (
          <>
            <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>ประเภทจ่าย</th>
                  <th>วัน/ชั่วโมงทำงาน</th>
                  <th>ล่วงเวลา</th>
                  <th>ขาดงาน</th>
                  <th>เข้าสาย (นาที)</th>
                  <th>ค่าจ้าง</th>
                  <th>ข้อมูลรับเงิน</th>
                  <th>สถานะโอน</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.employeeId}>
                    <td>{item.employeeCode}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.payType}</td>
                    <td>
                      <div>{item.presentDays} วัน</div>
                      <div className="table-meta">{item.workedHours.toFixed(2)} ชั่วโมง</div>
                    </td>
                    <td>
                      <div>{item.overtimeHours.toFixed(2)} ชั่วโมง</div>
                      <div className="table-meta">{item.overtimePay.toFixed(2)} บาท</div>
                    </td>
                    <td>{item.absentDays}</td>
                    <td>{item.lateMinutes}</td>
                    <td>
                      <div>ฐาน {item.basePay.toFixed(2)}</div>
                      <div className="table-meta">หัก {item.deduction.toFixed(2)}</div>
                      <div className="table-meta"><strong>สุทธิ {item.netPay.toFixed(2)}</strong></div>
                    </td>
                    <td>
                      <div>{item.bankName ?? 'ยังไม่ได้กรอก'}</div>
                      <div className="table-meta">{item.accountNumber ?? '-'}</div>
                      <div className="table-meta">พร้อมเพย์: {item.promptPayId ?? '-'}</div>
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
                          ? 'จ่ายแล้ว'
                          : item.paymentStatus === 'FAILED'
                            ? 'จ่ายไม่สำเร็จ'
                          : 'รอโอน'}
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
                          โอนแล้ว
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
                          โอนไม่สำเร็จ
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
                          กลับไปรอโอน
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
                        ? 'จ่ายแล้ว'
                        : item.paymentStatus === 'FAILED'
                          ? 'จ่ายไม่สำเร็จ'
                          : 'รอโอน'}
                    </span>
                  </div>
                  <div className="record-card-body">
                    <div className="record-line"><span>รหัส</span><strong>{item.employeeCode}</strong></div>
                    <div className="record-line"><span>ประเภทจ่าย</span><strong>{item.payType}</strong></div>
                    <div className="record-line"><span>มาทำงาน</span><strong>{item.presentDays} วัน</strong></div>
                    <div className="record-line"><span>ชั่วโมงรวม</span><strong>{item.workedHours.toFixed(2)}</strong></div>
                    <div className="record-line"><span>ล่วงเวลา</span><strong>{item.overtimeHours.toFixed(2)} ชม.</strong></div>
                    <div className="record-line"><span>หักเงิน</span><strong>{item.deduction.toFixed(2)} บาท</strong></div>
                    <div className="record-line"><span>ยอดสุทธิ</span><strong>{item.netPay.toFixed(2)} บาท</strong></div>
                    <div className="record-line"><span>ธนาคาร</span><strong>{item.bankName ?? 'ยังไม่ได้กรอก'}</strong></div>
                    <div className="record-line"><span>เลขบัญชี</span><strong>{item.accountNumber ?? '-'}</strong></div>
                    <div className="record-line"><span>พร้อมเพย์</span><strong>{item.promptPayId ?? '-'}</strong></div>
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
                      โอนแล้ว
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={
                        !periodInfo?.locked || paymentSavingId === item.employeeId
                      }
                      onClick={() => updatePaymentStatus(item.employeeId, 'FAILED')}
                    >
                      โอนไม่สำเร็จ
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={
                        !periodInfo?.locked || paymentSavingId === item.employeeId
                      }
                      onClick={() => updatePaymentStatus(item.employeeId, 'PENDING')}
                    >
                      กลับไปรอโอน
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
