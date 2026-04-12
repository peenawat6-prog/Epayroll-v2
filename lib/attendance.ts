import type { AttendanceStatus, WorkShift } from "@prisma/client"
import { AppError } from "@/lib/http"
import {
  getBusinessDateStart,
  getBusinessDateTimeAtMinutes,
  minutesBetween,
} from "@/lib/time"

export const DEFAULT_WORK_START_MINUTES = 9 * 60
export const DEFAULT_WORK_END_MINUTES = 18 * 60
export const DEFAULT_AFTERNOON_START_MINUTES = 13 * 60
export const DEFAULT_AFTERNOON_END_MINUTES = 22 * 60
export const DEFAULT_NIGHT_START_MINUTES = 22 * 60
export const DEFAULT_NIGHT_END_MINUTES = 6 * 60
export const STANDARD_WORK_MINUTES = 8 * 60

export const WORK_SHIFT_LABELS: Record<WorkShift, string> = {
  MORNING: "กะเช้า",
  AFTERNOON: "กะบ่าย",
  NIGHT: "กะดึก",
}

export type ShiftScheduleSettings = {
  workStartMinutes?: number
  workEndMinutes?: number
  morningShiftStartMinutes?: number
  morningShiftEndMinutes?: number
  afternoonShiftStartMinutes?: number
  afternoonShiftEndMinutes?: number
  nightShiftStartMinutes?: number
  nightShiftEndMinutes?: number
}

export function getShiftSchedule(
  settings: ShiftScheduleSettings | null | undefined,
  workShift: WorkShift,
) {
  if (workShift === "AFTERNOON") {
    return {
      startMinutes:
        settings?.afternoonShiftStartMinutes ?? DEFAULT_AFTERNOON_START_MINUTES,
      endMinutes:
        settings?.afternoonShiftEndMinutes ?? DEFAULT_AFTERNOON_END_MINUTES,
    }
  }

  if (workShift === "NIGHT") {
    return {
      startMinutes:
        settings?.nightShiftStartMinutes ?? DEFAULT_NIGHT_START_MINUTES,
      endMinutes: settings?.nightShiftEndMinutes ?? DEFAULT_NIGHT_END_MINUTES,
    }
  }

  return {
    startMinutes:
      settings?.morningShiftStartMinutes ??
      settings?.workStartMinutes ??
      DEFAULT_WORK_START_MINUTES,
    endMinutes:
      settings?.morningShiftEndMinutes ??
      settings?.workEndMinutes ??
      DEFAULT_WORK_END_MINUTES,
  }
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function getShiftWorkDate(
  date = new Date(),
  settings: ShiftScheduleSettings | null | undefined = null,
  workShift: WorkShift = "MORNING",
) {
  const schedule = getShiftSchedule(settings, workShift)
  const businessDateStart = getBusinessDateStart(date)
  const minutesFromBusinessMidnight = minutesBetween(businessDateStart, date)
  const crossesMidnight = schedule.endMinutes <= schedule.startMinutes

  if (crossesMidnight && minutesFromBusinessMidnight < schedule.endMinutes) {
    return addDays(businessDateStart, -1)
  }

  return businessDateStart
}

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

export function getShiftStartByWorkShift(
  date = new Date(),
  settings: ShiftScheduleSettings | null | undefined = null,
  workShift: WorkShift = "MORNING",
) {
  const schedule = getShiftSchedule(settings, workShift)
  const workDate = getShiftWorkDate(date, settings, workShift)
  return getShiftStartForWorkDate(workDate, settings, workShift)
}

export function getShiftEndByWorkShift(
  date = new Date(),
  settings: ShiftScheduleSettings | null | undefined = null,
  workShift: WorkShift = "MORNING",
) {
  const workDate = getShiftWorkDate(date, settings, workShift)
  return getShiftEndForWorkDate(workDate, settings, workShift)
}

export function getShiftStartForWorkDate(
  workDate: Date,
  settings: ShiftScheduleSettings | null | undefined = null,
  workShift: WorkShift = "MORNING",
) {
  const schedule = getShiftSchedule(settings, workShift)
  return getBusinessDateTimeAtMinutes(workDate, schedule.startMinutes)
}

export function getShiftEndForWorkDate(
  workDate: Date,
  settings: ShiftScheduleSettings | null | undefined = null,
  workShift: WorkShift = "MORNING",
) {
  const schedule = getShiftSchedule(settings, workShift)
  const endDate = schedule.endMinutes <= schedule.startMinutes
    ? addDays(workDate, 1)
    : workDate

  return getBusinessDateTimeAtMinutes(endDate, schedule.endMinutes)
}

export function getWorkDate(date = new Date()) {
  return getBusinessDateStart(date)
}

export function ensureCheckoutAfterCheckin(checkIn: Date, checkOut: Date) {
  const diffMilliseconds = checkOut.getTime() - checkIn.getTime()

  if (diffMilliseconds <= 0) {
    throw new AppError(
      "Check-out time must be after check-in time",
      400,
      "INVALID_ATTENDANCE_TIME",
    )
  }

  const workedMinutes = Math.max(1, minutesBetween(checkIn, checkOut))

  return workedMinutes
}

export function getPaidCheckoutAt(params: {
  checkIn: Date
  requestedCheckOut: Date
  shiftEnd: Date
}) {
  const shiftEndsAfterCheckIn =
    params.shiftEnd.getTime() > params.checkIn.getTime()

  if (
    shiftEndsAfterCheckIn &&
    params.requestedCheckOut.getTime() > params.shiftEnd.getTime()
  ) {
    return params.shiftEnd
  }

  return params.requestedCheckOut
}

export function getAutoCheckoutDeadline(params: {
  checkIn: Date
  shiftEnd: Date
  approvedOvertimeMinutes?: number
}) {
  const standardDeadline = new Date(
    params.checkIn.getTime() + STANDARD_WORK_MINUTES * 60000,
  )
  const baseDeadline =
    params.shiftEnd.getTime() > standardDeadline.getTime()
      ? params.shiftEnd
      : standardDeadline

  return new Date(
    baseDeadline.getTime() + (params.approvedOvertimeMinutes ?? 0) * 60000,
  )
}

export function getRegularWorkedMinutes(params: {
  checkIn: Date
  requestedCheckOut: Date
  shiftEnd: Date
}) {
  const paidCheckoutAt = getPaidCheckoutAt(params)

  return {
    paidCheckoutAt,
    workedMinutes: ensureCheckoutAfterCheckin(params.checkIn, paidCheckoutAt),
  }
}

export function calculateAttendanceMetrics(input: {
  checkIn: Date | null
  checkOut: Date | null
  status?: AttendanceStatus | null
  workShift?: WorkShift | null
  shiftSettings?: ShiftScheduleSettings | null
}) {
  const checkIn = input.checkIn
  const checkOut = input.checkOut

  let workedMinutes = 0
  let lateMinutes = 0

  if (checkIn) {
    lateMinutes = Math.max(
      0,
      minutesBetween(
        getShiftStartByWorkShift(
          checkIn,
          input.shiftSettings,
          input.workShift ?? "MORNING",
        ),
        checkIn,
      ),
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
