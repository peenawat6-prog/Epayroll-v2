'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatThaiDate } from '@/lib/display-time'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'
import {
  getEmployeeTypeLabel,
  getPayTypeLabel,
  getRequestStatusLabel,
  getRoleLabel,
} from '@/lib/ui-format'

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
  dayOffWeekdays: string[]
  baseSalary: number | null
  dailyRate: number | null
  hourlyRate: number | null
  active: boolean
  startDate: string
  user: {
    id: string
    role: 'DEV' | 'OWNER' | 'ADMIN' | 'HR' | 'FINANCE' | 'EMPLOYEE'
    email: string
  } | null
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

type BranchOption = {
  id: string
  name: string
}

const DAY_OFF_OPTIONS = [
  { value: 'SUNDAY', th: 'อาทิตย์', en: 'Sunday' },
  { value: 'MONDAY', th: 'จันทร์', en: 'Monday' },
  { value: 'TUESDAY', th: 'อังคาร', en: 'Tuesday' },
  { value: 'WEDNESDAY', th: 'พุธ', en: 'Wednesday' },
  { value: 'THURSDAY', th: 'พฤหัสบดี', en: 'Thursday' },
  { value: 'FRIDAY', th: 'ศุกร์', en: 'Friday' },
  { value: 'SATURDAY', th: 'เสาร์', en: 'Saturday' },
] as const

