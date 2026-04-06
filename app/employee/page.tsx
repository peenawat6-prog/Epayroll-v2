"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import LogoutButton from "@/app/components/logout-button"
import { formatThaiTime24h } from "@/lib/display-time"
import { useLanguage } from "@/lib/language"
import { getAttendanceStatusLabel, getWorkShiftLabel, maskAccountValue } from "@/lib/ui-format"

type EmployeeProfile = {
  id: string
  code: string
  firstName: string
  lastName: string
  position: string
  workShift: "MORNING" | "AFTERNOON" | "NIGHT"
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
  checkOutPhotoUrl: string | null
  workedMinutes: number
  lateMinutes: number
  status: string
  workShift: "MORNING" | "AFTERNOON" | "NIGHT"
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
  const { t, language } = useLanguage()
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null)
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(
    null,
  )
  const [photoDataUrl, setPhotoDataUrl] = useState("")
  const [photoName, setPhotoName] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
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
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user")
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
      throw new Error(data.error || t("โหลดข้อมูลพนักงานไม่สำเร็จ", "Failed to load employee profile"))
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

  const openCamera = async (preferredFacingMode = cameraFacingMode) => {
    clearMessages()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false)
      setMessage(t("อุปกรณ์นี้เปิดกล้องจากหน้าเว็บไม่ได้", "This device cannot open the camera from this page"))
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
      if (preferredFacingMode !== "user") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "user" },
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

          setCameraFacingMode("user")
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
          ? `${t("เปิดกล้องไม่สำเร็จ", "Cannot open camera")}: ${error.message}`
          : t("เปิดกล้องไม่สำเร็จ", "Cannot open camera"),
      )
    }
  }

  const toggleCameraFacingMode = async () => {
    const nextFacingMode = cameraFacingMode === "user" ? "environment" : "user"
    setCameraFacingMode(nextFacingMode)
    await openCamera(nextFacingMode)
  }

  const capturePhoto = () => {
    clearMessages()

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas || !cameraReady) {
      setMessage(t("กรุณาเปิดกล้องก่อนถ่ายรูป", "Please open the camera first"))
      return
    }

    const sourceWidth = video.videoWidth || MAX_CAPTURE_WIDTH
    const sourceHeight = video.videoHeight || MAX_CAPTURE_HEIGHT
    const { width, height } = getScaledImageSize(sourceWidth, sourceHeight)

    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")

    if (!context) {
      setMessage(t("ถ่ายรูปไม่สำเร็จ กรุณาลองใหม่", "Capture failed, please try again"))
      return
    }

    context.drawImage(video, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height)
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", CAPTURE_IMAGE_QUALITY))
    setPhotoName(
      `camera-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`,
    )
    setStatusMessage(
      todayAttendance?.checkIn && !todayAttendance?.checkOut
        ? t("ถ่ายรูปเรียบร้อยแล้ว กดบันทึกออกงานได้เลย", "Photo captured. You can now clock out.")
        : t("ถ่ายรูปเรียบร้อยแล้ว กดบันทึกเข้างานได้เลย", "Photo captured. You can now clock in."),
    )
    stopCamera()
  }

  const handleCheckIn = async () => {
    clearMessages()

    if (!photoDataUrl) {
      setMessage(t("กรุณาถ่ายรูปก่อนบันทึกเข้างาน", "Please take a photo before clocking in"))
      return
    }

    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(
        `${t("ละติจูด", "Lat")} ${location.latitude.toFixed(5)} / ${t("ลองจิจูด", "Lng")} ${location.longitude.toFixed(5)}`,
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
        throw new Error(data.error || t("บันทึกเข้างานไม่สำเร็จ", "Clock-in failed"))
      }

      setStatusMessage(t("บันทึกเข้างานเรียบร้อยแล้ว", "Clock-in saved"))
      setPhotoDataUrl("")
      setPhotoName("")
      await loadProfile()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("บันทึกเข้างานไม่สำเร็จ", "Clock-in failed"),
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    clearMessages()

    if (!photoDataUrl) {
      setMessage(t("กรุณาถ่ายรูปก่อนบันทึกออกงาน", "Please take a photo before clocking out"))
      return
    }

    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(
        `${t("อ่านตำแหน่งแล้ว", "Location ready")} ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      )

      const res = await fetch("/api/employee/check-out", {
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
        throw new Error(data.error || t("บันทึกออกงานไม่สำเร็จ", "Clock-out failed"))
      }

      setStatusMessage(t("บันทึกออกงานเรียบร้อยแล้ว", "Clock-out saved"))
      setPhotoDataUrl("")
      setPhotoName("")
      await loadProfile()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("บันทึกออกงานไม่สำเร็จ", "Clock-out failed"),
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
        throw new Error(
          data.error ||
            t("บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ", "Failed to save payment account info"),
        )
      }

      setEmployee(data.employee)
      setStatusMessage(
        data.message ||
          t("บันทึกข้อมูลบัญชีรับเงินเรียบร้อยแล้ว", "Payment account info saved"),
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("บันทึกข้อมูลบัญชีรับเงินไม่สำเร็จ", "Failed to save payment account info"),
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
            <div className="badge">{t("โหมดพนักงานหน้าร้าน", "Employee mode")}</div>
            <div className="badge">
              {employee
                ? `${employee.code} ${employee.firstName} ${employee.lastName}`
                : t("ไม่พบข้อมูลพนักงาน", "Employee data not found")}
            </div>
          </div>
          <h1 className="hero-title">{t("ลงเวลาและดูสถานะของฉัน", "My attendance")}</h1>
          <p className="hero-subtitle">
            {t(
              "ใช้สำหรับบันทึกเข้างาน/ออกงานและส่งคำขอของตัวเอง",
              "Clock in/out and submit your own requests here.",
            )}
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push("/requests")}>
            {t("ขอลา/OT/ลาออก", "Leave / OT / resign")}
          </button>
          <LogoutButton />
        </div>
      </section>

      <section className="grid stats">
        <article className="stat-card">
          <p className="stat-label">{t("ตำแหน่ง", "Position")}</p>
          <p className="stat-value">{employee?.position ?? "-"}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">{t("กะทำงาน", "Shift")}</p>
          <p className="stat-value">
            {employee?.workShift ? getWorkShiftLabel(employee.workShift, language) : "-"}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">{t("สถานะวันนี้", "Today status")}</p>
          <p className="stat-value">
            {todayAttendance?.status
              ? getAttendanceStatusLabel(todayAttendance.status, language)
              : t("ยังไม่ได้ลงเวลา", "Not checked in yet")}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">{t("เข้างาน", "Check-in")}</p>
          <p className="stat-value">
            {todayAttendance?.checkIn
              ? formatThaiTime24h(todayAttendance.checkIn)
              : "-"}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">{t("ออกงาน", "Check-out")}</p>
          <p className="stat-value">
            {todayAttendance?.checkOut
              ? formatThaiTime24h(todayAttendance.checkOut)
              : "-"}
          </p>
        </article>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t("ข้อมูลบัญชีรับเงินของฉัน", "My payment account")}</h2>
        <p className="panel-subtitle">
          {t(
            "กรอกข้อมูลบัญชีให้ครบ เพื่อให้ร้านใช้โอนเงินเดือนได้ถูกต้อง",
            "Fill in your account info so the shop can transfer salary correctly.",
          )}
        </p>

        <form onSubmit={handleSaveBank}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="employee-bank-name">{t("ธนาคารที่รับเงิน", "Bank")}</label>
              <input
                id="employee-bank-name"
                value={bankForm.bankName}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    bankName: event.target.value,
                  }))
                }
                placeholder={t("เช่น SCB, KBank, Krungthai", "e.g. SCB, KBank, Krungthai")}
              />
            </div>
            <div className="field">
              <label htmlFor="employee-account-name">{t("ชื่อบัญชีรับเงิน", "Account name")}</label>
              <input
                id="employee-account-name"
                value={bankForm.accountName}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    accountName: event.target.value,
                  }))
                }
                placeholder={t("ชื่อตามสมุดบัญชี", "Account holder name")}
              />
            </div>
            <div className="field">
              <label htmlFor="employee-account-number">{t("เลขบัญชีธนาคาร", "Account number")}</label>
              <input
                id="employee-account-number"
                value={bankForm.accountNumber}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    accountNumber: event.target.value,
                  }))
                }
                placeholder={t("กรอกเลขบัญชี", "Enter account number")}
              />
              {bankForm.accountNumber ? (
                <div className="table-meta">
                  {t("แสดงในหน้ารวมเป็น", "Shown in list as")} {maskAccountValue(bankForm.accountNumber)}
                </div>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="employee-promptpay-id">{t("พร้อมเพย์", "PromptPay")}</label>
              <input
                id="employee-promptpay-id"
                value={bankForm.promptPayId}
                onChange={(event) =>
                  setBankForm((current) => ({
                    ...current,
                    promptPayId: event.target.value,
                  }))
                }
                placeholder={t("เบอร์โทรหรือเลขบัตร", "Phone number or ID number")}
              />
              {bankForm.promptPayId ? (
                <div className="table-meta">
                  {t("แสดงในหน้ารวมเป็น", "Shown in list as")} {maskAccountValue(bankForm.promptPayId)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={bankSaving}>
              {bankSaving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกบัญชีรับเงิน", "Save payment account")}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel-title">
          {t("ถ่ายรูปยืนยันตัวตนก่อนเข้างาน/ออกงาน", "Take a photo before clock-in / clock-out")}
        </h2>

        <div className="field" style={{ marginTop: 14 }}>
          <label>
            {todayAttendance?.checkIn && !todayAttendance?.checkOut
              ? t("ถ่ายรูปก่อนบันทึกออกงาน", "Take a photo before clock-out")
              : t("ถ่ายรูปก่อนบันทึกเข้างาน", "Take a photo before clock-in")}
          </label>
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
                alt={t("รูปที่ถ่ายไว้", "Captured photo")}
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl && todayAttendance?.checkInPhotoUrl ? (
              <img
                src={
                  todayAttendance.checkOutPhotoUrl ||
                  todayAttendance.checkInPhotoUrl
                }
                alt={t("รูปล่าสุดของวันนี้", "Latest photo today")}
                className="camera-preview"
              />
            ) : null}

            {!cameraReady && !photoDataUrl && !todayAttendance?.checkInPhotoUrl ? (
              <div className="camera-placeholder">
                {t(
                  "กด “เปิดกล้อง” แล้วถ่ายรูปก่อนบันทึกเข้างานหรือออกงาน",
                  'Tap "Open camera" and take a photo before clock-in or clock-out.',
                )}
              </div>
            ) : null}
          </div>

          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void openCamera()
              }}
              disabled={loading || cameraOpening || Boolean(todayAttendance?.checkOut)}
            >
              {cameraOpening
                ? t("กำลังเปิดกล้อง...", "Opening camera...")
                : cameraReady
                  ? t("เปิดกล้องใหม่", "Restart camera")
                  : t("เปิดกล้อง", "Open camera")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capturePhoto}
              disabled={loading || !cameraReady || Boolean(todayAttendance?.checkOut)}
            >
              {t("ถ่ายรูป", "Take photo")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleCameraFacingMode}
              disabled={loading || cameraOpening || Boolean(todayAttendance?.checkOut)}
            >
              {cameraFacingMode === "user"
                ? t("ใช้กล้องหลัง", "Use back camera")
                : t("ใช้กล้องหน้า", "Use front camera")}
            </button>
            {cameraReady ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={stopCamera}
                disabled={loading}
              >
                {t("ปิดกล้อง", "Close camera")}
              </button>
            ) : null}
          </div>

          {!cameraSupported ? (
            <div className="table-meta">
              {t(
                "อุปกรณ์นี้ไม่รองรับการเปิดกล้องจากหน้าเว็บ",
                "This device cannot open the camera from this page",
              )}
            </div>
          ) : null}

          <div className="table-meta">
            {locationLabel
              ? t("อ่านตำแหน่งเรียบร้อยแล้ว", "Location ready")
              : t(
                  "ระบบจะอ่านตำแหน่งอัตโนมัติตอนกดบันทึกเข้างานหรือออกงาน",
                  "Location will be checked automatically when you tap clock in or clock out",
                )}
          </div>
            {photoName ? <div className="table-meta">{t("มีรูปพร้อมบันทึกแล้ว", "Photo ready")}</div> : null}
        </div>

        <div className="action-row" style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary"
            onClick={handleCheckIn}
            disabled={loading || !photoDataUrl || Boolean(todayAttendance?.checkIn)}
          >
            {loading ? t("กำลังบันทึก...", "Saving...") : t("บันทึกเข้างาน", "Clock in")}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleCheckOut}
            disabled={
              loading ||
              !todayAttendance?.checkIn ||
              Boolean(todayAttendance?.checkOut)
            }
          >
            {loading ? t("กำลังบันทึก...", "Saving...") : t("บันทึกออกงาน", "Clock out")}
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
