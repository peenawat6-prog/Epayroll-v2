/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import LogoutButton from '@/app/components/logout-button'
import { useLanguage } from '@/lib/language'

type EmployeeOption = {
  id: string
  code: string
  firstName: string
  lastName: string
  active: boolean
  workShift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
}

type BrowserLocation = {
  latitude: number
  longitude: number
}

const MAX_CAPTURE_WIDTH = 720
const MAX_CAPTURE_HEIGHT = 960
const CAPTURE_IMAGE_QUALITY = 0.72

function getScaledImageSize(sourceWidth: number, sourceHeight: number) {
  const widthRatio = MAX_CAPTURE_WIDTH / sourceWidth
  const heightRatio = MAX_CAPTURE_HEIGHT / sourceHeight
  const ratio = Math.min(1, widthRatio, heightRatio)

  return {
    width: Math.max(1, Math.round(sourceWidth * ratio)),
    height: Math.max(1, Math.round(sourceHeight * ratio)),
  }
}

function getCurrentPosition() {
  return new Promise<BrowserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('กรุณาเปิดตำแหน่งก่อนลงเวลา')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  })
}

export default function AttendancePage() {
  const { t } = useLanguage()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraOpening, setCameraOpening] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  )
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const router = useRouter()
  const workShiftLabels = {
    MORNING: t('กะเช้า', 'Morning shift'),
    AFTERNOON: t('กะบ่าย', 'Afternoon shift'),
    NIGHT: t('กะดึก', 'Night shift'),
  } as const
  const locationStatusLabel =
    locationLabel || t('ยังไม่ได้อ่านตำแหน่ง', 'Location not loaded yet')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
    setCameraOpening(false)
  }

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then(() =>
        fetch('/api/employees')
          .then((res) => res.json())
          .then((data) => setEmployees(data))
          .catch(() => setEmployees([])),
      )
      .then(() => setPageLoading(false))
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })

    return () => {
      stopCamera()
    }
  }, [router])

  const clearMessages = () => {
    setMessage('')
    setStatusMessage('')
  }

  const openCamera = async (preferredFacingMode = cameraFacingMode) => {
    clearMessages()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setMessage(
        t(
          'เบราว์เซอร์นี้เปิดกล้องจากหน้าเว็บไม่ได้ กรุณาเปลี่ยนไปใช้อุปกรณ์หรือเบราว์เซอร์ที่รองรับกล้อง',
          'This browser cannot open the camera from this page. Please use a supported device/browser.',
        ),
      )
      return
    }

    setCameraOpening(true)

    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredFacingMode },
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraReady(true)
      setCameraOpening(false)
    } catch (error) {
      if (preferredFacingMode !== 'user') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 960 },
              height: { ideal: 1280 },
            },
            audio: false,
          })

          streamRef.current = fallbackStream

          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream
            await videoRef.current.play()
          }

          setCameraFacingMode('user')
          setCameraReady(true)
          setCameraOpening(false)
          return
        } catch {
          // Fall through to the normal error message below.
        }
      }

      setCameraReady(false)
      setCameraOpening(false)
      setMessage(
        error instanceof Error
          ? `${t('เปิดกล้องไม่สำเร็จ', 'Cannot open camera')}: ${error.message}`
          : t('เปิดกล้องไม่สำเร็จ', 'Cannot open camera'),
      )
    }
  }

  const toggleCameraFacingMode = async () => {
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user'
    setCameraFacingMode(nextFacingMode)
    await openCamera(nextFacingMode)
  }

  const capturePhoto = () => {
    clearMessages()

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !cameraReady) {
      setMessage(t('กรุณาเปิดกล้องก่อนถ่ายรูป', 'Please open the camera first'))
      return
    }

    const sourceWidth = video.videoWidth || MAX_CAPTURE_WIDTH
    const sourceHeight = video.videoHeight || MAX_CAPTURE_HEIGHT
    const { width, height } = getScaledImageSize(sourceWidth, sourceHeight)

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      setMessage(t('ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่', 'Capture failed, please try again'))
      return
    }

    context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', CAPTURE_IMAGE_QUALITY))
    setPhotoName(`camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`)
    setStatusMessage(
      t(
        'ถ่ายรูปเรียบร้อยแล้ว เลือกบันทึกเข้างานได้เลย หรือถ้าจะออกงานให้ใช้รูปใหม่อีกครั้ง',
        'Photo captured. You can now clock in. Take a fresh photo again when clocking out.',
      ),
    )
    stopCamera()
  }

  const handleCheckIn = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage(t('กรุณาเลือกพนักงานก่อน', 'Please select an employee first'))
      return
    }
    if (!photoDataUrl) {
      setMessage(t('กรุณาถ่ายรูปก่อนบันทึกเข้างาน', 'Please take a photo before clocking in'))
      return
    }
    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(
        `${t('ละติจูด', 'Lat')} ${location.latitude.toFixed(5)} / ${t('ลองจิจูด', 'Lng')} ${location.longitude.toFixed(5)}`,
      )

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          photo: photoDataUrl,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || t('บันทึกเข้างานไม่สำเร็จ', 'Clock-in failed'))
      } else {
        setStatusMessage(t('บันทึกเข้างานเรียบร้อยแล้ว', 'Clock-in saved'))
        setPhotoDataUrl('')
        setPhotoName('')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('บันทึกเข้างานไม่สำเร็จ', 'Clock-in failed'),
      )
    }

    setLoading(false)
  }

  const handleCheckOut = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage(t('กรุณาเลือกพนักงานก่อน', 'Please select an employee first'))
      return
    }
    if (!photoDataUrl) {
      setMessage(
        t(
          'กรุณาถ่ายรูปใหม่สำหรับการออกงานก่อนกดบันทึกออกงาน',
          'Please take a new checkout photo before clocking out.',
        ),
      )
      return
    }
    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(
        `${t('ละติจูด', 'Lat')} ${location.latitude.toFixed(5)} / ${t('ลองจิจูด', 'Lng')} ${location.longitude.toFixed(5)}`,
      )

      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          photo: photoDataUrl,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || t('บันทึกออกงานไม่สำเร็จ', 'Clock-out failed'))
      } else {
        setStatusMessage(t('บันทึกออกงานเรียบร้อยแล้ว', 'Clock-out saved'))
        setPhotoDataUrl('')
        setPhotoName('')
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('บันทึกออกงานไม่สำเร็จ', 'Clock-out failed'),
      )
    }

    setLoading(false)
  }

  if (pageLoading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">
              {t('พนักงานที่เลือก', 'Selected employee')}:{' '}
              {selectedEmployee ? t('พร้อมลงเวลา', 'Ready') : t('ยังไม่ได้เลือก', 'Not selected')}
            </div>
          <div className="badge">
            {t(
                'ต้องถ่ายรูปและเปิดตำแหน่งก่อนเข้างาน/ออกงาน',
                'Photo and location are required for clock-in and clock-out',
              )}
            </div>
          </div>
          <h1 className="hero-title">{t('ลงเวลาเข้าออกงาน', 'Attendance')}</h1>
          <p className="hero-subtitle">
            {t(
              'เหมาะกับการใช้งานหน้าร้านบนมือถือ กดง่าย อ่านง่าย และตรวจรูปกับตำแหน่งก่อนบันทึก',
              'Mobile-friendly clock-in/out with photo and GPS verification.',
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            {t('กลับหน้าแรก', 'Back to dashboard')}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance/history')}>
            {t('รายงานการลงเวลา', 'Attendance report')}
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
            {t('ขอลา/OT/ลาออก', 'Leave / OT / resign')}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t('ลงเวลาเข้าออกงาน', 'Clock in / out')}</h2>
        <div className="field" style={{ marginTop: 14 }}>
          <label>{t('พนักงานที่ต้องการลงเวลา', 'Employee')}</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={loading}
          >
            <option value="">{t('เลือกพนักงาน', 'Select employee')}</option>
            {employees
              .filter((emp) => emp.active)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} - {emp.firstName} {emp.lastName} -{' '}
                  {workShiftLabels[emp.workShift]}
                </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>
            {t(
              'ถ่ายรูปหน้าพนักงานก่อนบันทึกเข้างาน/ออกงาน',
              'Take employee photo before clock-in / clock-out',
            )}
          </label>
          <div className="camera-box">
            <video
              ref={videoRef}
              className="camera-preview"
              playsInline
              muted
              autoPlay
              style={{ display: cameraReady ? 'block' : 'none' }}
            />

            {!cameraReady && photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt={t('รูปพนักงานที่ถ่ายไว้', 'Captured employee photo')}
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl ? (
              <div className="camera-placeholder">
                {t(
                  'ยังไม่มีรูปถ่าย กด “เปิดกล้อง” เพื่อถ่ายก่อนบันทึกเข้างานหรือออกงาน',
                  'No photo yet. Tap “Open camera” before clock-in or clock-out.',
                )}
              </div>
            ) : null}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void openCamera()
              }}
              disabled={loading || cameraOpening}
            >
              {cameraOpening
                ? t('กำลังเปิดกล้อง...', 'Opening camera...')
                : cameraReady
                  ? t('เปิดกล้องใหม่', 'Restart camera')
                  : t('เปิดกล้อง', 'Open camera')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capturePhoto}
              disabled={loading || !cameraReady}
            >
              {t('ถ่ายรูป', 'Take photo')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleCameraFacingMode}
              disabled={loading || cameraOpening}
            >
              {cameraFacingMode === 'user'
                ? t('ใช้กล้องหลัง', 'Use back camera')
                : t('ใช้กล้องหน้า', 'Use front camera')}
            </button>
            {cameraReady ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={stopCamera}
                disabled={loading}
              >
                {t('ปิดกล้อง', 'Close camera')}
              </button>
            ) : null}
          </div>

          {!cameraSupported ? (
            <div className="table-meta">
              {t(
                'อุปกรณ์นี้ไม่รองรับการเปิดกล้องจากหน้าเว็บ จึงยังไม่สามารถบันทึกเข้างานได้',
                'This device cannot open the camera from the web page, so clock-in is unavailable.',
              )}
            </div>
          ) : null}

          {photoName ? (
            <div className="table-meta">
              {t('รูปล่าสุด', 'Latest photo')}: {photoName}
            </div>
          ) : null}
          <div className="table-meta">
            {t(
              'หมายเหตุ: การออกงานต้องถ่ายรูปใหม่อีกครั้ง รูปตอนเข้างานใช้แทนกันไม่ได้',
              'Note: Clock-out requires a new photo. The check-in photo cannot be reused.',
            )}
          </div>
          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt={t('ตัวอย่างรูปก่อนลงเวลา', 'Preview before clock-in')}
              className="photo-preview"
            />
          ) : null}
        </div>

        <div className="badge-row" style={{ marginTop: 14 }}>
          <div className="badge">
            {t('ตำแหน่งปัจจุบัน', 'Current location')}: {locationStatusLabel}
          </div>
        </div>

        <div className="action-row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={handleCheckIn} disabled={loading || !photoDataUrl}>
            {loading ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกเข้างาน', 'Clock in')}
          </button>
          <button className="btn btn-secondary" onClick={handleCheckOut} disabled={loading || !photoDataUrl}>
            {loading ? t('กำลังบันทึก...', 'Saving...') : t('บันทึกออกงาน', 'Clock out')}
          </button>
        </div>

        {message ? <div className="message message-error">{message}</div> : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
      </section>
    </div>
  )
}
