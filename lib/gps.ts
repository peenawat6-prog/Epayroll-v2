import { AppError } from "@/lib/http"

const EARTH_RADIUS_METERS = 6371000

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

export function getDistanceMeters(params: {
  latitude: number
  longitude: number
  targetLatitude: number
  targetLongitude: number
}) {
  const latitudeDistance = toRadians(params.targetLatitude - params.latitude)
  const longitudeDistance = toRadians(params.targetLongitude - params.longitude)
  const startLatitude = toRadians(params.latitude)
  const endLatitude = toRadians(params.targetLatitude)

  const haversine =
    Math.sin(latitudeDistance / 2) * Math.sin(latitudeDistance / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDistance / 2) *
      Math.sin(longitudeDistance / 2)

  const distance =
    2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))

  return Math.round(distance)
}

export function getEffectiveLocationConfig(params: {
  tenant: {
    latitude: number | null
    longitude: number | null
    allowedRadiusMeters: number
  }
  branch?: {
    latitude: number | null
    longitude: number | null
    allowedRadiusMeters: number | null
    name: string
  } | null
}) {
  const branch = params.branch

  if (branch && branch.latitude !== null && branch.longitude !== null) {
    return {
      label: branch.name,
      latitude: branch.latitude,
      longitude: branch.longitude,
      allowedRadiusMeters:
        branch.allowedRadiusMeters ?? params.tenant.allowedRadiusMeters,
    }
  }

  if (params.tenant.latitude !== null && params.tenant.longitude !== null) {
    return {
      label: "ร้านหลัก",
      latitude: params.tenant.latitude,
      longitude: params.tenant.longitude,
      allowedRadiusMeters: params.tenant.allowedRadiusMeters,
    }
  }

  throw new AppError(
    "ยังไม่ได้ตั้งค่าพิกัดร้าน กรุณาตั้งค่าที่หน้า Ops ก่อน",
    409,
    "SHOP_LOCATION_NOT_CONFIGURED",
  )
}

export function assertWithinAllowedRadius(params: {
  latitude: number
  longitude: number
  targetLatitude: number
  targetLongitude: number
  allowedRadiusMeters: number
}) {
  const distanceMeters = getDistanceMeters(params)

  if (distanceMeters > params.allowedRadiusMeters) {
    throw new AppError(
      `อยู่นอกรัศมีร้าน ${distanceMeters} เมตร เกินกว่าที่กำหนดไว้ ${params.allowedRadiusMeters} เมตร`,
      409,
      "OUTSIDE_ALLOWED_RADIUS",
      {
        distanceMeters,
        allowedRadiusMeters: params.allowedRadiusMeters,
      },
    )
  }

  return distanceMeters
}
