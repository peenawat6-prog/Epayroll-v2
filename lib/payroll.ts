import type { PaymentStatus, PayrollPeriodStatus, PayType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { getBusinessYearMonth, roundCurrency } from "@/lib/time"

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
  latePenaltyPerMinute: number
  latePenaltyAmount: number
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

type PaidCoverage = {
  coveredThroughWorkDate: Date
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

export async function isPayrollPeriodLockedForDate(
  tenantId: string,
  workDate: Date,
) {
  void tenantId
  void workDate
  return false
}

async function getTenantPayrollSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { payrollPayday: true, latePenaltyPerMinute: true },
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

function calculateMonthlyLatePenaltyAmount(params: {
  attendances: Array<{
    lateMinutes: number
  }>
  dailyRate: number
  latePenaltyPerMinute: number
}) {
  return params.attendances.reduce((sum, attendance) => {
    if (attendance.lateMinutes <= 0) {
      return sum
    }

    if (attendance.lateMinutes > 80) {
      return sum + params.dailyRate / 2
    }

    return sum + attendance.lateMinutes * params.latePenaltyPerMinute
  }, 0)
}

function readMetadataString(
  metadata: unknown,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value : null
}

async function getLatestPaidCoverageMap(params: {
  tenantId: string
  month: number
  year: number
}) {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: params.tenantId,
      action: "payroll.payment_status_updated",
      entityType: "Payroll",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 1000,
  })

  const coverageMap = new Map<string, PaidCoverage>()

  for (const log of logs) {
    const employeeId = readMetadataString(log.metadata, "employeeId")
    const toStatus = readMetadataString(log.metadata, "toStatus")
    const coveredThroughWorkDate = readMetadataString(
      log.metadata,
      "coveredThroughWorkDate",
    )
    const monthValue = readMetadataString(log.metadata, "month")
    const yearValue = readMetadataString(log.metadata, "year")

    if (!employeeId || coverageMap.has(employeeId) || toStatus !== "PAID") {
      continue
    }

    if (
      monthValue !== String(params.month) ||
      yearValue !== String(params.year) ||
      !coveredThroughWorkDate
    ) {
      continue
    }

    const parsedDate = new Date(coveredThroughWorkDate)

    if (Number.isNaN(parsedDate.getTime())) {
      continue
    }

    coverageMap.set(employeeId, {
      coveredThroughWorkDate: parsedDate,
    })
  }

  return coverageMap
}

