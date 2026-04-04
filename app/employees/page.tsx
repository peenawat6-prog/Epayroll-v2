'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatThaiDateTime24h } from '@/lib/display-time'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'

type EmployeeRow = {
  id: string
  branchId: string | null
  branch: {
    id: string
    name: string
  } | null
  code: string
  firstName: string
  lastName: string
  phone: string | null
  position: string
  employeeType: 'FULL_TIME' | 'PART_TIME'
  payType: 'MONTHLY' | 'DAILY' | 'HOURLY'
  workShift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
  baseSalary: number | null
  dailyRate: number | null
  hourlyRate: number | null
  active: boolean
  startDate: string
  bank: {
    bankName: string
    accountName: string
    accountNumber: string
    promptPayId: string | null
  } | null
}

type CurrentUser = {
  role: string
}

type RegistrationRequest = {
  id: string
  code: string
  branch: {
    id: string
    name: string
  } | null
  firstName: string
  lastName: string
  phone: string | null
  position: string
  email: string
  employeeType: 'FULL_TIME' | 'PART_TIME'
  payType: 'MONTHLY' | 'DAILY' | 'HOURLY'
  workShift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  promptPayId: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}

type BranchOption = {
  id: string
  name: string
}

export default function EmployeesPage() {
  const { t } = useLanguage()
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    branchId: '',
    firstName: '',
    lastName: '',
    phone: '',
    position: '',
    employeeType: 'FULL_TIME',
    payType: 'MONTHLY',
    workShift: 'MORNING',
    baseSalary: '',
    dailyRate: '',
    hourlyRate: '',
    startDate: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    promptPayId: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const employeeFormPanelRef = useRef<HTMLElement | null>(null)
  const canManage =
    user?.role === 'DEV' ||
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'HR'
  const workShiftLabels = {
    MORNING: t('กะเช้า', 'Morning shift'),
    AFTERNOON: t('กะบ่าย', 'Afternoon shift'),
    NIGHT: t('กะดึก', 'Night shift'),
  } as const

  const fetchEmployees = () => {
    fetch('/api/employees?includeInactive=true')
      .then((res) => res.json())
      .then((data) => setEmployees(data))
  }

  const fetchRegistrationRequests = () => {
    if (!canManage) {
      setRegistrationRequests([])
      return
    }

    fetch('/api/employee-registrations')
      .then((res) => res.json())
      .then((data) => setRegistrationRequests(data.items ?? []))
      .catch(() => setRegistrationRequests([]))
  }

  const fetchBranches = () => {
    fetch('/api/branches')
      .then((res) => res.json())
      .then((data) => setBranches(data.items ?? []))
      .catch(() => setBranches([]))
  }

  useEffect(() => {
    let mounted = true

    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then((data) => {
        if (!mounted) return
        setUser(data)
        fetchBranches()
        fetchEmployees()
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

  useEffect(() => {
    if (!user) return
    fetchRegistrationRequests()
  }, [user])

  const resetForm = () => {
    setEditId(null)
    setForm({
      branchId: '',
      firstName: '',
      lastName: '',
      phone: '',
      position: '',
      employeeType: 'FULL_TIME',
      payType: 'MONTHLY',
      workShift: 'MORNING',
      baseSalary: '',
      dailyRate: '',
      hourlyRate: '',
      startDate: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
      promptPayId: '',
    })
    setMessage('')
    setError('')
  }

  const handleEditClick = (emp: EmployeeRow) => {
    setEditId(emp.id)
    setForm({
      branchId: emp.branchId ?? '',
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone ?? '',
      position: emp.position,
      employeeType: emp.employeeType,
      payType: emp.payType,
      workShift: emp.workShift,
      baseSalary: emp.baseSalary?.toString() ?? '',
      dailyRate: emp.dailyRate?.toString() ?? '',
      hourlyRate: emp.hourlyRate?.toString() ?? '',
      startDate: emp.startDate.slice(0, 10),
      bankName: emp.bank?.bankName ?? '',
      accountName: emp.bank?.accountName ?? '',
      accountNumber: emp.bank?.accountNumber ?? '',
      promptPayId: emp.bank?.promptPayId ?? '',
    })
    setMessage('')
    setError('')
    requestAnimationFrame(() => {
      employeeFormPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm(
      t(
        'ยืนยันการลบพนักงาน? การลบนี้จะเป็นการระงับใช้งานเท่านั้น',
        'Confirm removing this employee? This will only deactivate the account.',
      ),
    )
    if (!confirmDelete) return

    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || t('ลบพนักงานไม่สำเร็จ', 'Failed to deactivate employee'))
      return
    }

    setMessage(t('พนักงานถูกระงับใช้งานแล้ว', 'Employee deactivated'))
    fetchEmployees()
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!form.firstName || !form.lastName || !form.position) {
      setError(t('กรุณากรอกข้อมูลให้ครบทุกช่อง', 'Please fill in all required fields'))
      return
    }

    let url = '/api/employees'
    let method = 'POST'
    if (editId) {
      url = `/api/employees/${editId}`
      method = 'PATCH'
    }

    const body: any = {
      branchId: form.branchId || null,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      position: form.position,
      employeeType: form.employeeType,
      payType: form.payType,
      workShift: form.workShift,
      baseSalary: form.baseSalary,
      dailyRate: form.dailyRate,
      hourlyRate: form.hourlyRate,
      startDate: form.startDate || undefined,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      promptPayId: form.promptPayId,
    }

    if (!editId) {
      body.code = undefined
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || t('บันทึกข้อมูลไม่สำเร็จ', 'Failed to save employee'))
      return
    }

    if (editId) {
      setMessage(t('แก้ไขพนักงานสำเร็จ', 'Employee updated'))
    } else {
      setMessage(t('เพิ่มพนักงานสำเร็จ', 'Employee added'))
    }

    fetchEmployees()
    fetchRegistrationRequests()
    resetForm()
  }

  const handleReviewRegistration = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
  ) => {
    setMessage('')
    setError('')
    setReviewingId(requestId)

    try {
      if (decision === 'REJECTED' && !reviewNote.trim()) {
        throw new Error(t('กรุณากรอกหมายเหตุเมื่อไม่อนุมัติ', 'Please add a note when rejecting'))
      }

      const res = await fetch(`/api/employee-registrations/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          decision,
          reviewNote: reviewNote || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('ตรวจสอบคำขอลงทะเบียนไม่สำเร็จ', 'Failed to review registration request'))
      }

      setReviewNote('')
      setMessage(
        decision === 'APPROVED'
          ? t(
              'อนุมัติคำขอลงทะเบียนแล้ว พนักงานสามารถล็อกอินได้',
              'Registration approved. Employee can now log in.',
            )
          : t(
              'ไม่อนุมัติคำขอลงทะเบียนเรียบร้อยแล้ว',
              'Registration request rejected.',
            ),
      )
      fetchEmployees()
      fetchRegistrationRequests()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t('ตรวจสอบคำขอลงทะเบียนไม่สำเร็จ', 'Failed to review registration request'),
      )
    } finally {
      setReviewingId(null)
    }
  }

  if (loading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">
              {t('พนักงานทั้งหมด', 'Total employees')} {employees.length}{' '}
              {t('รายการ', 'records')}
            </div>
            <div className="badge">{t('สิทธิ์', 'Role')} {user?.role}</div>
            {registrationRequests.filter((item) => item.status === 'PENDING').length ? (
              <div className="badge">
                {t('รออนุมัติ', 'Pending approval')}{' '}
                {registrationRequests.filter((item) => item.status === 'PENDING').length}{' '}
                {t('คำขอ', 'requests')}
              </div>
            ) : null}
          </div>
          <h1 className="hero-title">{t('จัดการพนักงาน', 'Manage employees')}</h1>
          <p className="hero-subtitle">
            {t(
              'เพิ่มข้อมูลพนักงานและบัญชีรับเงินให้พร้อมใช้ในงานจริงทั้งหน้าร้านและงานโอนเงิน',
              'Manage employee profiles and payment accounts for daily operations and salary transfers.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <LogoutButton />
        </div>
      </section>

      {canManage ? (
        <section ref={employeeFormPanelRef} className="panel">
          <h2 className="panel-title">
            {editId ? t('แก้ไขข้อมูลพนักงาน', 'Edit employee') : t('เพิ่มพนักงานใหม่', 'Add employee')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginTop: 16 }}>
              {!editId ? (
                <div className="field">
                  <label>{t('รหัสพนักงาน', 'Employee code')}</label>
                  <input value={t('ระบบจะรันให้อัตโนมัติ', 'Generated automatically')} disabled />
                </div>
              ) : null}
              <div className="field">
                <label>{t('สาขา', 'Branch')}</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                >
                  <option value="">{t('ไม่ระบุสาขา', 'No branch')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t('ชื่อจริง', 'First name')}</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('นามสกุล', 'Last name')}</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('เบอร์โทร', 'Phone')}</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('ตำแหน่ง', 'Position')}</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('ประเภทพนักงาน', 'Employee type')}</label>
                <select
                  value={form.employeeType}
                  onChange={(e) => setForm({ ...form, employeeType: e.target.value as 'FULL_TIME' | 'PART_TIME' })}
                >
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </div>
              <div className="field">
                <label>{t('รูปแบบจ่ายเงิน', 'Pay type')}</label>
                <select
                  value={form.payType}
                  onChange={(e) => setForm({ ...form, payType: e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY' })}
                >
                  <option value="MONTHLY">{t('รายเดือน', 'Monthly')}</option>
                  <option value="DAILY">{t('รายวัน', 'Daily')}</option>
                  <option value="HOURLY">{t('รายชั่วโมง', 'Hourly')}</option>
                </select>
              </div>
              <div className="field">
                <label>{t('กะการทำงานประจำ', 'Regular shift')}</label>
                <select
                  value={form.workShift}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      workShift: e.target.value as 'MORNING' | 'AFTERNOON' | 'NIGHT',
                    })
                  }
                >
                  <option value="MORNING">{workShiftLabels.MORNING}</option>
                  <option value="AFTERNOON">{workShiftLabels.AFTERNOON}</option>
                  <option value="NIGHT">{workShiftLabels.NIGHT}</option>
                </select>
              </div>
              <div className="field">
                <label>{t('เงินเดือนฐาน', 'Base salary')}</label>
                <input
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('ค่าแรงรายวัน', 'Daily rate')}</label>
                <input
                  type="number"
                  value={form.dailyRate}
                  onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('ค่าแรงรายชั่วโมง', 'Hourly rate')}</label>
                <input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('วันเริ่มงาน', 'Start date')}</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('ธนาคาร', 'Bank')}</label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder={t('เช่น SCB', 'e.g. SCB')}
                />
              </div>
              <div className="field">
                <label>{t('ชื่อบัญชี', 'Account name')}</label>
                <input
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('เลขบัญชี', 'Account number')}</label>
                <input
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{t('พร้อมเพย์', 'PromptPay')}</label>
                <input
                  value={form.promptPayId}
                  onChange={(e) => setForm({ ...form, promptPayId: e.target.value })}
                  placeholder={t('เบอร์โทรหรือเลขบัตร', 'Phone number or ID number')}
                />
              </div>
            </div>

            <div className="action-row" style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                {editId ? t('บันทึกการแก้ไข', 'Save changes') : t('เพิ่มพนักงาน', 'Add employee')}
              </button>
              {editId ? (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  {t('ยกเลิก', 'Cancel')}
                </button>
              ) : null}
            </div>
          </form>

          {message ? <div className="message message-success">{message}</div> : null}
          {error ? <div className="message message-error">{error}</div> : null}
        </section>
      ) : (
        <section className="panel">
          <h2 className="panel-title">{t('สิทธิ์ของคุณเป็นแบบอ่านอย่างเดียว', 'Read-only access')}</h2>
          <p className="panel-subtitle">
            {t(
              'สามารถดูข้อมูลพนักงานได้ แต่ไม่สามารถเพิ่มหรือแก้ไขได้',
              'You can view employee data, but cannot add or edit records.',
            )}
          </p>
        </section>
      )}

      {canManage ? (
        <section className="panel">
          <h2 className="panel-title">{t('คำขอลงทะเบียนพนักงาน', 'Employee registration requests')}</h2>
          <p className="panel-subtitle">
            {t(
              'อนุมัติแล้วระบบจะสร้างบัญชีพนักงานและเปิดให้ล็อกอินได้ทันที',
              'Once approved, the employee account is created and login is enabled.',
            )}
          </p>

          <div className="field" style={{ marginTop: 16, maxWidth: 420 }}>
            <label>{t('หมายเหตุสำหรับการอนุมัติ/ไม่อนุมัติ', 'Approval / rejection note')}</label>
            <input
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder={t(
                'ถ้าไม่อนุมัติ ควรกรอกเหตุผลให้พนักงาน',
                'If rejecting, explain the reason for the employee.',
              )}
            />
          </div>

          {registrationRequests.length === 0 ? (
            <div className="empty-state">{t('ยังไม่มีคำขอลงทะเบียน', 'No registration requests')}</div>
          ) : (
            <div className="mobile-card-list" style={{ marginTop: 16 }}>
              {registrationRequests.map((request) => (
                <article key={request.id} className="record-card">
                  <div className="record-card-head">
                    <strong>
                      {request.code} {request.firstName} {request.lastName}
                    </strong>
                    <span
                      className={`status-pill ${
                        request.status === 'APPROVED'
                          ? 'success'
                          : request.status === 'REJECTED'
                            ? 'danger'
                            : 'warning'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="record-card-body">
                    <div className="record-line">
                      <span>{t('อีเมล', 'Email')}</span>
                      <strong>{request.email}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('สาขา', 'Branch')}</span>
                      <strong>{request.branch?.name ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('ตำแหน่ง', 'Position')}</span>
                      <strong>{request.position}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('เบอร์โทร', 'Phone')}</span>
                      <strong>{request.phone ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('ประเภท', 'Type')}</span>
                      <strong>
                        {request.employeeType} / {request.payType}
                      </strong>
                    </div>
                    <div className="record-line">
                      <span>{t('กะทำงาน', 'Shift')}</span>
                      <strong>{workShiftLabels[request.workShift]}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('ธนาคาร', 'Bank')}</span>
                      <strong>{request.bankName ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('ชื่อบัญชี', 'Account name')}</span>
                      <strong>{request.accountName ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('เลขบัญชี', 'Account number')}</span>
                      <strong>{request.accountNumber ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('พร้อมเพย์', 'PromptPay')}</span>
                      <strong>{request.promptPayId ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>{t('ส่งคำขอเมื่อ', 'Submitted at')}</span>
                      <strong>
                        {formatThaiDateTime24h(request.createdAt)}
                      </strong>
                    </div>
                    <div className="record-line">
                      <span>{t('หมายเหตุ', 'Note')}</span>
                      <strong>{request.reviewNote ?? '-'}</strong>
                    </div>
                  </div>

                  {request.status === 'PENDING' ? (
                    <div className="action-row" style={{ marginTop: 14 }}>
                      <button
                        className="btn btn-primary"
                        disabled={reviewingId === request.id}
                        onClick={() => handleReviewRegistration(request.id, 'APPROVED')}
                      >
                        {t('อนุมัติให้ใช้งาน', 'Approve')}
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={reviewingId === request.id}
                        onClick={() => handleReviewRegistration(request.id, 'REJECTED')}
                      >
                        {t('ไม่อนุมัติ', 'Reject')}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="panel">
        <h2 className="panel-title">{t('รายชื่อพนักงาน', 'Employee list')}</h2>
        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('รหัส', 'Code')}</th>
                <th>{t('ชื่อ', 'Name')}</th>
                <th>{t('ตำแหน่ง', 'Position')}</th>
                <th>{t('สาขา', 'Branch')}</th>
                <th>{t('รูปแบบจ่าย', 'Pay type')}</th>
                <th>{t('กะทำงาน', 'Shift')}</th>
                <th>{t('อัตราค่าจ้าง', 'Pay rate')}</th>
                <th>{t('ข้อมูลรับเงิน', 'Payment info')}</th>
                <th>{t('สถานะ', 'Status')}</th>
                <th>{t('จัดการ', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.code}</td>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.position}</td>
                  <td>{emp.branch?.name ?? '-'}</td>
                  <td>{emp.payType}</td>
                  <td>{workShiftLabels[emp.workShift]}</td>
                  <td>
                    {emp.payType === 'MONTHLY'
                      ? `${emp.baseSalary ?? 0} ${t('บาท/เดือน', 'THB/month')}`
                      : null}
                    {emp.payType === 'DAILY'
                      ? `${emp.dailyRate ?? 0} ${t('บาท/วัน', 'THB/day')}`
                      : null}
                    {emp.payType === 'HOURLY'
                      ? `${emp.hourlyRate ?? 0} ${t('บาท/ชั่วโมง', 'THB/hour')}`
                      : null}
                  </td>
                  <td>
                    <div>{emp.bank?.bankName ?? t('ยังไม่ได้กรอก', 'Not provided')}</div>
                    <div className="table-meta">{emp.bank?.accountNumber ?? '-'}</div>
                    <div className="table-meta">{t('พร้อมเพย์', 'PromptPay')}: {emp.bank?.promptPayId ?? '-'}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                      {emp.active ? t('ใช้งานอยู่', 'Active') : t('ระงับใช้งาน', 'Disabled')}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      {canManage ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                            {t('แก้ไข', 'Edit')}
                          </button>
                          {emp.active ? (
                            <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                              {t('ระงับ', 'Disable')}
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="badge">{t('ดูข้อมูลเท่านั้น', 'View only')}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-card-list mobile-only">
          {employees.map((emp) => (
            <article key={emp.id} className="record-card">
              <div className="record-card-head">
                <strong>{emp.firstName} {emp.lastName}</strong>
                <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                  {emp.active ? t('ใช้งานอยู่', 'Active') : t('ระงับใช้งาน', 'Disabled')}
                </span>
              </div>
              <div className="record-card-body">
                <div className="record-line"><span>{t('รหัส', 'Code')}</span><strong>{emp.code}</strong></div>
                <div className="record-line"><span>{t('ตำแหน่ง', 'Position')}</span><strong>{emp.position}</strong></div>
                <div className="record-line"><span>{t('สาขา', 'Branch')}</span><strong>{emp.branch?.name ?? '-'}</strong></div>
                <div className="record-line"><span>{t('รูปแบบจ่าย', 'Pay type')}</span><strong>{emp.payType}</strong></div>
                <div className="record-line"><span>{t('กะทำงาน', 'Shift')}</span><strong>{workShiftLabels[emp.workShift]}</strong></div>
                <div className="record-line">
                  <span>{t('บัญชีรับเงิน', 'Payment account')}</span>
                  <strong>{emp.bank?.bankName ?? t('ยังไม่ได้กรอก', 'Not provided')}</strong>
                </div>
                <div className="record-line"><span>{t('เลขบัญชี', 'Account number')}</span><strong>{emp.bank?.accountNumber ?? '-'}</strong></div>
                <div className="record-line"><span>{t('พร้อมเพย์', 'PromptPay')}</span><strong>{emp.bank?.promptPayId ?? '-'}</strong></div>
              </div>
              <div className="action-row" style={{ marginTop: 12 }}>
                {canManage ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                      {t('แก้ข้อมูล', 'Edit')}
                    </button>
                    {emp.active ? (
                      <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                        {t('ระงับใช้งาน', 'Disable')}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="badge">{t('ดูข้อมูลเท่านั้น', 'View only')}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
