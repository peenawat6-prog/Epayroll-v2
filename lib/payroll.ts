import type { PaymentStatus, PayrollPeriodStatus, PayType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { getBusinessYearMonth, roundCurrency } from "@/lib/time"

const STANDARD_WORK_MINUTES = 8 * 60
const BUSINESS_OFFSET = "+07:00"

export type PayrollItem = {
  employeeId: string
  employeeCode: string
  employeeName: string
  payType: PayType
  presentDays: number
  absentDays: number
  workedHours: number
  overtimeHours: number
  lateMinutes: number
  basePay: number
  overtimePay: number
  deduction: number
  netPay: number
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  promptPayId: string | null
  paymentStatus: PaymentStatus
}

export type PayrollResult = {
  month: number
  year: number
  payday: number
  periodStart: Date
  periodEnd: Date
  status: PayrollPeriodStatus
  locked: boolean
  lockedAt: Date | null
  lockedByUserId: string | null
  source: "preview" | "saved" | "locked"
  items: PayrollItem[]
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getClampedPayday(year: number, month: number, payday: number) {
  return Math.min(Math.max(payday, 1), getDaysInMonth(year, month))
}

function getBusinessDate(year: number, month: number, day: number) {
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00.000${BUSINESS_OFFSET}`)
}

function shiftMonth(year: number, month: number, offset: number) {
  const shiftedMonthIndex = month - 1 + offset
  const shiftedYear = year + Math.floor(shiftedMonthIndex / 12)
  const normalizedMonthIndex = ((shiftedMonthIndex % 12) + 12) % 12

  return {
    year: shiftedYear,
    month: normalizedMonthIndex + 1,
  }
}

export function getPayrollCycleRange(payday: number, year: number, month: number) {
  const previous = shiftMonth(year, month, -1)
  const previousPayday = getClampedPayday(previous.year, previous.month, payday)
  const currentPayday = getClampedPayday(year, month, payday)

  const periodStart =
    previousPayday < getDaysInMonth(previous.year, previous.month)
      ? getBusinessDate(previous.year, previous.month, previousPayday + 1)
      : getBusinessDate(year, month, 1)

  const periodEndExclusive =
    currentPayday < getDaysInMonth(year, month)
      ? getBusinessDate(year, month, currentPayday + 1)
      : getBusinessDate(shiftMonth(year, month, 1).year, shiftMonth(year, month, 1).month, 1)

  const periodEnd = new Date(periodEndExclusive.getTime() - 1)

  return {
    start: periodStart,
    endExclusive: periodEndExclusive,
    end: periodEnd,
  }
}

export function getPayrollPeriodLabelForDate(workDate: Date, payday: number) {
  const { year, month } = getBusinessYearMonth(workDate)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
  })
  const day = Number(formatter.format(workDate))
  const currentPayday = getClampedPayday(year, month, payday)

  if (day <= currentPayday) {
    return { year, month }
  }

  return shiftMonth(year, month, 1)
}

export async function getPayrollPeriod(
  tenantId: string,
  month: number,
  year: number,
) {
  return prisma.payrollPeriod.findUnique({
    where: {
      tenantId_month_year: {
        tenantId,
        month,
        year,
      },
    },
  })
}

async function getTenantPayrollSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { payrollPayday: true },
  })

  if (!tenant) {
    throw new AppError("Tenant not found", 404, "NOT_FOUND")
  }

  return tenant
}

function deriveDailyRate(baseSalary: number | null, dailyRate: number | null) {
  return dailyRate ?? (baseSalary ? roundCurrency(baseSalary / 30) : 0)
}

function deriveHourlyRate(baseSalary: number | null, hourlyRate: number | null) {
  return hourlyRate ?? (baseSalary ? roundCurrency(baseSalary / (30 * 8)) : 0)
}

export async function calculatePayrollPreview(
  tenantId: string,
  month: number,
  year: number,
) {
  const tenant = await getTenantPayrollSettings(tenantId)
  const { start, endExclusive } = getPayrollCycleRange(tenant.payrollPayday, year, month)

  const [employees, existingPayrolls] = await Promise.all([
    prisma.employee.findMany({
      where: {
        tenantId,
        OR: [
          { active: true },
          {
            terminatedAt: {
              gte: start,
            },
          },
        ],
      },
      include: {
        bank: true,
        attendances: {
          where: {
            workDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          orderBy: {
            workDate: "asc",
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    }),
    prisma.payroll.findMany({
      where: {
        month,
        year,
        employee: {
          tenantId,
        },
      },
      select: {
        employeeId: true,
        paymentStatus: true,
      },
    }),
  ])

  const paymentStatusMap = new Map(
    existingPayrolls.map((record) => [record.employeeId, record.paymentStatus]),
  )

  return {
    payday: tenant.payrollPayday,
    ...getPayrollCycleRange(tenant.payrollPayday, year, month),
    items: employees.map((employee) => {
      const presentRecords = employee.attendances.filter(
        (attendance) =>
          attendance.status === "PRESENT" || attendance.status === "LATE",
      )
      const absentRecords = employee.attendances.filter(
        (attendance) => attendance.status === "ABSENT",
      )
      const totalWorkedMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.workedMinutes,
        0,
      )
      const totalLateMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.lateMinutes,
        0,
      )
      const overtimeMinutes = presentRecords.reduce(
        (sum, attendance) =>
          sum + Math.max(0, attendance.workedMinutes - STANDARD_WORK_MINUTES),
        0,
      )

      const dailyRate = deriveDailyRate(employee.baseSalary, employee.dailyRate)
      const hourlyRate = deriveHourlyRate(employee.baseSalary, employee.hourlyRate)

      let basePay = 0
      let deduction = 0

      if (employee.payType === "MONTHLY") {
        basePay = employee.baseSalary ?? 0
        deduction = absentRecords.length * dailyRate
      }

      if (employee.payType === "DAILY") {
        basePay = presentRecords.length * dailyRate
      }

      if (employee.payType === "HOURLY") {
        basePay = (totalWorkedMinutes / 60) * hourlyRate
      }

      const overtimePay = (overtimeMinutes / 60) * hourlyRate * 1.5
      const netPay = Math.max(0, basePay + overtimePay - deduction)

      return {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        payType: employee.payType,
        presentDays: presentRecords.length,
        absentDays: absentRecords.length,
        workedHours: roundCurrency(totalWorkedMinutes / 60),
        overtimeHours: roundCurrency(overtimeMinutes / 60),
        lateMinutes: totalLateMinutes,
        basePay: roundCurrency(basePay),
        overtimePay: roundCurrency(overtimePay),
        deduction: roundCurrency(deduction),
        netPay: roundCurrency(netPay),
        bankName: employee.bank?.bankName ?? null,
        accountName: employee.bank?.accountName ?? null,
        accountNumber: employee.bank?.accountNumber ?? null,
        promptPayId: employee.bank?.promptPayId ?? null,
        paymentStatus: paymentStatusMap.get(employee.id) ?? "PENDING",
      } satisfies PayrollItem
    }),
  }
}

export async function getStoredPayrollItems(
  tenantId: string,
  month: number,
  year: number,
) {
  const records = await prisma.payroll.findMany({
    where: {
      month,
      year,
      employee: {
        tenantId,
      },
    },
    include: {
      employee: {
        include: {
          bank: true,
        },
      },
    },
    orderBy: {
      employee: {
        code: "asc",
      },
    },
  })

  return records.map((record) => ({
    employeeId: record.employeeId,
    employeeCode: record.employee.code,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    payType: record.payTypeSnapshot,
    presentDays: record.presentDays,
    absentDays: record.absentDays,
    workedHours: roundCurrency(record.workedHours),
    overtimeHours: roundCurrency(Math.max(0, record.overtimePay) / Math.max(1, (record.employee.hourlyRate ?? (record.employee.baseSalary ? roundCurrency(record.employee.baseSalary / (30 * 8)) : 1)) * 1.5)),
    lateMinutes: record.lateMinutes,
    basePay: roundCurrency(record.basePay),
    overtimePay: roundCurrency(record.overtimePay),
    deduction: roundCurrency(record.deduction),
    netPay: roundCurrency(record.netPay),
    bankName: record.employee.bank?.bankName ?? null,
    accountName: record.employee.bank?.accountName ?? null,
    accountNumber: record.employee.bank?.accountNumber ?? null,
    promptPayId: record.employee.bank?.promptPayId ?? null,
    paymentStatus: record.paymentStatus,
  }))
}

export async function getPayrollResult(
  tenantId: string,
  month: number,
  year: number,
): Promise<PayrollResult> {
  const tenant = await getTenantPayrollSettings(tenantId)
  const range = getPayrollCycleRange(tenant.payrollPayday, year, month)
  const period = await getPayrollPeriod(tenantId, month, year)

  if (period?.status === "LOCKED") {
    const items = await getStoredPayrollItems(tenantId, month, year)

    return {
      month,
      year,
      payday: tenant.payrollPayday,
      periodStart: range.start,
      periodEnd: range.end,
      status: period.status,
      locked: true,
      lockedAt: period.lockedAt,
      lockedByUserId: period.lockedByUserId,
      source: "locked",
      items,
    }
  }

  const preview = await calculatePayrollPreview(tenantId, month, year)

  return {
    month,
    year,
    payday: preview.payday,
    periodStart: preview.start,
    periodEnd: preview.end,
    status: period?.status ?? "OPEN",
    locked: false,
    lockedAt: null,
    lockedByUserId: null,
    source: period ? "saved" : "preview",
    items: preview.items,
  }
}

export async function savePayrollPeriod(params: {
  tenantId: string
  userId: string
  month: number
  year: number
  action: "save" | "lock"
}) {
  const preview = await calculatePayrollPreview(
    params.tenantId,
    params.month,
    params.year,
  )

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const existingPeriod = await tx.payrollPeriod.upsert({
      where: {
        tenantId_month_year: {
          tenantId: params.tenantId,
          month: params.month,
          year: params.year,
        },
      },
      update: {},
      create: {
        tenantId: params.tenantId,
        month: params.month,
        year: params.year,
      },
    })

    if (existingPeriod.status === "LOCKED") {
      throw new AppError(
        "Payroll period is locked and cannot be recalculated",
        409,
        "PAYROLL_PERIOD_LOCKED",
      )
    }

    for (const item of preview.items) {
      await tx.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: item.employeeId,
            month: params.month,
            year: params.year,
          },
        },
        update: {
          payTypeSnapshot: item.payType,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          workedHours: item.workedHours,
          lateMinutes: item.lateMinutes,
          basePay: item.basePay,
          overtimePay: item.overtimePay,
          deduction: item.deduction,
          netPay: item.netPay,
        },
        create: {
          employeeId: item.employeeId,
          month: params.month,
          year: params.year,
          payTypeSnapshot: item.payType,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          workedHours: item.workedHours,
          lateMinutes: item.lateMinutes,
          basePay: item.basePay,
          overtimePay: item.overtimePay,
          deduction: item.deduction,
          netPay: item.netPay,
        },
      })
    }

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action === "lock" ? "payroll.locked" : "payroll.saved",
        entityType: "PayrollPeriod",
        entityId: existingPeriod.id,
        metadata: {
          month: params.month,
          year: params.year,
          payday: preview.payday,
          itemCount: preview.items.length,
        },
      },
    })

    if (params.action === "lock") {
      await tx.payrollPeriod.update({
        where: {
          id: existingPeriod.id,
        },
        data: {
          status: "LOCKED",
          lockedAt: now,
          lockedByUserId: params.userId,
        },
      })
    }
  })

  return getPayrollResult(params.tenantId, params.month, params.year)
}

export async function unlockPayrollPeriod(params: {
  tenantId: string
  userId: string
  month: number
  year: number
  reason: string
}) {
  const tenant = await getTenantPayrollSettings(params.tenantId)
  const range = getPayrollCycleRange(tenant.payrollPayday, params.year, params.month)

  if (Date.now() > range.end.getTime()) {
    throw new AppError(
      "งวดเงินเดือนนี้สิ้นสุดแล้ว ไม่สามารถเปิดกลับมาแก้ไขย้อนหลังได้",
      409,
      "PAYROLL_PERIOD_ALREADY_ENDED",
    )
  }

  const period = await prisma.payrollPeriod.findUnique({
    where: {
      tenantId_month_year: {
        tenantId: params.tenantId,
        month: params.month,
        year: params.year,
      },
    },
  })

  if (!period) {
    throw new AppError("Payroll period not found", 404, "NOT_FOUND")
  }

  if (period.status !== "LOCKED") {
    throw new AppError(
      "Payroll period is not locked",
      409,
      "PAYROLL_PERIOD_NOT_LOCKED",
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollPeriod.update({
      where: {
        id: period.id,
      },
      data: {
        status: "OPEN",
        lockedAt: null,
        lockedByUserId: null,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: "payroll.unlocked",
        entityType: "PayrollPeriod",
        entityId: period.id,
        metadata: {
          month: params.month,
          year: params.year,
          reason: params.reason,
        },
      },
    })
  })

  return getPayrollResult(params.tenantId, params.month, params.year)
}

export async function updatePayrollPaymentStatus(params: {
  tenantId: string
  userId: string
  employeeId: string
  month: number
  year: number
  paymentStatus: PaymentStatus
}) {
  const period = await getPayrollPeriod(params.tenantId, params.month, params.year)

  if (!period) {
    throw new AppError("กรุณาบันทึกและปิดงวดเงินเดือนก่อนอัปเดตสถานะการโอน", 404, "NOT_FOUND")
  }

  if (period.status !== "LOCKED") {
    throw new AppError(
      "กรุณายืนยันสรุปเงินเดือนก่อนอัปเดตสถานะการโอน",
      409,
      "PAYROLL_PERIOD_NOT_LOCKED",
    )
  }

  const payroll = await prisma.payroll.findFirst({
    where: {
      employeeId: params.employeeId,
      month: params.month,
      year: params.year,
      employee: {
        tenantId: params.tenantId,
      },
    },
    select: {
      id: true,
      employeeId: true,
      paymentStatus: true,
    },
  })

  if (!payroll) {
    throw new AppError("ไม่พบข้อมูลเงินเดือนของพนักงานนี้", 404, "NOT_FOUND")
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPayroll = await tx.payroll.update({
      where: {
        id: payroll.id,
      },
      data: {
        paymentStatus: params.paymentStatus,
      },
      select: {
        id: true,
        employeeId: true,
        paymentStatus: true,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: "payroll.payment_status_updated",
        entityType: "Payroll",
        entityId: updatedPayroll.id,
        metadata: {
          employeeId: updatedPayroll.employeeId,
          month: params.month,
          year: params.year,
          fromStatus: payroll.paymentStatus,
          toStatus: updatedPayroll.paymentStatus,
        },
      },
    })

    return updatedPayroll
  })

  return updated
}

export async function assertPayrollPeriodOpenForDate(
  tenantId: string,
  workDate: Date,
) {
  const tenant = await getTenantPayrollSettings(tenantId)
  const { month, year } = getPayrollPeriodLabelForDate(workDate, tenant.payrollPayday)
  const period = await getPayrollPeriod(tenantId, month, year)

  if (period?.status === "LOCKED") {
    throw new AppError(
      "Payroll period is locked for this work date",
      409,
      "PAYROLL_PERIOD_LOCKED",
    )
  }
}
