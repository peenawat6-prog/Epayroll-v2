const DATE_TIME_FORMAT_24H = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const TIME_FORMAT_24H = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatThaiDate(value: string | Date | null) {
  if (!value) return "-"
  return new Date(value).toLocaleDateString("th-TH")
}

export function formatThaiTime24h(value: string | Date | null) {
  if (!value) return "-"
  return TIME_FORMAT_24H.format(new Date(value))
}

export function formatThaiDateTime24h(value: string | Date | null) {
  if (!value) return "-"
  return DATE_TIME_FORMAT_24H.format(new Date(value))
}
