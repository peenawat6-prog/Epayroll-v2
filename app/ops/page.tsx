'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDateTime24h } from '@/lib/display-time'
import { useLanguage } from '@/lib/language'

type OpsSummary = {
  app: string
  database: string
  nodeEnv: string
  version: string
  timestamp: string
  activeEmployees: number
  pendingCorrections: number
  lockedPayrollPeriods: number
  openAttendanceShifts: number
  auditEventsLast24h: number
  checkedInToday: number
  photoStorage: {
    storageRoot: string
    checkedPhotoRecords: number
    missingPhotoFiles: number
  }
  settings: {
    registrationCode: string
    payrollPayday: number
    latePenaltyPerMinute: number
    workStartMinutes: number
    workEndMinutes: number
    morningShiftStartMinutes: number
    morningShiftEndMinutes: number
    afternoonShiftStartMinutes: number
    afternoonShiftEndMinutes: number
    nightShiftStartMinutes: number
    nightShiftEndMinutes: number
    latitude: number | null
    longitude: number | null
    allowedRadiusMeters: number
  }
  subscription: {
    plan: string
    status: string
    expiresAt: string | null
    daysRemaining: number | null
  }
}

type LeafletInstance = {
  setView: (center: [number, number], zoom: number) => void
  on: (eventName: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void
  remove: () => void
}

type LeafletMarkerInstance = {
  setLatLng: (center: [number, number]) => void
  addTo: (map: LeafletInstance) => LeafletMarkerInstance
}

type LeafletStatic = {
  map: (element: HTMLElement) => LeafletInstance
  tileLayer: (
    urlTemplate: string,
    options: { maxZoom: number; attribution: string },
  ) => { addTo: (map: LeafletInstance) => void }
  marker: (center: [number, number]) => LeafletMarkerInstance
}

type BranchItem = {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  allowedRadiusMeters: number | null
  employeeCount: number
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

const DEFAULT_SHOP_LATITUDE = 13.7563
const DEFAULT_SHOP_LONGITUDE = 100.5018
const OPS_SETTINGS_DRAFT_KEY = "epayroll-ops-settings-draft"
const LEAFLET_SCRIPT_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_STYLE_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

let leafletLoader: Promise<LeafletStatic> | null = null

function formatClock(minutes: number) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function toCoordinateValue(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function restoreOpsDraft(defaultForm: {
  payrollPayday: string
  latePenaltyPerMinute: string
  morningShiftStartTime: string
  morningShiftEndTime: string
  afternoonShiftStartTime: string
  afternoonShiftEndTime: string
  nightShiftStartTime: string
  nightShiftEndTime: string
  latitude: string
  longitude: string
  allowedRadiusMeters: string
}) {
  const draftText = window.localStorage.getItem(OPS_SETTINGS_DRAFT_KEY)

  if (!draftText) {
    return defaultForm
  }

  try {
    return {
      ...defaultForm,
      ...JSON.parse(draftText),
    }
  } catch {
    return defaultForm
  }
}

function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('เปิดแผนที่ไม่ได้ในฝั่ง server'))
  }

  if (window.L) {
    return Promise.resolve(window.L)
  }

  if (leafletLoader) {
    return leafletLoader
  }

  leafletLoader = new Promise<LeafletStatic>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_STYLE_URL}"]`)) {
      const styleLink = document.createElement('link')
      styleLink.rel = 'stylesheet'
      styleLink.href = LEAFLET_STYLE_URL
      document.head.appendChild(styleLink)
    }

    const existingScript = document.querySelector(
      `script[src="${LEAFLET_SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.L) {
          resolve(window.L)
        } else {
          reject(new Error('โหลดแผนที่ไม่สำเร็จ'))
        }
      })
      existingScript.addEventListener('error', () =>
        reject(new Error('โหลดแผนที่ไม่สำเร็จ')),
      )
      return
    }

    const script = document.createElement('script')
    script.src = LEAFLET_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.L) {
        resolve(window.L)
      } else {
        reject(new Error('โหลดแผนที่ไม่สำเร็จ'))
      }
    }
    script.onerror = () => reject(new Error('โหลดแผนที่ไม่สำเร็จ'))
    document.body.appendChild(script)
  })

  return leafletLoader
}

export default function OpsPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    payrollPayday: '31',
    latePenaltyPerMinute: '0',
    morningShiftStartTime: '09:00',
    morningShiftEndTime: '18:00',
    afternoonShiftStartTime: '13:00',
    afternoonShiftEndTime: '22:00',
    nightShiftStartTime: '22:00',
    nightShiftEndTime: '06:00',
    latitude: '',
    longitude: '',
    allowedRadiusMeters: '150',
  })
  const [branchForm, setBranchForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    allowedRadiusMeters: '',
  })
  const [mapStatus, setMapStatus] = useState('')
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletInstance | null>(null)
  const markerRef = useRef<LeafletMarkerInstance | null>(null)
  const autoSaveTimerRef = useRef<number | null>(null)
  const hydratedSettingsRef = useRef(false)
  const currentMapStatus =
    mapStatus || t('กำลังโหลดแผนที่...', 'Loading map...')

  const loadSummary = async () => {
    const res = await fetch('/api/ops/summary')
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || t('โหลดข้อมูล ops ไม่สำเร็จ', 'Failed to load ops summary'))
    }

    const summaryData = data as OpsSummary
    setSummary(summaryData)
    const nextForm = {
      payrollPayday: String(summaryData.settings.payrollPayday),
      latePenaltyPerMinute: String(summaryData.settings.latePenaltyPerMinute),
      morningShiftStartTime: formatClock(
        summaryData.settings.morningShiftStartMinutes,
      ),
      morningShiftEndTime: formatClock(
        summaryData.settings.morningShiftEndMinutes,
      ),
      afternoonShiftStartTime: formatClock(
        summaryData.settings.afternoonShiftStartMinutes,
      ),
      afternoonShiftEndTime: formatClock(
        summaryData.settings.afternoonShiftEndMinutes,
      ),
      nightShiftStartTime: formatClock(
        summaryData.settings.nightShiftStartMinutes,
      ),
      nightShiftEndTime: formatClock(
        summaryData.settings.nightShiftEndMinutes,
      ),
      latitude: summaryData.settings.latitude?.toString() ?? '',
      longitude: summaryData.settings.longitude?.toString() ?? '',
      allowedRadiusMeters: String(summaryData.settings.allowedRadiusMeters),
    }
    setForm(restoreOpsDraft(nextForm))
    hydratedSettingsRef.current = true
    setLoading(false)
  }

  const loadBranches = async () => {
    const res = await fetch('/api/branches')
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || t('โหลดข้อมูลสาขาไม่สำเร็จ', 'Failed to load branches'))
    }

    setBranches(data.items ?? [])
  }

  const resetBranchForm = () => {
    setEditingBranchId(null)
    setBranchForm({
      name: '',
      latitude: '',
      longitude: '',
      allowedRadiusMeters: '',
    })
  }

  useEffect(() => {
    let mounted = true

    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then((user) => {
        if (!['DEV', 'OWNER', 'ADMIN'].includes(user.role)) {
          throw new Error('forbidden')
        }

        return Promise.all([loadSummary(), loadBranches()])
      })
      .then(() => {
        if (!mounted) return
      })
      .catch((caughtError: Error) => {
        if (!mounted) return

        if (caughtError.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        if (caughtError.message === 'unauthorized') {
          router.push('/login')
          return
        }

        if (caughtError.message === 'forbidden') {
          router.push('/dashboard')
          return
        }

        setError(caughtError.message)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [router])

  useEffect(() => {
    if (!hydratedSettingsRef.current) return

    window.localStorage.setItem(OPS_SETTINGS_DRAFT_KEY, JSON.stringify(form))

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      if (!hydratedSettingsRef.current) return

      fetch('/api/ops/summary', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollPayday: Number(form.payrollPayday),
          latePenaltyPerMinute: Number(form.latePenaltyPerMinute),
          morningShiftStartTime: form.morningShiftStartTime,
          morningShiftEndTime: form.morningShiftEndTime,
          afternoonShiftStartTime: form.afternoonShiftStartTime,
          afternoonShiftEndTime: form.afternoonShiftEndTime,
          nightShiftStartTime: form.nightShiftStartTime,
          nightShiftEndTime: form.nightShiftEndTime,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          allowedRadiusMeters: Number(form.allowedRadiusMeters),
        }),
      })
        .then(async (res) => {
          const responseData = await res.json()
          if (!res.ok) {
            throw new Error(
              responseData.error ||
                t('บันทึกการตั้งค่าไม่สำเร็จ', 'Failed to save settings'),
            )
          }
          setMessage(t('บันทึกการตั้งค่าร้านอัตโนมัติแล้ว', 'Shop settings autosaved'))
          setError('')
        })
        .catch((caughtError) => {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : t('บันทึกการตั้งค่าไม่สำเร็จ', 'Failed to save settings'),
          )
        })
    }, 1200)

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [form, t])

  useEffect(() => {
    if (loading || !mapContainerRef.current || mapInstanceRef.current) {
      return
    }

    let disposed = false

    loadLeaflet()
      .then((leaflet) => {
        if (disposed || !mapContainerRef.current) return

        const latitude = toCoordinateValue(form.latitude, DEFAULT_SHOP_LATITUDE)
        const longitude = toCoordinateValue(
          form.longitude,
          DEFAULT_SHOP_LONGITUDE,
        )
        const map = leaflet.map(mapContainerRef.current)
        map.setView([latitude, longitude], 17)

        leaflet
          .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap',
          })
          .addTo(map)

        markerRef.current = leaflet.marker([latitude, longitude]).addTo(map)
        map.on('click', (event) => {
          const nextLatitude = Number(event.latlng.lat.toFixed(6))
          const nextLongitude = Number(event.latlng.lng.toFixed(6))
          markerRef.current?.setLatLng([nextLatitude, nextLongitude])
          setForm((current) => ({
            ...current,
            latitude: String(nextLatitude),
            longitude: String(nextLongitude),
          }))
          setMapStatus(
            `${t('เลือกพิกัดแล้ว', 'Selected location')}: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}`,
          )
        })

        mapInstanceRef.current = map
        setMapStatus(t('คลิกบนแผนที่เพื่อเลือกพิกัดร้าน', 'Click the map to choose shop location'))
      })
      .catch((caughtError) => {
        setMapStatus(
          caughtError instanceof Error
            ? caughtError.message
            : t('โหลดแผนที่ไม่สำเร็จ', 'Failed to load map'),
        )
      })

    return () => {
      disposed = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [loading])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) {
      return
    }

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return
    }

    markerRef.current.setLatLng([latitude, longitude])
    mapInstanceRef.current.setView([latitude, longitude], 17)
  }, [form.latitude, form.longitude])

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/ops/summary', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollPayday: Number(form.payrollPayday),
          latePenaltyPerMinute: Number(form.latePenaltyPerMinute),
          morningShiftStartTime: form.morningShiftStartTime,
          morningShiftEndTime: form.morningShiftEndTime,
          afternoonShiftStartTime: form.afternoonShiftStartTime,
          afternoonShiftEndTime: form.afternoonShiftEndTime,
          nightShiftStartTime: form.nightShiftStartTime,
          nightShiftEndTime: form.nightShiftEndTime,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          allowedRadiusMeters: Number(form.allowedRadiusMeters),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('บันทึกการตั้งค่าไม่สำเร็จ', 'Failed to save settings'))
      }

      await loadSummary()
      setMessage(t('บันทึกการตั้งค่าร้านเรียบร้อยแล้ว', 'Shop settings saved'))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('เกิดข้อผิดพลาด', 'Something went wrong'))
    } finally {
      setSaving(false)
    }
  }

  const handleEditBranch = (branch: BranchItem) => {
    setEditingBranchId(branch.id)
    setBranchForm({
      name: branch.name,
      latitude: branch.latitude?.toString() ?? '',
      longitude: branch.longitude?.toString() ?? '',
      allowedRadiusMeters: branch.allowedRadiusMeters?.toString() ?? '',
    })
    setMessage('')
    setError('')
  }

  const handleSaveBranch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch(
        editingBranchId ? `/api/branches/${editingBranchId}` : '/api/branches',
        {
          method: editingBranchId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: branchForm.name,
            latitude: branchForm.latitude || null,
            longitude: branchForm.longitude || null,
            allowedRadiusMeters: branchForm.allowedRadiusMeters || null,
          }),
        },
      )
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t('บันทึกสาขาไม่สำเร็จ', 'Failed to save branch'))
      }

      await loadBranches()
      resetBranchForm()
      setMessage(
        editingBranchId
          ? t('แก้ไขข้อมูลสาขาแล้ว', 'Branch updated')
          : t('เพิ่มสาขาใหม่แล้ว', 'Branch added'),
      )
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('เกิดข้อผิดพลาด', 'Something went wrong'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBranch = async (branch: BranchItem) => {
    const confirmed = window.confirm(
      t(
        `ยืนยันลบสาขา "${branch.name}" ? ถ้ามีพนักงานหรือคำขอสมัครผูกอยู่จะลบไม่ได้`,
        `Delete "${branch.name}"? Deletion is blocked when employees or registration requests are still linked.`,
      ),
    )

    if (!confirmed) return

    setSaving(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: "DELETE",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || t("ลบสาขาไม่สำเร็จ", "Failed to delete branch"))
      }

      if (editingBranchId === branch.id) {
        resetBranchForm()
      }

      await loadBranches()
      setMessage(t("ลบสาขาเรียบร้อยแล้ว", "Branch deleted"))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("ลบสาขาไม่สำเร็จ", "Failed to delete branch"),
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t('ศูนย์ดูแลระบบร้าน', 'Ops center')}</div>
            <div className="badge">{t('เฉพาะเจ้าของร้านและแอดมิน', 'Owner/Admin only')}</div>
          </div>
          <h1 className="hero-title">{t('ตั้งค่าร้านและตรวจสุขภาพระบบ', 'Shop settings and system health')}</h1>
          <p className="hero-subtitle">
            {t(
              'ใช้ตั้งค่ารอบเงินเดือนและพิกัดร้านสำหรับการลงเวลาแบบถ่ายรูปและตรวจตำแหน่ง',
              'Configure payday, shift times, and shop location for photo/GPS attendance.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/audit')}>
            {t('ดูประวัติการใช้งาน', 'View audit log')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            {t('คำขอแก้เวลา', 'Attendance corrections')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => window.open('/api/manual/user-manual', '_blank')}
          >
            {t('ดาวน์โหลดคู่มือ PDF', 'Download PDF manual')}
          </button>
          <LogoutButton />
        </div>
      </section>

      {error ? <div className="message message-error">{error}</div> : null}
      {message ? <div className="message message-success">{message}</div> : null}

      {summary ? (
        <>
          <section className="grid stats">
            <article className="stat-card">
              <p className="stat-label">{t('สถานะแอป', 'App status')}</p>
              <p className="stat-value">{summary.app}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('สถานะฐานข้อมูล', 'Database status')}</p>
              <p className="stat-value">{summary.database}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('พนักงาน active', 'Active employees')}</p>
              <p className="stat-value">{summary.activeEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('ลงเวลาแล้ววันนี้', 'Checked in today')}</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('คำขอแก้เวลาที่รอตรวจ', 'Pending corrections')}</p>
              <p className="stat-value">{summary.pendingCorrections}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('รายการที่ยังไม่ได้ออกงาน', 'Open shifts')}</p>
              <p className="stat-value">{summary.openAttendanceShifts}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('งวด payroll ที่ lock', 'Locked payroll periods')}</p>
              <p className="stat-value">{summary.lockedPayrollPeriods}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('รายการตรวจระบบ 24 ชม.', 'Audit events in last 24h')}</p>
              <p className="stat-value">{summary.auditEventsLast24h}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">{t('ไฟล์รูปเข้างานที่หาย', 'Missing check-in photos')}</p>
              <p className="stat-value">{summary.photoStorage.missingPhotoFiles}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('ตั้งค่าร้านสำหรับใช้งานจริง', 'Production shop settings')}</h2>
            <p className="panel-subtitle">
              {t(
                'ถ้ายังไม่ตั้งค่าพิกัดร้าน พนักงานจะยังเช็กอินด้วย GPS ไม่ได้',
                'If shop coordinates are not set, GPS check-in will not work.',
              )}
            </p>
            <form onSubmit={handleSaveSettings}>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>{t('วันจ่ายเงินเดือนของร้าน', 'Shop payday')}</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.payrollPayday}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payrollPayday: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('ค่าปรับมาสายต่อนาที (บาท)', 'Late penalty per minute (THB)')}</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="1"
                    value={form.latePenaltyPerMinute}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        latePenaltyPerMinute: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะเช้า - เวลาเข้างาน', 'Morning shift - start time')}</label>
                  <input
                    type="time"
                    value={form.morningShiftStartTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        morningShiftStartTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะเช้า - เวลาเลิกงาน', 'Morning shift - end time')}</label>
                  <input
                    type="time"
                    value={form.morningShiftEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        morningShiftEndTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะบ่าย - เวลาเข้างาน', 'Afternoon shift - start time')}</label>
                  <input
                    type="time"
                    value={form.afternoonShiftStartTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        afternoonShiftStartTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะบ่าย - เวลาเลิกงาน', 'Afternoon shift - end time')}</label>
                  <input
                    type="time"
                    value={form.afternoonShiftEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        afternoonShiftEndTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะดึก - เวลาเข้างาน', 'Night shift - start time')}</label>
                  <input
                    type="time"
                    value={form.nightShiftStartTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nightShiftStartTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('กะดึก - เวลาเลิกงาน', 'Night shift - end time')}</label>
                  <input
                    type="time"
                    value={form.nightShiftEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nightShiftEndTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>{t('ละติจูดร้าน', 'Shop latitude')}</label>
                  <input
                    inputMode="decimal"
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, latitude: event.target.value }))
                    }
                    placeholder="13.7563"
                  />
                </div>
                <div className="field">
                  <label>{t('ลองจิจูดร้าน', 'Shop longitude')}</label>
                  <input
                    inputMode="decimal"
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, longitude: event.target.value }))
                    }
                    placeholder="100.5018"
                  />
                </div>
                <div className="field">
                  <label>{t('รัศมีที่อนุญาตให้ลงเวลา (เมตร)', 'Allowed check-in radius (m)')}</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={form.allowedRadiusMeters}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowedRadiusMeters: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>{t('จิ้มพิกัดร้านจากแผนที่', 'Pick shop location on map')}</label>
                <div ref={mapContainerRef} className="map-picker" />
                <div className="table-meta">{currentMapStatus}</div>
              </div>
              <div className="action-row" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกการตั้งค่า', 'Save settings')}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('จัดการสาขาในร้านนี้', 'Manage branches')}</h2>
            <p className="panel-subtitle">
              {t(
                'ถ้าสาขามีพิกัดของตัวเอง ระบบจะใช้พิกัดสาขานั้นตรวจ GPS ตอนพนักงานเช็กอินก่อน',
                'If a branch has its own coordinates, those are used first for GPS check-in.',
              )}
            </p>

            <form onSubmit={handleSaveBranch}>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>{t('ชื่อสาขา', 'Branch name')}</label>
                  <input
                    value={branchForm.name}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder={t('เช่น สาขาสยาม', 'e.g. Siam branch')}
                  />
                </div>
                <div className="field">
                  <label>{t('ละติจูดสาขา', 'Branch latitude')}</label>
                  <input
                    inputMode="decimal"
                    value={branchForm.latitude}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        latitude: event.target.value,
                      }))
                    }
                    placeholder={t('ไม่กรอก = ใช้พิกัดร้านหลัก', 'Leave empty to use main shop location')}
                  />
                </div>
                <div className="field">
                  <label>{t('ลองจิจูดสาขา', 'Branch longitude')}</label>
                  <input
                    inputMode="decimal"
                    value={branchForm.longitude}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        longitude: event.target.value,
                      }))
                    }
                    placeholder={t('ไม่กรอก = ใช้พิกัดร้านหลัก', 'Leave empty to use main shop location')}
                  />
                </div>
                <div className="field">
                  <label>{t('รัศมีเช็กอินของสาขา (เมตร)', 'Branch check-in radius (m)')}</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={branchForm.allowedRadiusMeters}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        allowedRadiusMeters: event.target.value,
                      }))
                    }
                    placeholder={t('ไม่กรอก = ใช้รัศมีร้านหลัก', 'Leave empty to use main shop radius')}
                  />
                </div>
              </div>
              <div className="action-row" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {editingBranchId
                      ? saving
                      ? t('กำลังบันทึก...', 'Saving...')
                      : t('บันทึกการแก้ไขสาขา', 'Save branch changes')
                    : saving
                      ? t('กำลังเพิ่ม...', 'Adding...')
                      : t('เพิ่มสาขา', 'Add branch')}
                </button>
                {editingBranchId ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={resetBranchForm}
                  >
                    {t('ยกเลิกแก้ไขสาขา', 'Cancel edit')}
                  </button>
                ) : null}
              </div>
            </form>

            {branches.length === 0 ? (
              <div className="empty-state">{t('ยังไม่มีสาขา', 'No branches yet')}</div>
            ) : (
              <div className="mobile-card-list" style={{ marginTop: 16 }}>
                {branches.map((branch) => (
                  <article key={branch.id} className="record-card">
                    <div className="record-card-head">
                      <strong>{branch.name}</strong>
                      <div className="action-row">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleEditBranch(branch)}
                        >
                          {t('แก้ไขสาขา', 'Edit branch')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDeleteBranch(branch)}
                          disabled={saving}
                        >
                          {t('ลบสาขา', 'Delete branch')}
                        </button>
                      </div>
                    </div>
                    <div className="record-card-body">
                      <div className="record-line">
                        <span>{t('พนักงานในสาขา', 'Employees in branch')}</span>
                        <strong>{branch.employeeCount} {t('คน', 'people')}</strong>
                      </div>
                      <div className="record-line">
                        <span>{t('พิกัดสาขา', 'Branch coordinates')}</span>
                        <strong>
                          {branch.latitude !== null && branch.longitude !== null
                            ? `${branch.latitude}, ${branch.longitude}`
                            : t('ใช้พิกัดร้านหลัก', 'Use main shop location')}
                        </strong>
                      </div>
                      <div className="record-line">
                        <span>{t('รัศมีเช็กอิน', 'Check-in radius')}</span>
                        <strong>
                          {branch.allowedRadiusMeters
                            ? `${branch.allowedRadiusMeters} ${t('เมตร', 'm')}`
                            : t('ใช้รัศมีร้านหลัก', 'Use main shop radius')}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('ข้อมูลใช้งานร้าน', 'Shop info')}</h2>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                {t('อัปเดตล่าสุด', 'Last updated')}: {formatThaiDateTime24h(summary.timestamp)}
              </div>
              <div className="badge">
                {t('รหัสร้านสำหรับสมัครพนักงาน', 'Shop code for employee signup')}: {summary.settings.registrationCode}
              </div>
              <div className="badge">
                {t('รูปเข้างานที่ตรวจแล้ว', 'Photo records checked')}: {summary.photoStorage.checkedPhotoRecords} {t('รายการ', 'records')}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">{t('สถานะการใช้งานระบบ', 'Service status')}</h2>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                {t('วันคงเหลือ', 'Days left')}: {summary.subscription.daysRemaining ?? t('ไม่ได้กำหนด', 'Not set')}
              </div>
              <div className="badge">
                {t('หมดอายุ', 'Expires')}:{' '}
                {summary.subscription.expiresAt
                  ? new Date(summary.subscription.expiresAt).toLocaleDateString('th-TH')
                  : t('ไม่ได้กำหนด', 'Not set')}
              </div>
              <div className="badge">{t('วันจ่ายเงินเดือน', 'Payday')}: {summary.settings.payrollPayday}</div>
              <div className="badge">
                {t('ค่าปรับสาย', 'Late penalty')}: {summary.settings.latePenaltyPerMinute} {t('บาท/นาที', 'THB/min')}
              </div>
              <div className="badge">
                {t('กะเช้า', 'Morning shift')}: {formatClock(summary.settings.morningShiftStartMinutes)}-
                {formatClock(summary.settings.morningShiftEndMinutes)}
              </div>
              <div className="badge">
                {t('กะบ่าย', 'Afternoon shift')}: {formatClock(summary.settings.afternoonShiftStartMinutes)}-
                {formatClock(summary.settings.afternoonShiftEndMinutes)}
              </div>
              <div className="badge">
                {t('กะดึก', 'Night shift')}: {formatClock(summary.settings.nightShiftStartMinutes)}-
                {formatClock(summary.settings.nightShiftEndMinutes)}
              </div>
              <div className="badge">
                {t('พิกัดร้าน', 'Shop location')}:{' '}
                {summary.settings.latitude !== null && summary.settings.longitude !== null
                  ? `${summary.settings.latitude}, ${summary.settings.longitude}`
                  : t('ยังไม่ได้ตั้งค่า', 'Not set')}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
