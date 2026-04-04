import { createHash, createHmac, randomUUID } from "node:crypto"
import { constants } from "node:fs"
import { access, mkdir, readFile, rm, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  getAttendancePhotoStorageBackend,
  getAttendancePhotoStorageRoot,
  getR2AttendancePhotoConfig,
} from "@/lib/env"
import { AppError } from "@/lib/http"

const CHECK_IN_PHOTO_MIME = "image/jpeg"
const CHECK_IN_PHOTO_EXTENSION = "jpg"
const R2_REGION = "auto"
const R2_SERVICE = "s3"
const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

type SaveCheckInPhotoInput = {
  tenantId: string
  employeeId: string
  attendanceId: string
  photoDataUrl: string
}

type StoredCheckInPhotoInput = {
  tenantId: string
  employeeId: string
  attendanceId: string
}

type R2RequestInput = {
  method: "GET" | "PUT" | "HEAD" | "DELETE"
  objectKey: string
  body?: Buffer
  contentType?: string
}

function getLocalCheckInPhotoStorageRoot() {
  const configuredRoot = getAttendancePhotoStorageRoot()
  return path.isAbsolute(configuredRoot)
    ? configuredRoot
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredRoot)
}

export function getCheckInPhotoStorageRoot() {
  if (getAttendancePhotoStorageBackend() === "r2") {
    return `r2://${getR2AttendancePhotoConfig().bucket}`
  }

  return getLocalCheckInPhotoStorageRoot()
}

function getEmployeePhotoDirectory(tenantId: string, employeeId: string) {
  return path.join(getLocalCheckInPhotoStorageRoot(), tenantId, employeeId)
}

function getStoredPhotoPath(input: StoredCheckInPhotoInput) {
  return path.join(
    getEmployeePhotoDirectory(input.tenantId, input.employeeId),
    `${input.attendanceId}.${CHECK_IN_PHOTO_EXTENSION}`,
  )
}

function getStoredPhotoObjectKey(input: StoredCheckInPhotoInput) {
  return `${input.tenantId}/${input.employeeId}/${input.attendanceId}.${CHECK_IN_PHOTO_EXTENSION}`
}

function parsePhotoDataUrl(photoDataUrl: string) {
  const match = /^data:image\/(?:jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
    photoDataUrl,
  )

  if (!match) {
    throw new AppError(
      "รูปภาพต้องเป็นไฟล์ JPEG ที่ถ่ายจากกล้องในระบบ",
      400,
      "INVALID_ATTENDANCE_PHOTO",
    )
  }

  return Buffer.from(match[1].replace(/\s/g, ""), "base64")
}

export function buildCheckInPhotoUrl(attendanceId: string) {
  return `/api/attendance/photos/${attendanceId}`
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

function toDateStamp(date: Date) {
  return toAmzDate(date).slice(0, 8)
}

function hashSha256Hex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex")
}

function hmacSha256(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function getR2SigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmacSha256(dateKey, R2_REGION)
  const serviceKey = hmacSha256(regionKey, R2_SERVICE)
  return hmacSha256(serviceKey, "aws4_request")
}

function getR2RequestUrl(endpoint: string, bucket: string, objectKey: string) {
  const normalizedEndpoint = endpoint.endsWith("/") ? endpoint : `${endpoint}/`
  const encodedObjectKey = objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return new URL(`${bucket}/${encodedObjectKey}`, normalizedEndpoint)
}

