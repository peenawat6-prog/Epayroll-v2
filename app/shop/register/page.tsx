"use client"

import { useEffect, useRef, useState } from "react"
import PasswordInput from "@/app/components/password-input"
import { useLanguage } from "@/lib/language"

type LeafletInstance = {
  setView: (center: [number, number], zoom: number) => void
  on: (
    eventName: string,
    handler: (event: { latlng: { lat: number; lng: number } }) => void,
  ) => void
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

type ShopRegisterForm = {
  shopName: string
  branchName: string
  ownerFirstName: string
  ownerLastName: string
  ownerPhone: string
  ownerEmail: string
  ownerPassword: string
  payrollPayday: string
  morningShiftStartTime: string
  morningShiftEndTime: string
  afternoonShiftStartTime: string
  afternoonShiftEndTime: string
  nightShiftStartTime: string
  nightShiftEndTime: string
  latitude: string
  longitude: string
  allowedRadiusMeters: string
  salesAgentId: string
}

type SalesAgentOption = {
  id: string
  code: string
  firstName: string
  lastName: string
}

declare global {
  interface Window {
    L?: LeafletStatic
  }
}

const DEFAULT_LATITUDE = 13.7563
const DEFAULT_LONGITUDE = 100.5018
const SHOP_REGISTER_DRAFT_KEY = "epayroll-shop-register-draft"
const LEAFLET_SCRIPT_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
const LEAFLET_STYLE_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"

let leafletLoader: Promise<LeafletStatic> | null = null

function createDefaultForm(): ShopRegisterForm {
  return {
    shopName: "",
    branchName: "สาขาหลัก",
    ownerFirstName: "",
    ownerLastName: "",
    ownerPhone: "",
    ownerEmail: "",
    ownerPassword: "",
    payrollPayday: "31",
    morningShiftStartTime: "09:00",
    morningShiftEndTime: "18:00",
    afternoonShiftStartTime: "13:00",
    afternoonShiftEndTime: "22:00",
    nightShiftStartTime: "22:00",
    nightShiftEndTime: "06:00",
    latitude: String(DEFAULT_LATITUDE),
    longitude: String(DEFAULT_LONGITUDE),
    allowedRadiusMeters: "150",
    salesAgentId: "",
  }
}

function loadLeaflet() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("เปิดแผนที่ไม่ได้ในฝั่ง server"))
  }

  if (window.L) {
    return Promise.resolve(window.L)
  }

  if (leafletLoader) {
    return leafletLoader
  }

  leafletLoader = new Promise<LeafletStatic>((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_STYLE_URL}"]`)) {
      const styleLink = document.createElement("link")
      styleLink.rel = "stylesheet"
      styleLink.href = LEAFLET_STYLE_URL
      document.head.appendChild(styleLink)
    }

    const existingScript = document.querySelector(
      `script[src="${LEAFLET_SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.L) {
          resolve(window.L)
        } else {
          reject(new Error("โหลดแผนที่ไม่สำเร็จ"))
        }
      })
      existingScript.addEventListener("error", () =>
        reject(new Error("โหลดแผนที่ไม่สำเร็จ")),
      )
      return
    }

    const script = document.createElement("script")
    script.src = LEAFLET_SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.L) {
        resolve(window.L)
      } else {
        reject(new Error("โหลดแผนที่ไม่สำเร็จ"))
      }
    }
    script.onerror = () => reject(new Error("โหลดแผนที่ไม่สำเร็จ"))
    document.body.appendChild(script)
  })

  return leafletLoader
}

function restoreDraft() {
  const draftText = window.localStorage.getItem(SHOP_REGISTER_DRAFT_KEY)

  if (!draftText) {
    return createDefaultForm()
  }

  try {
    return {
      ...createDefaultForm(),
      ...JSON.parse(draftText),
    } as ShopRegisterForm
  } catch {
    return createDefaultForm()
  }
}

function getLoginUrl() {
  if (typeof window === "undefined") {
    return "/login"
  }

  const { protocol, hostname, port } = window.location

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "/login"
  }

  if (hostname.startsWith("register.")) {
    const mainHostname = hostname.replace(/^register\./i, "")
    return `${protocol}//${mainHostname}${port ? `:${port}` : ""}/login`
  }

  return "/login"
}

