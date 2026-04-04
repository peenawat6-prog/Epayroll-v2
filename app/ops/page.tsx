'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { formatThaiDateTime24h } from '@/lib/display-time'

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
    workStartMinutes: number
    workEndMinutes: number
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

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

const DEFAULT_SHOP_LATITUDE = 13.7563
const DEFAULT_SHOP_LONGITUDE = 100.5018
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
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    payrollPayday: '31',
    workStartTime: '09:00',
    workEndTime: '18:00',
    latitude: '',
    longitude: '',
    allowedRadiusMeters: '150',
  })
  const [mapStatus, setMapStatus] = useState('กำลังโหลดแผนที่...')
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletInstance | null>(null)
  const markerRef = useRef<LeafletMarkerInstance | null>(null)

  const loadSummary = async () => {
    const res = await fetch('/api/ops/summary')
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'โหลดข้อมูล ops ไม่สำเร็จ')
    }

    const summaryData = data as OpsSummary
    setSummary(summaryData)
    setForm({
      payrollPayday: String(summaryData.settings.payrollPayday),
      workStartTime: formatClock(summaryData.settings.workStartMinutes),
      workEndTime: formatClock(summaryData.settings.workEndMinutes),
      latitude: summaryData.settings.latitude?.toString() ?? '',
      longitude: summaryData.settings.longitude?.toString() ?? '',
      allowedRadiusMeters: String(summaryData.settings.allowedRadiusMeters),
    })
    setLoading(false)
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

        return loadSummary()
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
            `เลือกพิกัดแล้ว: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}`,
          )
        })

        mapInstanceRef.current = map
        setMapStatus('คลิกบนแผนที่เพื่อเลือกพิกัดร้าน')
      })
      .catch((caughtError) => {
        setMapStatus(
          caughtError instanceof Error
            ? caughtError.message
            : 'โหลดแผนที่ไม่สำเร็จ',
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
          workStartTime: form.workStartTime,
          workEndTime: form.workEndTime,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          allowedRadiusMeters: Number(form.allowedRadiusMeters),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'บันทึกการตั้งค่าไม่สำเร็จ')
      }

      await loadSummary()
      setMessage('บันทึกการตั้งค่าร้านเรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'เกิดข้อผิดพลาด')
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
            <div className="badge">ศูนย์ดูแลระบบร้าน</div>
            <div className="badge">เฉพาะเจ้าของร้านและแอดมิน</div>
          </div>
          <h1 className="hero-title">ตั้งค่าร้านและตรวจสุขภาพระบบ</h1>
          <p className="hero-subtitle">
            ใช้ตั้งค่ารอบเงินเดือนและพิกัดร้านสำหรับการลงเวลาแบบถ่ายรูปและตรวจตำแหน่ง
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/audit')}>
            ดูประวัติการใช้งาน
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            คำขอแก้เวลา
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
              <p className="stat-label">สถานะแอป</p>
              <p className="stat-value">{summary.app}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">สถานะฐานข้อมูล</p>
              <p className="stat-value">{summary.database}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">พนักงาน active</p>
              <p className="stat-value">{summary.activeEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ลงเวลาแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">คำขอแก้เวลา pending</p>
              <p className="stat-value">{summary.pendingCorrections}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Open shift ที่ยังไม่ปิด</p>
              <p className="stat-value">{summary.openAttendanceShifts}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">งวด payroll ที่ lock</p>
              <p className="stat-value">{summary.lockedPayrollPeriods}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Audit 24 ชม. ล่าสุด</p>
              <p className="stat-value">{summary.auditEventsLast24h}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ไฟล์รูปเข้างานที่หาย</p>
              <p className="stat-value">{summary.photoStorage.missingPhotoFiles}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">ตั้งค่าร้านสำหรับใช้งานจริง</h2>
            <p className="panel-subtitle">
              ถ้ายังไม่ตั้งค่าพิกัดร้าน พนักงานจะยังเช็กอินด้วย GPS ไม่ได้
            </p>
            <form onSubmit={handleSaveSettings}>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>วันจ่ายเงินเดือนของร้าน</label>
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
                  <label>เวลาเข้างานปกติ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="09:00"
                    value={form.workStartTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        workStartTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>เวลาเลิกงานปกติ</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="18:00"
                    value={form.workEndTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        workEndTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>ละติจูดร้าน</label>
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
                  <label>ลองจิจูดร้าน</label>
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
                  <label>รัศมีที่อนุญาตให้ลงเวลา (เมตร)</label>
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
                <label>จิ้มพิกัดร้านจากแผนที่</label>
                <div ref={mapContainerRef} className="map-picker" />
                <div className="table-meta">{mapStatus}</div>
              </div>
              <div className="action-row" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">สถานะระบบ</h2>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">สภาพแวดล้อม: {summary.nodeEnv}</div>
              <div className="badge">เวอร์ชัน: {summary.version}</div>
              <div className="badge">
                ตรวจล่าสุด: {formatThaiDateTime24h(summary.timestamp)}
              </div>
              <div className="badge">
                รหัสร้านสำหรับสมัครพนักงาน: {summary.settings.registrationCode}
              </div>
              <div className="badge">
                ตรวจรูปเข้างาน: {summary.photoStorage.checkedPhotoRecords} รายการ
              </div>
              <div className="badge">
                ที่เก็บรูป: {summary.photoStorage.storageRoot}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">ข้อมูลแพ็กเกจ</h2>
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
              <div className="badge">วันจ่ายเงินเดือน: วันที่ {summary.settings.payrollPayday}</div>
              <div className="badge">
                เวลาเข้างาน: {formatClock(summary.settings.workStartMinutes)}
              </div>
              <div className="badge">
                เวลาเลิกงาน: {formatClock(summary.settings.workEndMinutes)}
              </div>
              <div className="badge">
                พิกัดร้าน:{' '}
                {summary.settings.latitude !== null && summary.settings.longitude !== null
                  ? `${summary.settings.latitude}, ${summary.settings.longitude}`
                  : 'ยังไม่ได้ตั้งค่า'}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
