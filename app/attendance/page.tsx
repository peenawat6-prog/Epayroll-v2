'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type EmployeeOption = {
  id: string
  code: string
  firstName: string
  lastName: string
  active: boolean
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
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [locationLabel, setLocationLabel] = useState('ยังไม่ได้อ่านตำแหน่ง')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraOpening, setCameraOpening] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const router = useRouter()

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
    setCameraSupported(
      typeof navigator !== 'undefined' &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    )

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

  const openCamera = async () => {
    clearMessages()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setMessage('เบราว์เซอร์นี้เปิดกล้องจากหน้าเว็บไม่ได้ กรุณาเปลี่ยนไปใช้อุปกรณ์หรือเบราว์เซอร์ที่รองรับกล้อง')
      return
    }

    setCameraOpening(true)

    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
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
      setCameraReady(false)
      setCameraOpening(false)
      setMessage(
        error instanceof Error
          ? `เปิดกล้องไม่สำเร็จ: ${error.message}`
          : 'เปิดกล้องไม่สำเร็จ กรุณาใช้ปุ่มเลือกรูปสำรอง',
      )
    }
  }

  const capturePhoto = () => {
    clearMessages()

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !cameraReady) {
      setMessage('กรุณาเปิดกล้องก่อนถ่ายรูป')
      return
    }

    const sourceWidth = video.videoWidth || MAX_CAPTURE_WIDTH
    const sourceHeight = video.videoHeight || MAX_CAPTURE_HEIGHT
    const { width, height } = getScaledImageSize(sourceWidth, sourceHeight)

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')

    if (!context) {
      setMessage('ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่')
      return
    }

    context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
    setPhotoDataUrl(canvas.toDataURL('image/jpeg', CAPTURE_IMAGE_QUALITY))
    setPhotoName(`camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`)
    setStatusMessage('ถ่ายรูปเรียบร้อยแล้ว กดบันทึกเข้างานได้เลย')
    stopCamera()
  }

  const handleCheckIn = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage('กรุณาเลือกพนักงานก่อน')
      return
    }
    if (!photoDataUrl) {
      setMessage('กรุณาถ่ายรูปก่อนบันทึกเข้างาน')
      return
    }
    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(`ละติจูด ${location.latitude.toFixed(5)} / ลองจิจูด ${location.longitude.toFixed(5)}`)

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
        setMessage(data.error || 'บันทึกเข้างานไม่สำเร็จ')
      } else {
        setStatusMessage('บันทึกเข้างานเรียบร้อยแล้ว')
        setPhotoDataUrl('')
        setPhotoName('')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกเข้างานไม่สำเร็จ')
    }

    setLoading(false)
  }

  const handleCheckOut = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage('กรุณาเลือกพนักงานก่อน')
      return
    }
    setLoading(true)
    const res = await fetch('/api/attendance/check-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmployee }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'บันทึกออกงานไม่สำเร็จ')
    } else {
      setStatusMessage('บันทึกออกงานเรียบร้อยแล้ว')
    }
    setLoading(false)
  }

  if (pageLoading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">พนักงานที่เลือก: {selectedEmployee ? 'พร้อมลงเวลา' : 'ยังไม่ได้เลือก'}</div>
            <div className="badge">ต้องถ่ายรูปและเปิดตำแหน่งก่อนเข้างาน</div>
          </div>
          <h1 className="hero-title">ลงเวลาเข้าออกงาน</h1>
          <p className="hero-subtitle">เหมาะกับการใช้งานหน้าร้านบนมือถือ กดง่าย อ่านง่าย และตรวจรูปกับตำแหน่งก่อนบันทึก</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance/history')}>
            รายงานการลงเวลา
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/requests')}>
            ขอลา/OT/ลาออก
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">ลงเวลาเข้างาน</h2>
        <div className="field" style={{ marginTop: 14 }}>
          <label>พนักงานที่ต้องการลงเวลา</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={loading}
          >
            <option value="">เลือกพนักงาน</option>
            {employees
              .filter((emp) => emp.active)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} - {emp.firstName} {emp.lastName}
                </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>ถ่ายรูปหน้าพนักงานก่อนบันทึก</label>
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
                alt="รูปพนักงานที่ถ่ายไว้"
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl ? (
              <div className="camera-placeholder">
                ยังไม่มีรูปถ่าย กด “เปิดกล้อง” เพื่อถ่ายจากหน้านี้ได้เลย
              </div>
            ) : null}
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCamera}
              disabled={loading || cameraOpening}
            >
              {cameraOpening ? 'กำลังเปิดกล้อง...' : cameraReady ? 'เปิดกล้องใหม่' : 'เปิดกล้อง'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capturePhoto}
              disabled={loading || !cameraReady}
            >
              ถ่ายรูป
            </button>
            {cameraReady ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={stopCamera}
                disabled={loading}
              >
                ปิดกล้อง
              </button>
            ) : null}
          </div>

          {!cameraSupported ? (
            <div className="table-meta">
              อุปกรณ์นี้ไม่รองรับการเปิดกล้องจากหน้าเว็บ จึงยังไม่สามารถบันทึกเข้างานได้
            </div>
          ) : null}

          {photoName ? <div className="table-meta">รูปล่าสุด: {photoName}</div> : null}
          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt="ตัวอย่างรูปก่อนลงเวลา"
              className="photo-preview"
            />
          ) : null}
        </div>

        <div className="badge-row" style={{ marginTop: 14 }}>
          <div className="badge">สถานะตำแหน่ง: {locationLabel}</div>
        </div>

        <div className="action-row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={handleCheckIn} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกเข้างาน'}
          </button>
          <button className="btn btn-secondary" onClick={handleCheckOut} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกออกงาน'}
          </button>
        </div>

        {message ? <div className="message message-error">{message}</div> : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
      </section>
    </div>
  )
}
