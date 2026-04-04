import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { createAuditLog } from "@/lib/audit"
import { assertCanAddActiveEmployee } from "@/lib/business-limits"
import { generateNextEmployeeCode } from "@/lib/employee-code"
import { handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import {
  asBusinessDate,
  asDayOffWeekdays,
  asEmployeeType,
  asOptionalNumber,
  asOptionalTrimmedString,
  asPayType,
  asTrimmedString,
  asWorkShift,
} from "@/lib/validators"

type EmployeeCreateBody = {
  code?: unknown
  branchId?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  position?: unknown
  employeeType?: unknown
  payType?: unknown
  workShift?: unknown
  dayOffWeekdays?: unknown
  baseSalary?: unknown
  dailyRate?: unknown
  hourlyRate?: unknown
  startDate?: unknown
  bankName?: unknown
  accountName?: unknown
  accountNumber?: unknown
  promptPayId?: unknown
}

export async function GET(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeRead,
    })
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get("includeInactive") === "true"
    const employeeSelfFilter =
      access.user.role === "EMPLOYEE"
        ? { id: access.user.employeeId ?? "__NO_EMPLOYEE__" }
        : {}

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: access.user.tenantId,
        ...employeeSelfFilter,
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            role: true,
            email: true,
          },
        },
        bank: true,
      },
      orderBy: [{ active: "desc" }, { code: "asc" }],
    })

    return jsonResponse(employees)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeManage,
    })
    await assertCanAddActiveEmployee(access.user.tenantId)

    const body = await readJsonBody<EmployeeCreateBody>(req)
    const code =
      body.code === undefined || body.code === null || String(body.code).trim() === ""
        ? await generateNextEmployeeCode(access.user.tenantId)
        : asTrimmedString(body.code, "code")
    const firstName = asTrimmedString(body.firstName, "firstName")
    const lastName = asTrimmedString(body.lastName, "lastName")
    const phone = asOptionalTrimmedString(body.phone)
    const branchId = asOptionalTrimmedString(body.branchId)
    const position = asTrimmedString(body.position, "position")
    const employeeType = asEmployeeType(body.employeeType)
    const payType = asPayType(body.payType)
    const workShift = asWorkShift(body.workShift)
    const dayOffWeekdays = asDayOffWeekdays(body.dayOffWeekdays)
    const baseSalary = asOptionalNumber(body.baseSalary)
    const dailyRate = asOptionalNumber(body.dailyRate)
    const hourlyRate = asOptionalNumber(body.hourlyRate)
    const startDate = body.startDate
      ? asBusinessDate(body.startDate, "startDate")
      : new Date()
    const bankName = asOptionalTrimmedString(body.bankName)
    const accountName = asOptionalTrimmedString(body.accountName)
    const accountNumber = asOptionalTrimmedString(body.accountNumber)
    const promptPayId = asOptionalTrimmedString(body.promptPayId)

    const shouldCreateBankAccount = Boolean(bankName && accountName && accountNumber)

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          tenantId: access.user.tenantId,
        },
        select: {
          id: true,
        },
      })

      if (!branch) {
        return jsonResponse(
          { error: "ไม่พบสาขาที่เลือก", code: "BRANCH_NOT_FOUND" },
          404,
        )
      }
    }

    const existing = await prisma.employee.findUnique({
      where: {
        tenantId_code: {
          tenantId: access.user.tenantId,
          code,
        },
      },
    })

    if (existing) {
      return jsonResponse(
        { error: "รหัสพนักงานนี้ถูกใช้งานแล้ว" },
        409,
      )
    }

    const employee = await prisma.employee.create({
      data: {
        tenantId: access.user.tenantId,
        branchId,
        code,
        firstName,
        lastName,
        phone,
        position,
        employeeType,
        payType,
        workShift,
        dayOffWeekdays,
        baseSalary,
        dailyRate,
        hourlyRate,
        startDate,
        active: true,
        ...(shouldCreateBankAccount
          ? {
              bank: {
                create: {
                  bankName: bankName!,
                  accountName: accountName!,
                  accountNumber: accountNumber!,
                  promptPayId,
                },
              },
            }
          : {}),
      },
      include: {
        bank: true,
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "employee.created",
      entityType: "Employee",
      entityId: employee.id,
      metadata: {
        code: employee.code,
        payType: employee.payType,
        workShift: employee.workShift,
        dayOffWeekdays: employee.dayOffWeekdays,
        branchId: employee.branchId,
        hasBank: shouldCreateBankAccount,
      },
    })

    return jsonResponse(employee, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