async function requestR2Object(input: R2RequestInput) {
  const config = getR2AttendancePhotoConfig()
  const requestUrl = getR2RequestUrl(
    config.endpoint,
    config.bucket,
    input.objectKey,
  )
  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = toDateStamp(now)
  const payloadHash = input.body ? hashSha256Hex(input.body) : EMPTY_BODY_SHA256
  const signedHeaderMap: Record<string, string> = {
    host: requestUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }

  if (input.contentType) {
    signedHeaderMap["content-type"] = input.contentType
  }

  const signedHeaderNames = Object.keys(signedHeaderMap).sort()
  const canonicalHeaders = `${signedHeaderNames
    .map((name) => `${name}:${signedHeaderMap[name]}`)
    .join("\n")}\n`
  const signedHeaders = signedHeaderNames.join(";")
  const canonicalRequest = [
    input.method,
    requestUrl.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256Hex(canonicalRequest),
  ].join("\n")
  const signature = createHmac(
    "sha256",
    getR2SigningKey(config.secretAccessKey, dateStamp),
  )
    .update(stringToSign)
    .digest("hex")

  const headers: Record<string, string> = {
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }

  if (input.contentType) {
    headers["Content-Type"] = input.contentType
  }

  return fetch(requestUrl, {
    method: input.method,
    headers,
    body: input.body ? new Uint8Array(input.body) : undefined,
  })
}

export async function saveCheckInPhoto(input: SaveCheckInPhotoInput) {
  const photoBuffer = parsePhotoDataUrl(input.photoDataUrl)

  if (photoBuffer.length === 0) {
    throw new AppError("รูปภาพไม่ถูกต้อง", 400, "INVALID_ATTENDANCE_PHOTO")
  }

  if (photoBuffer.length > 2_000_000) {
    throw new AppError(
      "รูปภาพมีขนาดใหญ่เกินไป กรุณาถ่ายใหม่อีกครั้ง",
      400,
      "ATTENDANCE_PHOTO_TOO_LARGE",
    )
  }

  if (getAttendancePhotoStorageBackend() === "r2") {
    const response = await requestR2Object({
      method: "PUT",
      objectKey: getStoredPhotoObjectKey(input),
      body: photoBuffer,
      contentType: CHECK_IN_PHOTO_MIME,
    })

    if (!response.ok) {
      throw new AppError(
        "อัปโหลดรูปเช็กอินไป R2 ไม่สำเร็จ",
        502,
        "ATTENDANCE_PHOTO_UPLOAD_FAILED",
      )
    }

    return buildCheckInPhotoUrl(input.attendanceId)
  }

  const directory = getEmployeePhotoDirectory(input.tenantId, input.employeeId)
  const photoPath = getStoredPhotoPath(input)
  const tempPath = `${photoPath}.${randomUUID()}.tmp`

  await mkdir(directory, { recursive: true })
  await writeFile(tempPath, photoBuffer)
  await rename(tempPath, photoPath)

  return buildCheckInPhotoUrl(input.attendanceId)
}

export async function readStoredCheckInPhoto(input: StoredCheckInPhotoInput) {
  try {
    if (getAttendancePhotoStorageBackend() === "r2") {
      const response = await requestR2Object({
        method: "GET",
        objectKey: getStoredPhotoObjectKey(input),
      })

      if (!response.ok) {
        throw new Error("R2 object not found")
      }

      return {
        mimeType: CHECK_IN_PHOTO_MIME,
        photoBuffer: Buffer.from(await response.arrayBuffer()),
      }
    }

    const photoPath = getStoredPhotoPath(input)
    const photoBuffer = await readFile(photoPath)

    return {
      mimeType: CHECK_IN_PHOTO_MIME,
      photoBuffer,
    }
  } catch {
    throw new AppError("ไม่พบรูปเช็กอิน", 404, "ATTENDANCE_PHOTO_NOT_FOUND")
  }
}

export async function deleteStoredCheckInPhoto(input: StoredCheckInPhotoInput) {
  if (getAttendancePhotoStorageBackend() === "r2") {
    await requestR2Object({
      method: "DELETE",
      objectKey: getStoredPhotoObjectKey(input),
    })
    return
  }

  const photoPath = getStoredPhotoPath(input)
  await rm(photoPath, { force: true })
}

export async function storedCheckInPhotoExists(input: StoredCheckInPhotoInput) {
  try {
    if (getAttendancePhotoStorageBackend() === "r2") {
      const response = await requestR2Object({
        method: "HEAD",
        objectKey: getStoredPhotoObjectKey(input),
      })

      return response.ok
    }

    const photoPath = getStoredPhotoPath(input)
    await access(photoPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}