export async function calculatePayrollPreview(
  tenantId: string,
  month: number,
  year: number,
) {
  const tenant = await getTenantPayrollSettings(tenantId)
  const { start, endExclusive } = getPayrollCycleRange(tenant.payrollPayday, year, month)

  const [employees, existingPayrolls, paidCoverageMap] = await Promise.all([
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
        overtimeRequests: {
          where: {
            status: "APPROVED",
            workDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          select: {
            workDate: true,
            overtimeMinutes: true,
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
    getLatestPaidCoverageMap({
      tenantId,
      month,
      year,
    }),
  ])

  const paymentStatusMap = new Map(
    existingPayrolls.map((record) => [record.employeeId, record.paymentStatus]),
  )

  return {
    payday: tenant.payrollPayday,
    ...getPayrollCycleRange(tenant.payrollPayday, year, month),
    items: employees.map((employee) => {
      const paidCoverage = paidCoverageMap.get(employee.id)
      const filteredAttendances =
        (employee.payType === "DAILY" || employee.payType === "HOURLY") &&
        paidCoverage
          ? employee.attendances.filter(
              (attendance) =>
                attendance.workDate.getTime() >
                paidCoverage.coveredThroughWorkDate.getTime(),
            )
          : employee.attendances
      const filteredOvertimeRequests =
        (employee.payType === "DAILY" || employee.payType === "HOURLY") &&
        paidCoverage
          ? employee.overtimeRequests.filter(
              (request) =>
                request.workDate.getTime() >
                paidCoverage.coveredThroughWorkDate.getTime(),
            )
          : employee.overtimeRequests

      const presentRecords = filteredAttendances.filter(
        (attendance) =>
          attendance.status === "PRESENT" || attendance.status === "LATE",
      )
      const absentRecords = filteredAttendances.filter(
        (attendance) => attendance.status === "ABSENT",
      )
      const leaveRecords = filteredAttendances.filter(
        (attendance) => attendance.status === "LEAVE",
      )
      const totalWorkedMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.workedMinutes,
        0,
      )
      const totalLateMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.lateMinutes,
        0,
      )
      const presentWorkDateKeys = new Set(
        presentRecords.map((attendance) => attendance.workDate.toISOString()),
      )
      const approvedOvertimeMinutes = filteredOvertimeRequests.reduce(
        (sum, request) =>
          presentWorkDateKeys.has(request.workDate.toISOString())
            ? sum + request.overtimeMinutes
            : sum,
        0,
      )

      const dailyRate = deriveDailyRate(employee.baseSalary, employee.dailyRate)
      const hourlyRate = deriveHourlyRate(employee.baseSalary, employee.hourlyRate)

      let basePay = 0
      let deduction = 0
      let latePenaltyAmount = totalLateMinutes * tenant.latePenaltyPerMinute

      if (employee.payType === "MONTHLY") {
        basePay = employee.baseSalary ?? 0
        deduction = (absentRecords.length + leaveRecords.length) * dailyRate
        latePenaltyAmount = calculateMonthlyLatePenaltyAmount({
          attendances: presentRecords,
          dailyRate,
          latePenaltyPerMinute: tenant.latePenaltyPerMinute,
        })
      }

      if (employee.payType === "DAILY") {
        basePay = presentRecords.length * dailyRate
      }

      if (employee.payType === "HOURLY") {
        basePay = (totalWorkedMinutes / 60) * hourlyRate
      }

      deduction += latePenaltyAmount

      const overtimePay = (approvedOvertimeMinutes / 60) * hourlyRate * 1.5
      const netPay = Math.max(0, basePay + overtimePay - deduction)
      const hasOutstandingWork =
        filteredAttendances.length > 0 || filteredOvertimeRequests.length > 0
      const paymentStatus =
        (employee.payType === "DAILY" || employee.payType === "HOURLY") &&
        paidCoverage &&
        hasOutstandingWork
          ? "PENDING"
          : paymentStatusMap.get(employee.id) ?? "PENDING"

      return {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        payType: employee.payType,
        presentDays: presentRecords.length,
        absentDays: absentRecords.length,
        workedHours: roundCurrency(totalWorkedMinutes / 60),
        overtimeHours: roundCurrency(approvedOvertimeMinutes / 60),
        lateMinutes: totalLateMinutes,
        latePenaltyPerMinute: tenant.latePenaltyPerMinute,
        latePenaltyAmount: roundCurrency(latePenaltyAmount),
        basePay: roundCurrency(basePay),
        overtimePay: roundCurrency(overtimePay),
        deduction: roundCurrency(deduction),
        netPay: roundCurrency(netPay),
        bankName: employee.bank?.bankName ?? null,
        accountName: employee.bank?.accountName ?? null,
        accountNumber: employee.bank?.accountNumber ?? null,
        promptPayId: employee.bank?.promptPayId ?? null,
        paymentStatus,
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
    latePenaltyPerMinute:
      record.lateMinutes > 0
        ? Math.round(record.latePenaltyAmount / record.lateMinutes)
        : 0,
    latePenaltyAmount: roundCurrency(record.latePenaltyAmount),
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
  const period = await getPayrollPeriod(tenantId, month, year)
  const preview = await calculatePayrollPreview(tenantId, month, year)

  return {
    month,
    year,
    payday: preview.payday,
    periodStart: preview.start,
    periodEnd: preview.end,
    status: "OPEN",
    locked: false,
    lockedAt: period?.lockedAt ?? null,
    lockedByUserId: period?.lockedByUserId ?? null,
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

    await tx.payroll.deleteMany({
      where: {
        month: params.month,
        year: params.year,
        employee: {
          tenantId: params.tenantId,
        },
        employeeId: {
          notIn: preview.items.map((item) => item.employeeId),
        },
      },
    })

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
          latePenaltyAmount: item.latePenaltyAmount,
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
          latePenaltyAmount: item.latePenaltyAmount,
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
  reason?: string | null
}) {
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
          reason: params.reason ?? "เจ้าของร้านเปิดงวดกลับมาแก้ไข",
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
  const preview = await calculatePayrollPreview(
    params.tenantId,
    params.month,
    params.year,
  )
  const previewItem = preview.items.find(
    (item) => item.employeeId === params.employeeId,
  )

  if (!previewItem) {
    throw new AppError("ไม่พบข้อมูลเงินเดือนของพนักงานนี้", 404, "NOT_FOUND")
  }

  const tenant = await getTenantPayrollSettings(params.tenantId)
  const { start, endExclusive } = getPayrollCycleRange(
    tenant.payrollPayday,
    params.year,
    params.month,
  )
  const paidCoverageMap = await getLatestPaidCoverageMap({
    tenantId: params.tenantId,
    month: params.month,
    year: params.year,
  })
  const paidCoverage = paidCoverageMap.get(params.employeeId)
  const attendanceWhere =
    (previewItem.payType === "DAILY" || previewItem.payType === "HOURLY") &&
    paidCoverage
      ? {
          gt: paidCoverage.coveredThroughWorkDate,
          lt: endExclusive,
        }
      : {
          gte: start,
          lt: endExclusive,
        }
  const outstandingAttendances = await prisma.attendance.findMany({
    where: {
      employeeId: params.employeeId,
      workDate: attendanceWhere,
      status: {
        in: ["PRESENT", "LATE", "ABSENT", "LEAVE"],
      },
    },
    orderBy: {
      workDate: "asc",
    },
    select: {
      workDate: true,
    },
  })
  const coveredThroughWorkDate =
    params.paymentStatus === "PAID" && outstandingAttendances.length > 0
      ? outstandingAttendances[outstandingAttendances.length - 1].workDate
      : null

  if (
    params.paymentStatus === "PAID" &&
    (previewItem.payType === "DAILY" || previewItem.payType === "HOURLY") &&
    !coveredThroughWorkDate
  ) {
    throw new AppError("ไม่มีรายการค้างจ่ายในรอบนี้แล้ว", 409, "NOTHING_TO_PAY")
  }

  const existingPayroll = await prisma.payroll.findFirst({
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

  const updated = await prisma.$transaction(async (tx) => {
    const upsertedPayroll = await tx.payroll.upsert({
      where: {
        employeeId_month_year: {
          employeeId: params.employeeId,
          month: params.month,
          year: params.year,
        },
      },
      update: {
        payTypeSnapshot: previewItem.payType,
        presentDays: previewItem.presentDays,
        absentDays: previewItem.absentDays,
        workedHours: previewItem.workedHours,
        lateMinutes: previewItem.lateMinutes,
        latePenaltyAmount: previewItem.latePenaltyAmount,
        basePay: previewItem.basePay,
        overtimePay: previewItem.overtimePay,
        deduction: previewItem.deduction,
        netPay: previewItem.netPay,
        paymentStatus: params.paymentStatus,
      },
      create: {
        employeeId: params.employeeId,
        month: params.month,
        year: params.year,
        payTypeSnapshot: previewItem.payType,
        presentDays: previewItem.presentDays,
        absentDays: previewItem.absentDays,
        workedHours: previewItem.workedHours,
        lateMinutes: previewItem.lateMinutes,
        latePenaltyAmount: previewItem.latePenaltyAmount,
        basePay: previewItem.basePay,
        overtimePay: previewItem.overtimePay,
        deduction: previewItem.deduction,
        netPay: previewItem.netPay,
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
        entityId: upsertedPayroll.id,
        metadata: {
          employeeId: upsertedPayroll.employeeId,
          month: String(params.month),
          year: String(params.year),
          fromStatus: existingPayroll?.paymentStatus ?? "PENDING",
          toStatus: upsertedPayroll.paymentStatus,
          coveredThroughWorkDate: coveredThroughWorkDate?.toISOString() ?? null,
          presentDays: previewItem.presentDays,
          netPay: previewItem.netPay,
        },
      },
    })

    return upsertedPayroll
  })

  return updated
}

export async function assertPayrollPeriodOpenForDate(
  tenantId: string,
  workDate: Date,
) {
  void tenantId
  void workDate
}
