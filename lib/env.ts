type RequiredEnvKey =
  | "DATABASE_URL"
  | "NEXTAUTH_SECRET"
  | "NEXTAUTH_URL"

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
]

let validated = false

export function getAttendancePhotoStorageBackend() {
  return process.env.ATTENDANCE_PHOTO_STORAGE_BACKEND?.trim() === "r2"
    ? "r2"
    : "local"
}

export function getAttendancePhotoStorageRoot() {
  return (
    process.env.ATTENDANCE_PHOTO_STORAGE_DIR?.trim() ||
    "storage/check-in-photos"
  )
}

export function getR2AttendancePhotoConfig() {
  return {
    endpoint: process.env.R2_ATTENDANCE_PHOTO_ENDPOINT?.trim() || "",
    bucket: process.env.R2_ATTENDANCE_PHOTO_BUCKET?.trim() || "",
    accessKeyId: process.env.R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey:
      process.env.R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY?.trim() || "",
  }
}

export function getCronSecret() {
  return process.env.CRON_SECRET?.trim() || ""
}

export function getRequiredEnv(key: RequiredEnvKey) {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function validateServerEnv() {
  if (validated) {
    return
  }

  for (const key of REQUIRED_ENV_KEYS) {
    getRequiredEnv(key)
  }

  if (getAttendancePhotoStorageBackend() === "r2") {
    const r2Config = getR2AttendancePhotoConfig()
    const missingR2Keys = [
      ["R2_ATTENDANCE_PHOTO_ENDPOINT", r2Config.endpoint],
      ["R2_ATTENDANCE_PHOTO_BUCKET", r2Config.bucket],
      ["R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID", r2Config.accessKeyId],
      [
        "R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY",
        r2Config.secretAccessKey,
      ],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key)

    if (missingR2Keys.length > 0) {
      throw new Error(
        `Missing required R2 environment variables: ${missingR2Keys.join(", ")}`,
      )
    }
  }

  validated = true
}
