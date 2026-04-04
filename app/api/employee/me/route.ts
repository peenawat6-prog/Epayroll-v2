import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { getShiftWorkDate } from "@/lib/attendance"
import { asOptionalTrimmedString, asTrimmedString } from "@/lib/validators"

type EmployeeBankUpdateBody = {
  bankName?: unknown
  accountName?: unknown
  accountNumber?: unknown
  promptPayId?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.employeeSelfService,
  },
  async (_req, _context, access) => {
    if (!access.user.employeeId) {
      throw new AppError(
        "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน",
        409,
        "EMPLOYEE_PROFILE_NOT_LINKED",
      )
    }

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          workStartMinutes: true,
          workEndMinutes: true,
          morningShiftStartMinutes: true,
          morningShiftEndMinutes: true,
          afternoonShiftStartMinutes: true,
          afternoonShiftEndMinutes: true,
          nightShiftStartMinutes: true,
          nightShiftEndMinutes: true,
        },
      }),
      prisma.employee.findFirst({
      where: {
        id: access.user.employeeId,
        tenantId: access.user.tenantId,
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        position: true,
        workShift: true,
        active: true,
        bank: {
          select: {
            bankName: true,
            accountName: true,
            accountNumber: true,
            promptPayId: true,
          },
        },
      },
      }),
    ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404, "NOT_FOUND")
    }

    const todayAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate: getShiftWorkDate(new Date(), tenant, employee.workShift),
        },
      },
      select: {
        id: true,
        workDate: true,
        checkIn: true,
        checkOut: true,
        checkInPhotoUrl: true,
        workedMinutes: true,
        lateMinutes: true,
        status: true,
        workShift: true,
      },
    })

    return jsonResponse({
      user: access.user,
      employee,
      todayAttendance,
      subscription: access.subscription,
    })
  },
)

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.employeeSelfService,
  },
  async (req, _context, access) => {
    if (!access.user.employeeId) {
      throw new AppError(
        "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน",
        409,
        "EMPLOYEE_PROFILE_NOT_LINKED",
      )
    }

    const body = await readJsonBody<EmployeeBankUpdateBody>(req)
    const bankName = asTrimmedString(body.bankName, "bankName")
    const accountName = asTrimmedString(body.accountName, "accountName")
    const accountNumber = asTrimmedString(body.accountNumber, "accountNumber")
    const promptPayId = asOptionalTrimmedString(body.promptPayId)

    const employee = await prisma.employee.findFirst({
      where: {
        id: access.user.employeeId,
        tenantId: access.user.tenantId,
      },
      include: {
        bank: true,
      },
    })

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404, "NOT_FOUND")
    }

    const updated = await prisma.employee.update({
      where: {
        id: employee.id,
      },
      data: {
        bank: employee.bank
          ? {
              update: {
                bankName,
                accountName,
                accountNumber,
                promptPayId,
              },
            }
          : {
              create: {
                bankName,
                accountName,
                accountNumber,
                promptPayId,
              },
            },
      },
      select: {
        id: true,
        code: true,
        firstName: true,
        lastName: true,
        position: true,
        workShift: true,
        active: true,
        bank: {
          select: {
            bankName: true,
            accountName: true,
            accountNumber: true,
            promptPayId: true,
          },
        },
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "employee.bank_updated_self_service",
      entityType: "Employee",
      entityId: updated.id,
      metadata: {
        bankName: updated.bank?.bankName,
        hasPromptPay: Boolean(updated.bank?.promptPayId),
      },
    })

    return jsonResponse({
      employee: updated,
      message: "บันทึกข้อมูลบัญชีรับเงินเรียบร้อยแล้ว",
    })
  },
)
