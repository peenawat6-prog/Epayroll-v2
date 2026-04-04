import type { AttendanceStatus } from "@prisma/client"
import { AppError } from "@/lib/http"
import {
  getBusinessDateStart,
  getBusinessDateTimeAtMinutes,
  minutesBetween,
} from "@/lib/time"

export const DEFAULT_WORK_START_MINUTES = 9 * 60
export const DEFAULT_WORK_END_MINUTES = 18 * 60

export function getShiftStart(
  date = new Date(),
  workStartMinutes = DEFAULT_WORK_START_MINUTES,
) {
  return getBusinessDateTimeAtMinutes(date, workStartMinutes)
}

export function getShiftEnd(
  date = new Date(),
  workEndMinutes = DEFAULT_WORK_END_MINUTES,
) {
  return getBusinessDateTimeAtMinutes(date, workEndMinutes)
}

export function getWorkDate(date = new Date()) {
  return getBusinessDateStart(date)
}

export function ensureCheckoutAfterCheckin(checkIn: Date, checkOut: Date) {
  const workedMinutes = minutesBetween(checkIn, checkOut)

  if (workedMinutes <= 0) {
    throw new AppError(
      "Check-out time must be after check-in time",
      400,
      "INVALID_ATTENDANCE_TIME",
    )
  }

  return workedMinutes
}

export function calculateAttendanceMetrics(input: {
  checkIn: Date | null
  checkOut: Date | null
  status?: AttendanceStatus | null
}) {
  const checkIn = input.checkIn
  const checkOut = input.checkOut

  let workedMinutes = 0
  let lateMinutes = 0

  if (checkIn) {
    lateMinutes = Math.max(
      0,
      minutesBetween(getShiftStart(checkIn), checkIn),
    )
  }

  if (checkIn && checkOut) {
    workedMinutes = ensureCheckoutAfterCheckin(checkIn, checkOut)
  }

  const derivedStatus =
    input.status ??
    (checkIn ? (lateMinutes > 0 ? "LATE" : "PRESENT") : "ABSENT")

  return {
    workedMinutes,
    lateMinutes,
    status: derivedStatus,
  }
}
