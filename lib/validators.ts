import type {
  AttendanceStatus,
  EmployeeType,
  PaymentStatus,
  PayType,
  UserRole,
  WorkShift,
} from "@prisma/client"
import { AppError } from "@/lib/http"

const EMPLOYEE_TYPES: EmployeeType[] = ["FULL_TIME", "PART_TIME"]
const PAY_TYPES: PayType[] = ["MONTHLY", "DAILY", "HOURLY"]
const WORK_SHIFTS: WorkShift[] = ["MORNING", "AFTERNOON", "NIGHT"]
const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED"]
const STAFF_MANAGEMENT_ROLES: UserRole[] = [
  "EMPLOYEE",
  "ADMIN",
  "HR",
  "FINANCE",
]
const MANAGEMENT_REGISTRATION_ROLES: UserRole[] = [
  "OWNER",
  "ADMIN",
  "HR",
  "FINANCE",
]
const WEEKDAY_CODES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const
const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "LEAVE",
  "DAY_OFF",
]

export function asTrimmedString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new AppError(`${fieldName} is required`, 400, "INVALID_INPUT")
  }

  return trimmed
}

export function asOptionalTrimmedString(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError("Invalid text field", 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function asOptionalSearchString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new AppError("Invalid search field", 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

export function asEmail(value: unknown, fieldName = "email") {
  const email = asTrimmedString(value, fieldName).toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return email
}

export function asPassword(value: unknown) {
  const password = asTrimmedString(value, "password")

  if (password.length < 6) {
    throw new AppError(
      "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
      400,
      "INVALID_INPUT",
    )
  }

  return password
}

export function asOptionalNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError("Invalid numeric field", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalInteger(value: unknown) {
  const parsed = asOptionalNumber(value)

  if (parsed === null) {
    return null
  }

  if (!Number.isInteger(parsed)) {
    throw new AppError("Invalid integer field", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asBusinessDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    throw new AppError(`${fieldName} is required`, 400, "INVALID_INPUT")
  }

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalBusinessDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Invalid date", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asEmployeeType(value: unknown): EmployeeType {
  const normalized = String(value ?? "FULL_TIME") as EmployeeType

  if (!EMPLOYEE_TYPES.includes(normalized)) {
    throw new AppError("Invalid employeeType", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asPayType(value: unknown): PayType {
  const normalized = String(value ?? "MONTHLY") as PayType

  if (!PAY_TYPES.includes(normalized)) {
    throw new AppError("Invalid payType", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asWorkShift(value: unknown): WorkShift {
  const normalized = String(value ?? "MORNING") as WorkShift

  if (!WORK_SHIFTS.includes(normalized)) {
    throw new AppError("Invalid workShift", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asMonth(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new AppError("Invalid month", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asYear(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback)

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 3000) {
    throw new AppError("Invalid year", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asAction(value: unknown, allowed: readonly string[]) {
  const normalized = String(value ?? "").trim()

  if (!allowed.includes(normalized)) {
    throw new AppError("Invalid action", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asAttendanceStatus(value: unknown) {
  const normalized = String(value ?? "") as AttendanceStatus

  if (!ATTENDANCE_STATUSES.includes(normalized)) {
    throw new AppError("Invalid attendance status", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asLatitude(value: unknown, fieldName = "latitude") {
  const parsed = asOptionalNumber(value)

  if (parsed === null || parsed < -90 || parsed > 90) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asLongitude(value: unknown, fieldName = "longitude") {
  const parsed = asOptionalNumber(value)

  if (parsed === null || parsed < -180 || parsed > 180) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalLatitude(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return asLatitude(value)
}

export function asOptionalLongitude(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return asLongitude(value)
}

export function asPayrollPayday(value: unknown) {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 1 || parsed > 31) {
    throw new AppError("Invalid payroll payday", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asMeterRadius(value: unknown) {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 10 || parsed > 5000) {
    throw new AppError("Invalid allowed radius", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asLatePenaltyPerMinute(value: unknown) {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 0 || parsed > 1000) {
    throw new AppError("Invalid late penalty per minute", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asPhotoReference(value: unknown) {
  const photo = asTrimmedString(value, "photo")

  if (!/^data:image\/(?:jpeg|jpg);base64,[A-Za-z0-9+/=\r\n]+$/.test(photo)) {
    throw new AppError(
      "กรุณาถ่ายรูปจากกล้องในระบบก่อนบันทึกเข้างาน",
      400,
      "INVALID_ATTENDANCE_PHOTO",
    )
  }

  if (photo.length > 6_000_000) {
    throw new AppError("รูปภาพมีขนาดใหญ่เกินไป", 400, "INVALID_INPUT")
  }

  return photo
}

export function asClockMinutes(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} is required`, 400, "INVALID_INPUT")
  }

  const normalized = value.trim()
  const match = /^(\d{2}):(\d{2})$/.exec(normalized)

  if (!match) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return hour * 60 + minute
}

export function asPaymentStatus(value: unknown): PaymentStatus {
  const normalized = String(value ?? "").trim() as PaymentStatus

  if (!PAYMENT_STATUSES.includes(normalized)) {
    throw new AppError("Invalid payment status", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asPositiveDays(value: unknown, fieldName = "days") {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 1 || parsed > 3650) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asStaffManagementRole(value: unknown): UserRole {
  const normalized = String(value ?? "").trim() as UserRole

  if (!STAFF_MANAGEMENT_ROLES.includes(normalized)) {
    throw new AppError("Invalid user role", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asManagementRegistrationRole(value: unknown): UserRole {
  const normalized = String(value ?? "").trim() as UserRole

  if (!MANAGEMENT_REGISTRATION_ROLES.includes(normalized)) {
    throw new AppError("Invalid management role", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asDayOffWeekdays(value: unknown) {
  if (value === undefined || value === null) {
    return [] as string[]
  }

  if (!Array.isArray(value)) {
    throw new AppError("dayOffWeekdays must be an array", 400, "INVALID_INPUT")
  }

  const normalizedValues = value
    .map((item) => String(item ?? "").trim().toUpperCase())
    .filter((item) => item.length > 0)

  const uniqueValues = Array.from(new Set(normalizedValues))

  for (const weekday of uniqueValues) {
    if (!WEEKDAY_CODES.includes(weekday as (typeof WEEKDAY_CODES)[number])) {
      throw new AppError("Invalid day off weekday", 400, "INVALID_INPUT")
    }
  }

  return uniqueValues
}