export default function ShopRegisterPage() {
  const { t } = useLanguage()
  const [form, setForm] = useState<ShopRegisterForm>(createDefaultForm)
  const [statusText, setStatusText] = useState("")
  const [errorText, setErrorText] = useState("")
  const [salesAgents, setSalesAgents] = useState<SalesAgentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [mapStatus, setMapStatus] = useState("")
  const [draftReady, setDraftReady] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<LeafletInstance | null>(null)
  const markerRef = useRef<LeafletMarkerInstance | null>(null)

  const goToLogin = () => {
    window.location.href = getLoginUrl()
  }

  useEffect(() => {
    setForm(restoreDraft())
    setDraftReady(true)
  }, [])

  useEffect(() => {
    fetch("/api/public/sales-agents")
      .then((res) => res.json())
      .then((data) => {
        setSalesAgents(data.salesAgents ?? [])
      })
      .catch(() => {
        setSalesAgents([])
      })
  }, [])

  useEffect(() => {
    if (!draftReady) return
    window.localStorage.setItem(SHOP_REGISTER_DRAFT_KEY, JSON.stringify(form))
  }, [draftReady, form])

  useEffect(() => {
    if (!draftReady || !mapContainerRef.current || mapInstanceRef.current) return

    let disposed = false

    loadLeaflet()
      .then((leaflet) => {
        if (disposed || !mapContainerRef.current) return

        const latitude = Number(form.latitude) || DEFAULT_LATITUDE
        const longitude = Number(form.longitude) || DEFAULT_LONGITUDE
        const map = leaflet.map(mapContainerRef.current)
        map.setView([latitude, longitude], 17)

        leaflet
          .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap",
          })
          .addTo(map)

        markerRef.current = leaflet.marker([latitude, longitude]).addTo(map)
        map.on("click", (event) => {
          const nextLatitude = Number(event.latlng.lat.toFixed(6))
          const nextLongitude = Number(event.latlng.lng.toFixed(6))
          markerRef.current?.setLatLng([nextLatitude, nextLongitude])
          setForm((current) => ({
            ...current,
            latitude: String(nextLatitude),
            longitude: String(nextLongitude),
          }))
          setMapStatus(
            `${t("เลือกพิกัดร้านแล้ว", "Shop location selected")}: ${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}`,
          )
        })

        mapInstanceRef.current = map
        setMapStatus(
          t(
            "จิ้มบนแผนที่เพื่อเลือกพิกัดร้าน ระบบจะจำค่าไว้ให้อัตโนมัติ",
            "Tap the map to select your shop location. Coordinates are saved automatically.",
          ),
        )
      })
      .catch((error) => {
        setMapStatus(
          error instanceof Error
            ? error.message
            : t("โหลดแผนที่ไม่สำเร็จ", "Failed to load map"),
        )
      })

    return () => {
      disposed = true
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [draftReady, form.latitude, form.longitude, t])

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return

    const latitude = Number(form.latitude)
    const longitude = Number(form.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

    markerRef.current.setLatLng([latitude, longitude])
    mapInstanceRef.current.setView([latitude, longitude], 17)
  }, [form.latitude, form.longitude])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setStatusText("")
    setErrorText("")

    try {
      const res = await fetch("/api/shop/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(
          data.error || t("ลงทะเบียนร้านค้าไม่สำเร็จ", "Shop registration failed"),
        )
      }

      window.localStorage.removeItem(SHOP_REGISTER_DRAFT_KEY)
      setStatusText(
        data.message ||
          t(
            "ส่งคำขอเปิดร้านเรียบร้อยแล้ว กรุณารอทีมซัพพอร์ตตรวจสอบและอนุมัติ",
            "Shop request submitted. Please wait for support approval.",
          ),
      )
      setForm(createDefaultForm())
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : t("ลงทะเบียนร้านค้าไม่สำเร็จ", "Shop registration failed"),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">{t("ลงทะเบียนร้านใหม่", "New shop registration")}</div>
            <div className="badge">{t("ข้อมูลที่กรอกจะถูกจำไว้ในเครื่องนี้อัตโนมัติ", "Form data is autosaved on this device")}</div>
          </div>
          <h1 className="hero-title">{t("สมัครใช้งาน Epayroll สำหรับร้านใหม่", "Register a new shop for Epayroll")}</h1>
          <p className="hero-subtitle">
            {t(
              "กรอกข้อมูลร้าน เจ้าของร้าน เวลากะงาน และจิ้มพิกัดร้านบนแผนที่ จากนั้นรอทีมซัพพอร์ตตรวจสอบและอนุมัติ",
              "Fill in shop, owner, shift, and location details. After submission, support will review and approve the shop.",
            )}
          </p>
        </div>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goToLogin}
          >
            {t("กลับหน้าเข้าสู่ระบบ", "Back to login")}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">{t("ข้อมูลร้านและเจ้าของร้าน", "Shop and owner details")}</h2>
        <p className="panel-subtitle">
          {t(
            "เลือกเวลาจากตัวเลือกเวลาแบบ 24 ชั่วโมง และจิ้มพิกัดบนแผนที่เพื่อเก็บตำแหน่งร้าน",
            "Use 24-hour time pickers and tap the map to save your shop location.",
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>{t("ชื่อร้าน", "Shop name")}</label>
              <input
                value={form.shopName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, shopName: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("ชื่อสาขาหลัก", "Main branch name")}</label>
              <input
                value={form.branchName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, branchName: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("ชื่อเจ้าของร้าน", "Owner first name")}</label>
              <input
                value={form.ownerFirstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerFirstName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>{t("นามสกุลเจ้าของร้าน", "Owner last name")}</label>
              <input
                value={form.ownerLastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerLastName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>{t("เบอร์โทรเจ้าของร้าน", "Owner phone")}</label>
              <input
                value={form.ownerPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ownerPhone: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("อีเมลเจ้าของร้าน", "Owner login email")}</label>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ownerEmail: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("ตั้งรหัสผ่านเจ้าของร้าน", "Owner password")}</label>
              <PasswordInput
                value={form.ownerPassword}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    ownerPassword: value,
                  }))
                }
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>{t("วันจ่ายเงินเดือน", "Payroll payday")}</label>
              <input
                type="number"
                min="1"
                max="31"
                value={form.payrollPayday}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payrollPayday: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>{t("กะเช้า - เวลาเข้างาน", "Morning shift - start time")}</label>
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
              <label>{t("กะเช้า - เวลาเลิกงาน", "Morning shift - end time")}</label>
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
              <label>{t("กะบ่าย - เวลาเข้างาน", "Afternoon shift - start time")}</label>
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
              <label>{t("กะบ่าย - เวลาเลิกงาน", "Afternoon shift - end time")}</label>
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
              <label>{t("กะดึก - เวลาเข้างาน", "Night shift - start time")}</label>
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
              <label>{t("กะดึก - เวลาเลิกงาน", "Night shift - end time")}</label>
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
              <label>{t("ละติจูดร้าน", "Shop latitude")}</label>
              <input
                inputMode="decimal"
                value={form.latitude}
                onChange={(event) =>
                  setForm((current) => ({ ...current, latitude: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>{t("ลองจิจูดร้าน", "Shop longitude")}</label>
              <input
                inputMode="decimal"
                value={form.longitude}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    longitude: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field">
              <label>{t("รัศมีที่อนุญาตให้ลงเวลา (เมตร)", "Allowed check-in radius (m)")}</label>
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
            <div className="field">
              <label>{t("เซลล์ผู้แนะนำ", "Sales representative")}</label>
              <select
                value={form.salesAgentId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    salesAgentId: event.target.value,
                  }))
                }
              >
                <option value="">{t("ไม่ได้เลือกเซลล์", "No sales representative")}</option>
                {salesAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.firstName} {agent.lastName} ({agent.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label>{t("จิ้มพิกัดร้านจากแผนที่", "Pick shop location on map")}</label>
            <div ref={mapContainerRef} className="map-picker" />
            <div className="table-meta">
              {mapStatus ||
                t(
                  "กำลังโหลดแผนที่...",
                  "Loading map...",
                )}
            </div>
          </div>

          {statusText ? (
            <div className="message message-success">{statusText}</div>
          ) : null}
          {errorText ? <div className="message message-error">{errorText}</div> : null}

          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? t("กำลังบันทึก...", "Saving...")
                : t("ส่งคำขอเปิดร้าน", "Submit shop request")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={goToLogin}
            >
              {t("กลับหน้าเข้าสู่ระบบ", "Back to login")}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
