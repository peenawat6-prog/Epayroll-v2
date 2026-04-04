'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatThaiDateTime24h } from '@/lib/display-time'

type AuditItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

type AuditResponse = {
  items: AuditItem[]
}

export default function AuditPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')

  const loadAudit = async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (entityType.trim()) params.set('entityType', entityType.trim())
    if (action.trim()) params.set('action', action.trim())
    if (userId.trim()) params.set('userId', userId.trim())
    params.set('limit', '100')

    const res = await fetch(`/api/audit?${params.toString()}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'โหลด audit log ไม่สำเร็จ')
    }

    setRecords((data as AuditResponse).items)
    setLoading(false)
  }

  const exportCsv = () => {
    if (records.length === 0) return

    const header = ['createdAt', 'action', 'entityType', 'entityId', 'userId', 'metadata']
    const rows = records.map((record) => [
      record.createdAt,
      record.action,
      record.entityType,
      record.entityId ?? '',
      record.userId ?? '',
      JSON.stringify(record.metadata ?? {}),
    ])
    const csvContent = [header.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then(() => {
        setAuthorized(true)
        return loadAudit()
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

        setError(error.message)
        setLoading(false)
      })
  }, [router])

  useEffect(() => {
    if (!authorized) return
    loadAudit().catch(() => undefined)
  }, [search, entityType, action, userId])

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">รายการล่าสุด {records.length} รายการ</div>
            <div className="badge">Operational audit trail</div>
          </div>
          <h1 className="hero-title">Audit Log</h1>
          <p className="hero-subtitle">
            ใช้ตรวจย้อนหลัง action สำคัญ เช่น attendance, employee และ payroll
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
            Ops Center
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/payroll')}>
            ไปหน้า Payroll
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            ดาวน์โหลด CSV
          </button>
        </div>
      </section>

      <section className="panel">
        {error ? <div className="message message-error">{error}</div> : null}
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>ค้นหา</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="action, entity หรือ id"
            />
          </div>
          <div className="field">
            <label>Entity type</label>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="AttendanceCorrection"
            />
          </div>
          <div className="field">
            <label>Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="payroll.locked"
            />
          </div>
          <div className="field">
            <label>User ID</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty-state">ยังไม่มี audit log ใน tenant นี้</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{formatThaiDateTime24h(record.createdAt)}</td>
                    <td>{record.action}</td>
                    <td>
                      <div>{record.entityType}</div>
                      <div className="table-meta">{record.entityId ?? '-'}</div>
                    </td>
                    <td>{record.userId ?? '-'}</td>
                    <td>
                      <pre className="table-meta pre-wrap">
                        {record.metadata ? JSON.stringify(record.metadata, null, 2) : '-'}
                      </pre>
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
