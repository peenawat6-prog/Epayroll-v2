"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import LogoutButton from "@/app/components/logout-button"
import { formatThaiTime24h } from "@/lib/display-time"

type EmployeeProfile = {
  id: string
  code: string
  firstName: string
  lastName: string
  position: string
  active: boolean
  bank: {
    bankName: string
    accountName: string
    accountNumber: string
    promptPayId: string | null
  } | null
}

type TodayAttendance = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  checkInPhotoUrl: string | null
  workedMinutes: number
  lateMinutes: number
  status: string
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
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error("กรุณาเปิดตำแหน่งก่อนลงเวลา")),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  })
}

export default function EmployeePage() {
  const router = useRouter()
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(
    null,
  )
  const [photoDataUrl, setPhotoDataUrl] = useState("")
  const [photoName, setPhotoName] = useState("")
  const [locationLabel, setLocationLabel] = useState("ยังไม่ได้อ่านตำแหน่ง")
  const [message, setMessage] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [pageLoading, setPageLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    promptPayId: "",
  })
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraOpening, setCameraOpening] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
    setCameraOpening(false)
  }

  const clearMessages = () => {
    setMessage("")
    setStatusMessage("")
  }

  const loadProfile = async () => {
    const res = await fetch("/api/employee/me")
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || "โหลดข้อมูลพนักงานไม่สำเร็จ")
    }

    setEmployee(data.employee)
    setTodayAttendance(data.todayAttendance)
    setBankForm({
      bankName: data.employee?.bank?.bankName ?? "",
      accountName: data.employee?.bank?.accountName ?? "",
      accountNumber: data.employee?.bank?.accountNumber ?? "",
      promptPayId: data.employee?.bank?.promptPayId ?? "",
    })
    setPageLoading(false)
  }

  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        Boolean(navigator.mediaDevices?.getUserMedia),
    )

    loadProfile().catch((error: Error) => {
      if (error.message === "Subscription expired") {
        router.push("/subscription-expired")
        return
      }

      router.push("/login")
    })

    return () => {
      stopCamera()
    }
  }, [router])

  const openCamera = async () => {
    clearMessages()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setMessage("อุปกรณ์นี้เปิดกล้องจากหน้าเว็บไม่ได้")
      return
    }

    setCameraOpening(true)

    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
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
          : "เปิดกล้องไม่สำเร็จ",
      )
    }
  }

  const capturePhoto = () => {
    clearMessages()

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !cameraReady) {
      setMessage("กรุณาเปิดกล้องก่อนถ่ายรูป")
      return
    }

    const sourceWidth = video.videoWidth || MAX_CAPTURE_WIDTH
    const sourceHeight = video.videoHeight || MAX_CAPTURE_HEIGHT
    const { width, height } = getScaledImageSize(sourceWidth, sourceHeight)

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")

    if (!context) {
      setMessage("ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่")
      return
    }

    context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", CAPTURE_IMAGE_QUALITY))
    setPhotoName(
      `camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`,
    )
    setStatusMessage("ถ่ายรูปเรียบร้อยแล้ว กดบันทึกเข้างานได้เลย")
    stopCamera()
  }

  const handleCheckIn = async () => {
    clearMessages()

    if (!photoDataUrl) {
      setMessage("กรุณาถ่ายรูปก่อนบันทึกเข้างาน")
      return
    }

    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(
        `ละติจูด ${location.latitude.toFixed(5)} / ลองจิจูด ${location.longitude.toFixed(5)}`,
      )

      const res = await fetch("/api/employee/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photo: photoDataUrl,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "บันทึกเข้างานไม่สำเร็จ")
      }

      setStatusMessage("บันทึกเข้างานเรียบร้อยแล้ว")
      setPhotoDataUrl("")
      setPhotoName("")
      await loadProfile()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกเข้างานไม่สำเร็จ")
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    clearMessages()
    setLoading(true)

    try {
      const res = await fetch("/api/employee/check-out", {
        method: "POST",
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "บันทึกออกงานไม่สำเร็จ")
      }

      setStatusMessage("บันทึกออกงานเรียบร้อยแล้ว")
      await loadProfile()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "บันทึกออกงานไม่สำเร็จ",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBank = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearMessages()
    setBankSaving(true)

    try {
      const res = await fetch("/api/employee/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bankForm),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ")
      }

      setEmployee(data.employee)
      setStatusMessage(data.message || "บันทึกข้อมูลบัญชีรับเงินเรียบร้อยแล้ว")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ",
      )
    } finally {
      setBankSaving(false)
    }
  }

  if (pageLoading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">โหมดพนักงานหน้าร้าน</div>
            <div className="badge">
              {employee
                ? `${employee.code} ${employee.firstName} ${employee.lastName}`
                : "ไม่พบข้อมูลพนักงาน"}
            </div>
          </div>
          <h1 className="hero-title">ลงเวลาและดูสถานะของฉัน</h1>
          <p className="hero-subtitle">
            ใช้สำหรับบันทึกเข้างาน/ออกงานและส่งคำขอของตัวเอง
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push("/requests")}>
            ขอลา/OT/ลาออก
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="grid stats">
        <article className="stat-card">
          <p className="stat-label">ตำแหน่ง</p>
          <p className="stat-value">{employee?.position ?? "-"}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">สถานะวันนี้</p>
          <p className="stat-value">{todayAttendance?.status ?? "ยังไม่ได้ลงเวลา"}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">เข้างาน</p>
          <p className="stat-value">
            {todayAttendance?.checkIn
              ? formatThaiTime24h(todayAttendance.checkIn)
              : "-"}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">ออกงาน</p>
          <p className="stat-value">
            {todayAttendance?.checkOut
              ? formatThaiTime24h(todayAttendance.checkOut)
              : "-"}
          </p>
        </article>
      </section>

      <section className="panel">
        <h2 className="panel-title">ข้อมูลบัญชีรับเงินของฉัน</h2>
        <p className="panel-subtitle">
          กรอกข้อมูลบัญชีให้ครบ เพื่อให้ร้านใช้โอนเงินเดือนได้ถูกต้อง
        </p>

        <form onSubmit={handleSaveBank}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="employee-bank-name">ธนาคารที่รับเงิน</label>
              <input
                id="employee-bank-name"
                value={bankForm.bankName}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    bankName: event.target.value,
                  }))
                }
                placeholder="เช่น SCB, KBank, Krungthai"
              />
            </div>
            <div className="field">
              <label htmlFor="employee-account-name">ชื่อบัญชีรับเงิน</label>
              <input
                id="employee-account-name"
                value={bankForm.accountName}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    accountName: event.target.value,
                  }))
                }
                placeholder="ชื่อตามสมุดบัญชี"
              />
            </div>
            <div className="field">
              <label htmlFor="employee-account-number">เลขบัญชีธนาคาร</label>
              <input
                id="employee-account-number"
                value={bankForm.accountNumber}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    accountNumber: event.target.value,
                  }))
                }
                placeholder="กรอกเลขบัญชี"
              />
            </div>
            <div className="field">
              <label htmlFor="employee-promptpay-id">พร้อมเพย์</label>
              <input
                id="employee-promptpay-id"
                value={bankForm.promptPayId}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    promptPayId: event.target.value,
                  }))
                }
                placeholder="เบอร์โทรหรือเลขบัตร"
              />
            </div>
          </div>

          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={bankSaving}>
              {bankSaving ? "กำลังบันทึก..." : "บันทึกบัญชีรับเงิน"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">บันทึกเข้างานด้วยรูปถ่ายและตำแหน่ง</h2>

        <div className="field" style={{ marginTop: 14 }}>
          <label>ถ่ายรูปหน้าพนักงาน</label>
          <div className="camera-box">
            <video
              ref={videoRef}
              className="camera-preview"
              playsInline
              muted
              autoPlay
              style={{ display: cameraReady ? "block" : "none" }}
            />

            {!cameraReady && photoDataUrl ? (
              <img
                src={photoDataUrl}
                alt="รูปที่ถ่ายไว้"
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl && todayAttendance?.checkInPhotoUrl ? (
              <img
                src={todayAttendance.checkInPhotoUrl}
                alt="รูปเข้างานวันนี้"
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl && !todayAttendance?.checkInPhotoUrl ? (
              <div className="camera-placeholder">
                ยังไม่มีรูปถ่ายวันนี้ กด “เปิดกล้อง” เพื่อถ่ายก่อนบันทึกเข้างาน
              </div>
            ) : null}
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCamera}
              disabled={loading || cameraOpening || Boolean(todayAttendance?.checkIn)}
            >
              {cameraOpening
                ? "กำลังเปิดกล้อง..."
                : cameraReady
                  ? "เปิดกล้องใหม่"
                  : "เปิดกล้อง"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capturePhoto}
              disabled={loading || !cameraReady || Boolean(todayAttendance?.checkIn)}
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
            <div className="table-meta">อุปกรณ์นี้ไม่รองรับการเปิดกล้องจากหน้าเว็บ</div>
          ) : null}

          {photoName ? <div className="table-meta">รูปล่าสุด: {photoName}</div> : null}
          <div className="table-meta">ตำแหน่ง GPS: {locationLabel}</div>
        </div>

        <div className="action-row" style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary"
            onClick={handleCheckIn}
            disabled={loading || Boolean(todayAttendance?.checkIn)}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกเข้างาน"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleCheckOut}
            disabled={loading || !todayAttendance?.checkIn || Boolean(todayAttendance?.checkOut)}
          >
            {loading ? "กำลังบันทึก..." : "บันทึกออกงาน"}
          </button>
        </div>

        {message ? <div className="message message-error">{message}</div> : null}
        {statusMessage ? (
          <div className="message message-success">{statusMessage}</div>
        ) : null}
      </section>
    </div>
  )
}
