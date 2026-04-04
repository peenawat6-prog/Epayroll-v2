'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatThaiDateTime24h } from '@/lib/display-time'
import LogoutButton from '@/app/components/logout-button'

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
    const confirmDelete = confirm('ยืนยันการลบพนักงาน? การลบนี้จะเป็นการระงับใช้งานเท่านั้น')
    if (!confirmDelete) return

    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'ลบพนักงานไม่สำเร็จ')
      return
    }

    setMessage('พนักงานถูกระงับใช้งานแล้ว')
    fetchEmployees()
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!form.firstName || !form.lastName || !form.position) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง')
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
      setError(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
      return
    }

    if (editId) {
      setMessage('แก้ไขพนักงานสำเร็จ')
    } else {
      setMessage('เพิ่มพนักงานสำเร็จ')
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
        throw new Error('กรุณากรอกหมายเหตุเมื่อไม่อนุมัติ')
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
        throw new Error(data.error || 'ตรวจสอบคำขอลงทะเบียนไม่สำเร็จ')
      }

      setReviewNote('')
      setMessage(
        decision === 'APPROVED'
          ? 'อนุมัติคำขอลงทะเบียนแล้ว พนักงานสามารถล็อกอินได้'
          : 'ไม่อนุมัติคำขอลงทะเบียนเรียบร้อยแล้ว',
      )
      fetchEmployees()
      fetchRegistrationRequests()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'ตรวจสอบคำขอลงทะเบียนไม่สำเร็จ',
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
            <div className="badge">พนักงานทั้งหมด {employees.length} รายการ</div>
            <div className="badge">สิทธิ์ {user?.role}</div>
            {registrationRequests.filter((item) => item.status === 'PENDING').length ? (
              <div className="badge">
                รออนุมัติ{' '}
                {registrationRequests.filter((item) => item.status === 'PENDING').length}{' '}
                คำขอ
              </div>
            ) : null}
          </div>
          <h1 className="hero-title">จัดการพนักงาน</h1>
          <p className="hero-subtitle">เพิ่มข้อมูลพนักงานและบัญชีรับเงินให้พร้อมใช้ในงานจริงทั้งหน้าร้านและงานโอนเงิน</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <LogoutButton />
        </div>
      </section>

      {canManage ? (
        <section ref={employeeFormPanelRef} className="panel">
          <h2 className="panel-title">{editId ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginTop: 16 }}>
              {!editId ? (
                <div className="field">
                  <label>รหัสพนักงาน</label>
                  <input value="ระบบจะรันให้อัตโนมัติ" disabled />
                </div>
              ) : null}
              <div className="field">
                <label>สาขา</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                >
                  <option value="">ไม่ระบุสาขา</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ชื่อจริง</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>นามสกุล</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ตำแหน่ง</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ประเภทพนักงาน</label>
                <select
                  value={form.employeeType}
                  onChange={(e) => setForm({ ...form, employeeType: e.target.value as 'FULL_TIME' | 'PART_TIME' })}
                >
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </div>
              <div className="field">
                <label>รูปแบบจ่ายเงิน</label>
                <select
                  value={form.payType}
                  onChange={(e) => setForm({ ...form, payType: e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY' })}
                >
                  <option value="MONTHLY">รายเดือน</option>
                  <option value="DAILY">รายวัน</option>
                  <option value="HOURLY">รายชั่วโมง</option>
                </select>
              </div>
              <div className="field">
                <label>เงินเดือนฐาน</label>
                <input
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ค่าแรงรายวัน</label>
                <input
                  type="number"
                  value={form.dailyRate}
                  onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ค่าแรงรายชั่วโมง</label>
                <input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>วันเริ่มงาน</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ธนาคาร</label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="เช่น SCB"
                />
              </div>
              <div className="field">
                <label>ชื่อบัญชี</label>
                <input
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>เลขบัญชี</label>
                <input
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                />
              </div>
              <div className="field">
                <label>พร้อมเพย์</label>
                <input
                  value={form.promptPayId}
                  onChange={(e) => setForm({ ...form, promptPayId: e.target.value })}
                  placeholder="เบอร์โทรหรือเลขบัตร"
                />
              </div>
            </div>

            <div className="action-row" style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                {editId ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
              </button>
              {editId ? (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  ยกเลิก
                </button>
              ) : null}
            </div>
          </form>

          {message ? <div className="message message-success">{message}</div> : null}
          {error ? <div className="message message-error">{error}</div> : null}
        </section>
      ) : (
        <section className="panel">
          <h2 className="panel-title">สิทธิ์ของคุณเป็นแบบอ่านอย่างเดียว</h2>
          <p className="panel-subtitle">สามารถดูข้อมูลพนักงานได้ แต่ไม่สามารถเพิ่มหรือแก้ไขได้</p>
        </section>
      )}

      {canManage ? (
        <section className="panel">
          <h2 className="panel-title">คำขอลงทะเบียนพนักงาน</h2>
          <p className="panel-subtitle">
            อนุมัติแล้วระบบจะสร้างบัญชีพนักงานและเปิดให้ล็อกอินได้ทันที
          </p>

          <div className="field" style={{ marginTop: 16, maxWidth: 420 }}>
            <label>หมายเหตุสำหรับการอนุมัติ/ไม่อนุมัติ</label>
            <input
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="ถ้าไม่อนุมัติ ควรกรอกเหตุผลให้พนักงาน"
            />
          </div>

          {registrationRequests.length === 0 ? (
            <div className="empty-state">ยังไม่มีคำขอลงทะเบียน</div>
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
                      <span>อีเมล</span>
                      <strong>{request.email}</strong>
                    </div>
                    <div className="record-line">
                      <span>สาขา</span>
                      <strong>{request.branch?.name ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>ตำแหน่ง</span>
                      <strong>{request.position}</strong>
                    </div>
                    <div className="record-line">
                      <span>เบอร์โทร</span>
                      <strong>{request.phone ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>ประเภท</span>
                      <strong>
                        {request.employeeType} / {request.payType}
                      </strong>
                    </div>
                    <div className="record-line">
                      <span>ธนาคาร</span>
                      <strong>{request.bankName ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>ชื่อบัญชี</span>
                      <strong>{request.accountName ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>เลขบัญชี</span>
                      <strong>{request.accountNumber ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>พร้อมเพย์</span>
                      <strong>{request.promptPayId ?? '-'}</strong>
                    </div>
                    <div className="record-line">
                      <span>ส่งคำขอเมื่อ</span>
                      <strong>
                        {formatThaiDateTime24h(request.createdAt)}
                      </strong>
                    </div>
                    <div className="record-line">
                      <span>หมายเหตุ</span>
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
                        อนุมัติให้ใช้งาน
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={reviewingId === request.id}
                        onClick={() => handleReviewRegistration(request.id, 'REJECTED')}
                      >
                        ไม่อนุมัติ
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
        <h2 className="panel-title">รายชื่อพนักงาน</h2>
        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ตำแหน่ง</th>
                <th>สาขา</th>
                <th>รูปแบบจ่าย</th>
                <th>อัตราค่าจ้าง</th>
                <th>ข้อมูลรับเงิน</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
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
                  <td>
                    {emp.payType === 'MONTHLY' ? `${emp.baseSalary ?? 0} บาท/เดือน` : null}
                    {emp.payType === 'DAILY' ? `${emp.dailyRate ?? 0} บาท/วัน` : null}
                    {emp.payType === 'HOURLY' ? `${emp.hourlyRate ?? 0} บาท/ชั่วโมง` : null}
                  </td>
                  <td>
                    <div>{emp.bank?.bankName ?? 'ยังไม่ได้กรอก'}</div>
                    <div className="table-meta">{emp.bank?.accountNumber ?? '-'}</div>
                    <div className="table-meta">พร้อมเพย์: {emp.bank?.promptPayId ?? '-'}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                      {emp.active ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      {canManage ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                            แก้ไข
                          </button>
                          {emp.active ? (
                            <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                              ระงับ
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="badge">ดูข้อมูลเท่านั้น</span>
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
                  {emp.active ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}
                </span>
              </div>
              <div className="record-card-body">
                <div className="record-line"><span>รหัส</span><strong>{emp.code}</strong></div>
                <div className="record-line"><span>ตำแหน่ง</span><strong>{emp.position}</strong></div>
                <div className="record-line"><span>สาขา</span><strong>{emp.branch?.name ?? '-'}</strong></div>
                <div className="record-line"><span>รูปแบบจ่าย</span><strong>{emp.payType}</strong></div>
                <div className="record-line">
                  <span>บัญชีรับเงิน</span>
                  <strong>{emp.bank?.bankName ?? 'ยังไม่ได้กรอก'}</strong>
                </div>
                <div className="record-line"><span>เลขบัญชี</span><strong>{emp.bank?.accountNumber ?? '-'}</strong></div>
                <div className="record-line"><span>พร้อมเพย์</span><strong>{emp.bank?.promptPayId ?? '-'}</strong></div>
              </div>
              <div className="action-row" style={{ marginTop: 12 }}>
                {canManage ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                      แก้ข้อมูล
                    </button>
                    {emp.active ? (
                      <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                        ระงับใช้งาน
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="badge">ดูข้อมูลเท่านั้น</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