export default function EmployeesPage() {
  const { t, language } = useLanguage()
  const createInitialForm = () => ({
    branchId: '',
    firstName: '',
    lastName: '',
    phone: '',
    position: '',
    employeeType: 'FULL_TIME',
    payType: 'MONTHLY',
    workShift: 'MORNING',
    dayOffWeekdays: [] as string[],
    baseSalary: '',
    dailyRate: '',
    hourlyRate: '',
    startDate: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    promptPayId: '',
    userRole: 'EMPLOYEE' as 'EMPLOYEE' | 'ADMIN' | 'HR' | 'FINANCE',
  })
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState(createInitialForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const employeeFormPanelRef = useRef<HTMLElement | null>(null)
  const canManage =
    user?.role === 'DEV' ||
    user?.role === 'OWNER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'HR'
  const canGrantStaffRole = user?.role === 'DEV' || user?.role === 'OWNER'
  const workShiftLabels = {
    MORNING: t('กะเช้า', 'Morning shift'),
    AFTERNOON: t('กะบ่าย', 'Afternoon shift'),
    NIGHT: t('กะดึก', 'Night shift'),
  } as const
  const dayOffLabelMap = {
    SUNDAY: t('อาทิตย์', 'Sunday'),
    MONDAY: t('จันทร์', 'Monday'),
    TUESDAY: t('อังคาร', 'Tuesday'),
    WEDNESDAY: t('พุธ', 'Wednesday'),
    THURSDAY: t('พฤหัสบดี', 'Thursday'),
    FRIDAY: t('ศุกร์', 'Friday'),
    SATURDAY: t('เสาร์', 'Saturday'),
  } as const
  const expandedEmployee =
    employees.find((employee) => employee.id === expandedEmployeeId) ?? null

  const getDayOffLabels = useCallback(
    (dayOffWeekdays: string[]) =>
      dayOffWeekdays.length
        ? dayOffWeekdays
            .map(
              (weekday) =>
                dayOffLabelMap[weekday as keyof typeof dayOffLabelMap] ?? weekday,
            )
            .join(', ')
        : '-',
    [dayOffLabelMap],
  )

  const getPayRateLabel = useCallback(
    (employee: EmployeeRow) => {
      if (employee.payType === 'MONTHLY') {
        return `${employee.baseSalary ?? 0} ${t('บาท/เดือน', 'THB/month')}`
      }

      if (employee.payType === 'DAILY') {
        return `${employee.dailyRate ?? 0} ${t('บาท/วัน', 'THB/day')}`
      }

      return `${employee.hourlyRate ?? 0} ${t('บาท/ชั่วโมง', 'THB/hour')}`
    },
    [t],
  )

  const fetchEmployees = () => {
    fetch('/api/employees?includeInactive=true')
      .then((res) => res.json())
      .then((data) => setEmployees(data))
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
    if (
      expandedEmployeeId &&
      !employees.some((employee) => employee.id === expandedEmployeeId)
    ) {
      setExpandedEmployeeId(null)
    }
  }, [employees, expandedEmployeeId])

  const resetForm = (options?: { clearMessage?: boolean }) => {
    setEditId(null)
    setIsFormOpen(false)
    setForm(createInitialForm())
    if (options?.clearMessage !== false) {
      setMessage('')
    }
    setError('')
  }

  const openCreateForm = () => {
    setEditId(null)
    setIsFormOpen(true)
    setForm(createInitialForm())
    setMessage('')
    setError('')
    requestAnimationFrame(() => {
      employeeFormPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const handleEditClick = (emp: EmployeeRow) => {
    setExpandedEmployeeId(emp.id)
    setIsFormOpen(true)
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
      dayOffWeekdays: emp.dayOffWeekdays ?? [],
      baseSalary: emp.baseSalary?.toString() ?? '',
      dailyRate: emp.dailyRate?.toString() ?? '',
      hourlyRate: emp.hourlyRate?.toString() ?? '',
      startDate: emp.startDate.slice(0, 10),
      bankName: emp.bank?.bankName ?? '',
      accountName: emp.bank?.accountName ?? '',
      accountNumber: emp.bank?.accountNumber ?? '',
      promptPayId: emp.bank?.promptPayId ?? '',
      userRole:
        emp.user?.role === 'ADMIN' ||
        emp.user?.role === 'HR' ||
        emp.user?.role === 'FINANCE'
          ? emp.user.role
          : 'EMPLOYEE',
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

  const openEmployeeDetails = (employeeId: string) => {
    setExpandedEmployeeId((currentId) =>
      currentId === employeeId ? null : employeeId,
    )
  }

  const openEmployeeTimeCorrection = (employeeId: string) => {
    router.push(`/attendance/corrections?employeeId=${employeeId}`)
  }

  const toggleDayOff = (weekday: string) => {
    setForm((current) => ({
      ...current,
      dayOffWeekdays: current.dayOffWeekdays.includes(weekday)
        ? current.dayOffWeekdays.filter((item) => item !== weekday)
        : [...current.dayOffWeekdays, weekday],
    }))
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

    const body: Record<string, unknown> = {
      branchId: form.branchId || null,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      position: form.position,
      employeeType: form.employeeType,
      payType: form.payType,
      workShift: form.workShift,
      dayOffWeekdays: form.dayOffWeekdays,
      baseSalary: form.baseSalary,
      dailyRate: form.dailyRate,
      hourlyRate: form.hourlyRate,
      startDate: form.startDate || undefined,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      promptPayId: form.promptPayId,
    }

    if (editId && canGrantStaffRole) {
      body.userRole = form.userRole
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
    resetForm({ clearMessage: false })
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
          {canManage ? (
            <button className="btn btn-primary" onClick={openCreateForm}>
              {t('เพิ่มพนักงานใหม่', 'Add new employee')}
            </button>
          ) : null}
          <LogoutButton />
        </div>
      </section>

      {message ? <div className="message message-success">{message}</div> : null}
      {error ? <div className="message message-error">{error}</div> : null}

      {canManage ? (
        isFormOpen ? (
          <section ref={employeeFormPanelRef} className="panel">
            <h2 className="panel-title">
              {editId
                ? t('แก้ไขข้อมูลพนักงาน', 'Edit employee')
                : t('เพิ่มพนักงานใหม่', 'Add employee')}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid" style={{ marginTop: 16 }}>
                {!editId ? (
                  <div className="field">
                    <label>{t('รหัสพนักงาน', 'Employee code')}</label>
                    <input
                      value={t('ระบบจะรันให้อัตโนมัติ', 'Generated automatically')}
                      disabled
                    />
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
                    onChange={(e) =>
                      setForm({
                        ...form,
                        employeeType: e.target.value as 'FULL_TIME' | 'PART_TIME',
                      })
                    }
                  >
                    <option value="FULL_TIME">
                      {getEmployeeTypeLabel('FULL_TIME', language)}
                    </option>
                    <option value="PART_TIME">
                      {getEmployeeTypeLabel('PART_TIME', language)}
                    </option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('รูปแบบจ่ายเงิน', 'Pay type')}</label>
                  <select
                    value={form.payType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        payType: e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY',
                      })
                    }
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
                  <label>{t('วันหยุดประจำสัปดาห์', 'Weekly days off')}</label>
                  <div className="weekday-picker">
                    {DAY_OFF_OPTIONS.map((day) => (
                      <label key={day.value} className="weekday-option">
                        <input
                          type="checkbox"
                          checked={form.dayOffWeekdays.includes(day.value)}
                          onChange={() => toggleDayOff(day.value)}
                        />
                        <span>{t(day.th, day.en)}</span>
                      </label>
                    ))}
                  </div>
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
                {editId && canGrantStaffRole ? (
                  <div className="field">
                    <label>{t('สิทธิ์ใช้งานระบบ', 'System role')}</label>
                    <select
                      value={form.userRole}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          userRole: e.target.value as
                            | 'EMPLOYEE'
                            | 'ADMIN'
                            | 'HR'
                            | 'FINANCE',
                        })
                      }
                    >
                      <option value="EMPLOYEE">{t('พนักงาน', 'Employee')}</option>
                      <option value="ADMIN">{t('แอดมิน', 'Admin')}</option>
                      <option value="HR">{t('ฝ่ายบุคคล', 'HR')}</option>
                      <option value="FINANCE">{t('ฝ่ายการเงิน', 'Finance')}</option>
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="action-row" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  {editId
                    ? t('บันทึกการแก้ไข', 'Save changes')
                    : t('เพิ่มพนักงาน', 'Add employee')}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => resetForm()}>
                  {t('ปิดฟอร์ม', 'Close form')}
                </button>
              </div>
            </form>
          </section>
        ) : null
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

      <section className="panel">
        <h2 className="panel-title">{t('รายชื่อพนักงาน', 'Employee list')}</h2>
        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('รหัส', 'Code')}</th>
                <th>{t('ชื่อ', 'Name')}</th>
                <th>{t('ตำแหน่ง', 'Position')}</th>
                <th>{t('จัดการ', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.code}</td>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.position}</td>
                  <td>
                    <div className="action-row">
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEmployeeDetails(emp.id)}
                      >
                        {expandedEmployeeId === emp.id
                          ? t('ซ่อนข้อมูล', 'Hide details')
                          : t('ดูข้อมูลเพิ่มเติม', 'View details')}
                      </button>
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
                <strong>{emp.code} {emp.firstName} {emp.lastName}</strong>
                <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                  {emp.active ? t('ใช้งานอยู่', 'Active') : t('ระงับใช้งาน', 'Disabled')}
                </span>
              </div>
              <div className="record-card-body">
                <div className="record-line"><span>{t('ตำแหน่ง', 'Position')}</span><strong>{emp.position}</strong></div>
              </div>
              <div className="action-row" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => openEmployeeDetails(emp.id)}
                >
                  {expandedEmployeeId === emp.id
                    ? t('ซ่อนข้อมูล', 'Hide details')
                    : t('ดูข้อมูลเพิ่มเติม', 'View details')}
                </button>
              </div>
            </article>
          ))}
        </div>

        {expandedEmployee ? (
          <section className="panel" style={{ marginTop: 18 }}>
            <h3 className="panel-title">
              {t('ข้อมูลพนักงาน', 'Employee details')} {expandedEmployee.code}{' '}
              {expandedEmployee.firstName} {expandedEmployee.lastName}
            </h3>
            <div className="mobile-card-list" style={{ marginTop: 16 }}>
              <article className="record-card">
                <div className="record-card-body">
                  <div className="record-line"><span>{t('รหัส', 'Code')}</span><strong>{expandedEmployee.code}</strong></div>
                  <div className="record-line"><span>{t('ชื่อ', 'Name')}</span><strong>{expandedEmployee.firstName} {expandedEmployee.lastName}</strong></div>
                  <div className="record-line"><span>{t('ตำแหน่ง', 'Position')}</span><strong>{expandedEmployee.position}</strong></div>
                  <div className="record-line"><span>{t('สาขา', 'Branch')}</span><strong>{expandedEmployee.branch?.name ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('เบอร์โทร', 'Phone')}</span><strong>{expandedEmployee.phone ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('ประเภทพนักงาน', 'Employee type')}</span><strong>{getEmployeeTypeLabel(expandedEmployee.employeeType, language)}</strong></div>
                  <div className="record-line"><span>{t('รูปแบบจ่าย', 'Pay type')}</span><strong>{getPayTypeLabel(expandedEmployee.payType, language)}</strong></div>
                  <div className="record-line"><span>{t('กะทำงาน', 'Shift')}</span><strong>{workShiftLabels[expandedEmployee.workShift]}</strong></div>
                  <div className="record-line"><span>{t('วันหยุดประจำ', 'Days off')}</span><strong>{getDayOffLabels(expandedEmployee.dayOffWeekdays)}</strong></div>
                  <div className="record-line"><span>{t('อัตราค่าจ้าง', 'Pay rate')}</span><strong>{getPayRateLabel(expandedEmployee)}</strong></div>
                  <div className="record-line"><span>{t('วันเริ่มงาน', 'Start date')}</span><strong>{formatThaiDate(expandedEmployee.startDate)}</strong></div>
                  <div className="record-line"><span>{t('สถานะ', 'Status')}</span><strong>{expandedEmployee.active ? t('ใช้งานอยู่', 'Active') : t('ระงับใช้งาน', 'Disabled')}</strong></div>
                  <div className="record-line"><span>{t('สิทธิ์ระบบ', 'System role')}</span><strong>{expandedEmployee.user?.role ? getRoleLabel(expandedEmployee.user.role, language) : t('ยังไม่มีบัญชี', 'No login account')}</strong></div>
                  <div className="record-line"><span>{t('อีเมลระบบ', 'Login email')}</span><strong>{expandedEmployee.user?.email ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('ธนาคาร', 'Bank')}</span><strong>{expandedEmployee.bank?.bankName ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('ชื่อบัญชี', 'Account name')}</span><strong>{expandedEmployee.bank?.accountName ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('เลขบัญชี', 'Account number')}</span><strong>{expandedEmployee.bank?.accountNumber ?? '-'}</strong></div>
                  <div className="record-line"><span>{t('พร้อมเพย์', 'PromptPay')}</span><strong>{expandedEmployee.bank?.promptPayId ?? '-'}</strong></div>
                </div>
                <div className="action-row" style={{ marginTop: 14 }}>
                  {canManage ? (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEditClick(expandedEmployee)}
                      >
                        {t('แก้ไขข้อมูลพนักงาน', 'Edit employee')}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEmployeeTimeCorrection(expandedEmployee.id)}
                      >
                        {t('แก้ไขเวลางาน', 'Edit attendance')}
                      </button>
                      {expandedEmployee.active ? (
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(expandedEmployee.id)}
                        >
                          {t('ระงับใช้งาน', 'Disable')}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <span className="badge">
                      {t('สิทธิ์แก้ไขมีเฉพาะฝั่งผู้จัดการ', 'Only managers can edit')}
                    </span>
                  )}
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  )
}
