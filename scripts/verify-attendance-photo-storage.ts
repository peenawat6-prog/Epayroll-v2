import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import {
  deleteStoredCheckInPhoto,
  getCheckInPhotoStorageRoot,
  readStoredCheckInPhoto,
  saveCheckInPhoto,
  storedCheckInPhotoExists,
} from "@/lib/check-in-photo-storage"
import {
  getAttendancePhotoStorageBackend,
  validateServerEnv,
} from "@/lib/env"

const TEST_JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCtAAf/2Q=="

function loadEnvFile() {
  const envFilePath = path.resolve(process.cwd(), ".env")

  if (!fs.existsSync(envFilePath)) {
    return
  }

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

async function main() {
  loadEnvFile()
  validateServerEnv()

  const testIds = {
    tenantId: `verify-tenant-${randomUUID()}`,
    employeeId: `verify-employee-${randomUUID()}`,
    attendanceId: `verify-attendance-${randomUUID()}`,
  }

  const photoUrl = await saveCheckInPhoto({
    ...testIds,
    photoDataUrl: TEST_JPEG_DATA_URL,
  })

  const existsAfterSave = await storedCheckInPhotoExists(testIds)

  if (!existsAfterSave) {
    throw new Error("Photo was not found after upload")
  }

  const storedPhoto = await readStoredCheckInPhoto(testIds)

  if (storedPhoto.photoBuffer.length === 0) {
    throw new Error("Stored photo was empty after read")
  }

  await deleteStoredCheckInPhoto(testIds)

  const existsAfterDelete = await storedCheckInPhotoExists(testIds)

  if (existsAfterDelete) {
    throw new Error("Photo still exists after delete")
  }

  console.log(
    `Attendance photo storage verified: backend=${getAttendancePhotoStorageBackend()} storage=${getCheckInPhotoStorageRoot()} photoUrl=${photoUrl}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
