import type {
  AttendanceCorrectionStatus,
  AttendanceStatus,
  EmployeeRegistrationStatus,
  EmployeeType,
  PayType,
  PaymentStatus,
  PayrollPeriodStatus,
  ShopRegistrationStatus,
  SubscriptionStatus,
  UserRole,
  WorkShift,
} from "@prisma/client"

export function getRoleLabel(role: UserRole, language: "th" | "en" = "th") {
  const labels: Record<UserRole, { th: string; en: string }> = {
    DEV: { th: "ทีมซัพพอร์ต", en: "Support team" },
    OWNER: { th: "เจ้าของร้าน", en: "Owner" },
    ADMIN: { th: "ผู้จัดการร้าน", en: "Manager" },
    HR: { th: "ฝ่ายบุคคล", en: "HR" },
    FINANCE: { th: "ฝ่ายการเงิน", en: "Finance" },
    EMPLOYEE: { th: "พนักงาน", en: "Employee" },
  }

  return labels[role]?.[language] ?? role
}

export function getWorkShiftLabel(
  shift: WorkShift,
  language: "th" | "en" = "th",
) {
  const labels: Record<WorkShift, { th: string; en: string }> = {
    MORNING: { th: "กะเช้า", en: "Morning shift" },
    AFTERNOON: { th: "กะบ่าย", en: "Afternoon shift" },
    NIGHT: { th: "กะดึก", en: "Night shift" },
  }

  return labels[shift]?.[language] ?? shift
}

export function getEmployeeTypeLabel(
  employeeType: EmployeeType,
  language: "th" | "en" = "th",
) {
  const labels: Record<EmployeeType, { th: string; en: string }> = {
    FULL_TIME: { th: "พนักงานประจำ", en: "Full-time" },
    PART_TIME: { th: "พนักงานพาร์ทไทม์", en: "Part-time" },
  }

  return labels[employeeType]?.[language] ?? employeeType
}

export function getPayTypeLabel(payType: PayType, language: "th" | "en" = "th") {
  const labels: Record<PayType, { th: string; en: string }> = {
    MONTHLY: { th: "รายเดือน", en: "Monthly" },
    DAILY: { th: "รายวัน", en: "Daily" },
    HOURLY: { th: "รายชั่วโมง", en: "Hourly" },
  }

  return labels[payType]?.[language] ?? payType
}

export function getAttendanceStatusLabel(
  status: AttendanceStatus | string,
  language: "th" | "en" = "th",
) {
  const labels: Record<string, { th: string; en: string }> = {
    PRESENT: { th: "มาทำงาน", en: "Present" },
    LATE: { th: "มาสาย", en: "Late" },
    ABSENT: { th: "ขาดงาน", en: "Absent" },
    LEAVE: { th: "ลางาน", en: "Leave" },
    DAY_OFF: { th: "วันหยุด", en: "Day off" },
  }

  return labels[status]?.[language] ?? status
}

export function getRequestStatusLabel(
  status:
    | AttendanceCorrectionStatus
    | EmployeeRegistrationStatus
    | ShopRegistrationStatus
    | string,
  language: "th" | "en" = "th",
) {
  const labels: Record<string, { th: string; en: string }> = {
    PENDING: { th: "รอตรวจสอบ", en: "Waiting" },
    APPROVED: { th: "อนุมัติแล้ว", en: "Approved" },
    REJECTED: { th: "ไม่อนุมัติ", en: "Rejected" },
  }

  return labels[status]?.[language] ?? status
}

export function getPayrollPeriodStatusLabel(
  status: PayrollPeriodStatus | string,
  language: "th" | "en" = "th",
) {
  const labels: Record<string, { th: string; en: string }> = {
    OPEN: { th: "ยังแก้ไขได้", en: "Editable" },
    LOCKED: { th: "ยืนยันแล้ว", en: "Confirmed" },
  }

  return labels[status]?.[language] ?? status
}

export function getSubscriptionStatusLabel(
  status: SubscriptionStatus | string,
  language: "th" | "en" = "th",
) {
  const labels: Record<string, { th: string; en: string }> = {
    TRIAL: { th: "ช่วงทดลองใช้", en: "Trial" },
    ACTIVE: { th: "ใช้งานได้", en: "Active" },
    EXPIRED: { th: "หมดอายุ", en: "Expired" },
  }

  return labels[status]?.[language] ?? status
}

export function getPaymentStatusLabel(
  status: PaymentStatus | string,
  language: "th" | "en" = "th",
) {
  const labels: Record<string, { th: string; en: string }> = {
    PENDING: { th: "รอโอน", en: "Pending" },
    PAID: { th: "โอนแล้ว", en: "Paid" },
    FAILED: { th: "โอนไม่สำเร็จ", en: "Failed" },
  }

  return labels[status]?.[language] ?? status
}

export function maskAccountValue(value: string | null | undefined) {
  const trimmed = value?.trim()

  if (!trimmed) {
    return "-"
  }

  if (trimmed.length <= 4) {
    return trimmed
  }

  return `•••${trimmed.slice(-4)}`
}
