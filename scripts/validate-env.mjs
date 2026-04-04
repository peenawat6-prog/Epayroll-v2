import fs from "node:fs"
import path from "node:path"

const envFilePath = path.resolve(process.cwd(), ".env")
const requiredKeys = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]

if (fs.existsSync(envFilePath)) {
  const envFile = fs.readFileSync(envFilePath, "utf8")

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const missing = requiredKeys.filter((key) => !process.env[key])
const photoBackend =
  process.env.ATTENDANCE_PHOTO_STORAGE_BACKEND?.trim() === "r2"
    ? "r2"
    : "local"

if (photoBackend === "r2") {
  missing.push(
    ...[
      "R2_ATTENDANCE_PHOTO_ENDPOINT",
      "R2_ATTENDANCE_PHOTO_BUCKET",
      "R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID",
      "R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY",
    ].filter((key) => !process.env[key]),
  )
}

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`)
  process.exit(1)
}

console.log("Environment validation passed")

if (photoBackend === "r2") {
  console.log(
    `Attendance photo storage: R2 bucket ${process.env.R2_ATTENDANCE_PHOTO_BUCKET}`,
  )
} else if (process.env.ATTENDANCE_PHOTO_STORAGE_DIR) {
  console.log(
    `Attendance photo storage: ${process.env.ATTENDANCE_PHOTO_STORAGE_DIR}`,
  )
}
