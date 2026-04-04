import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { createAuditLog } from "@/lib/audit"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import {
  asBusinessDate,
  asDayOffWeekdays,
  asEmployeeType,
  asOptionalBusinessDate,
  asOptionalNumber,
  asOptionalTrimmedString,
  asPayType,
  asStaffManagementRole,
  asTrimmedString,
  asWorkShift,
} from "@/lib/validators"

type EmployeeUpdateBody = {
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
  active?: unknown
  terminatedAt?: unknown
  bankName?: unknown
  accountName?: unknown
  accountNumber?: unknown
  promptPayId?: unknown
  userRole?: unknown
}

async function getScopedEmployee(employeeId: string, tenantId: string) {
  return prisma.employee.findFirst({
    where: {
      id: employeeId,
      tenantId,
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
  })
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeManage,
    })
    const { id } = await context.params
    const employee = await getScopedEmployee(id, access.user.tenantId)

    if (!employee) {
      throw new AppError("Employee not found", 404, "NOT_FOUND")
    }

    const body = await readJsonBody<EmployeeUpdateBody>(req)
    const active =
      typeof body.active === "boolean" ? body.active : employee.active
    const branchId =
      body.branchId === undefined
        ? employee.branchId
        : asOptionalTrimmedString(body.branchId)
    const bankName =
      body.bankName === undefined
        ? employee.bank?.bankName ?? null
        : asOptionalTrimmedString(body.bankName)
    const accountName =
      body.accountName === undefined
        ? employee.bank?.accountName ?? null
        : asOptionalTrimmedString(body.accountName)
    const accountNumber =
      body.accountNumber === undefined
        ? employee.bank?.accountNumber ?? null
        : asOptionalTrimmedString(body.accountNumber)
    const promptPayId =
      body.promptPayId === undefined
        ? employee.bank?.promptPayId ?? null
        : asOptionalTrimmedString(body.promptPayId)
    const shouldKeepBankAccount = Boolean(bankName && accountName && accountNumber)
    const nextUserRole =
      body.userRole === undefined
        ? employee.user?.role
        : asStaffManagementRole(body.userRole)
    const canAssignRole = ["DEV", "OWNER"].includes(access.user.role)

    if (body.userRole !== undefined && !canAssignRole) {
      throw new AppError(
        "เฉพาะเจ้าของร้านหรือทีมซัพพอร์ตเท่านั้นที่เปลี่ยนสิทธิ์พนักงานได้",
        403,
        "FORBIDDEN",
      )
    }

    if (body.userRole !== undefined && !employee.userId) {
      throw new AppError(
        "พนักงานคนนี้ยังไม่มีบัญชีล็อกอิน จึงยังเปลี่ยนสิทธิ์ไม่ได้",
        409,
        "EMPLOYEE_LOGIN_NOT_FOUND",
      )
    }

    if (!active) {
      const openAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId: employee.id,
          checkIn: { not: null },
          checkOut: null,
        },
      })

      if (openAttendance) {
        throw new AppError(
          "Cannot deactivate employee with an open attendance record",
          409,
          "EMPLOYEE_HAS_OPEN_ATTENDANCE",
        )
      }
    }

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
        throw new AppError("ไม่พบสาขาที่เลือก", 404, "BRANCH_NOT_FOUND")
      }
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        firstName:
          body.firstName === undefined
            ? employee.firstName
            : asTrimmedString(body.firstName, "firstName"),
        lastName:
          body.lastName === undefined
            ? employee.lastName
            : asTrimmedString(body.lastName, "lastName"),
        branchId,
        phone:
          body.phone === undefined
            ? employee.phone
            : asOptionalTrimmedString(body.phone),
        position:
          body.position === undefined
            ? employee.position
            : asTrimmedString(body.position, "position"),
        employeeType:
          body.employeeType === undefined
            ? employee.employeeType
            : asEmployeeType(body.employeeType),
        payType:
          body.payType === undefined
            ? employee.payType
            : asPayType(body.payType),
        workShift:
          body.workShift === undefined
            ? employee.workShift
            : asWorkShift(body.workShift),
        dayOffWeekdays:
          body.dayOffWeekdays === undefined
            ? employee.dayOffWeekdays
            : asDayOffWeekdays(body.dayOffWeekdays),
        baseSalary:
          body.baseSalary === undefined
            ? employee.baseSalary
            : asOptionalNumber(body.baseSalary),
        dailyRate:
          body.dailyRate === undefined
            ? employee.dailyRate
            : asOptionalNumber(body.dailyRate),
        hourlyRate:
          body.hourlyRate === undefined
            ? employee.hourlyRate
            : asOptionalNumber(body.hourlyRate),
        startDate:
          body.startDate === undefined
            ? employee.startDate
            : asBusinessDate(body.startDate, "startDate"),
        active,
        terminatedAt: active
          ? null
          : asOptionalBusinessDate(body.terminatedAt) ??
            employee.terminatedAt ??
            new Date(),
        bank: shouldKeepBankAccount
          ? employee.bank
              ? {
                update: {
                  bankName: bankName!,
                  accountName: accountName!,
                  accountNumber: accountNumber!,
                  promptPayId,
                },
              }
            : {
                create: {
                  bankName: bankName!,
                  accountName: accountName!,
                  accountNumber: accountNumber!,
                  promptPayId,
                },
              }
          : employee.bank
            ? {
                delete: true,
              }
            : undefined,
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
    })

    if (nextUserRole && employee.userId && employee.user?.role !== nextUserRole) {
      await prisma.user.update({
        where: {
          id: employee.userId,
        },
        data: {
          role: nextUserRole,
        },
      })
      updated.user = {
        id: employee.userId,
        role: nextUserRole,
        email: employee.user?.email ?? "",
      }
    }

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "employee.updated",
      entityType: "Employee",
      entityId: updated.id,
      metadata: {
        active: updated.active,
        payType: updated.payType,
        workShift: updated.workShift,
        dayOffWeekdays: updated.dayOffWeekdays,
        branchId: updated.branchId,
        hasBank: shouldKeepBankAccount,
        userRole: nextUserRole ?? null,
      },
    })

    return jsonResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeManage,
    })
    const { id } = await context.params
    const employee = await getScopedEmployee(id, access.user.tenantId)

    if (!employee) {
      throw new AppError("Employee not found", 404, "NOT_FOUND")
    }

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { not: null },
        checkOut: null,
      },
    })

    if (openAttendance) {
      throw new AppError(
        "Cannot archive employee with an open attendance record",
        409,
        "EMPLOYEE_HAS_OPEN_ATTENDANCE",
      )
    }

    const archived = await prisma.employee.update({
      where: { id },
      data: {
        active: false,
        terminatedAt: employee.terminatedAt ?? new Date(),
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "employee.archived",
      entityType: "Employee",
      entityId: archived.id,
      metadata: {
        code: archived.code,
      },
    })

    return jsonResponse(archived)
  } catch (error) {
    return handleApiError(error)
  }
}
