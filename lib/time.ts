export const BUSINESS_TIMEZONE = "Asia/Bangkok"
const BUSINESS_OFFSET = "+07:00"

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getParts(date: Date): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

export function getBusinessDateKey(date = new Date()): string {
  const parts = getParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function getBusinessYearMonth(date = new Date()) {
  const parts = getParts(date)

  return {
    year: parts.year,
    month: parts.month,
  }
}

export function getBusinessDateStart(date = new Date()): Date {
  const parts = getParts(date)
  return new Date(
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T00:00:00.000${BUSINESS_OFFSET}`,
  )
}

export function getBusinessDateTimeAtMinutes(date = new Date(), minuteOfDay = 0): Date {
  const parts = getParts(date)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60

  return new Date(
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000${BUSINESS_OFFSET}`,
  )
}

export function getBusinessMonthRange(year: number, month: number) {
  const start = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000${BUSINESS_OFFSET}`,
  )
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = new Date(
    `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00.000${BUSINESS_OFFSET}`,
  )

  return { start, end }
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
