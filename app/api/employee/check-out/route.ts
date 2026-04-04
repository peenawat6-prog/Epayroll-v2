import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import {
  ensureCheckoutAfterCheckin,
  getShiftEnd,
  getWorkDate,
} from "@/lib/attendance"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"

export async function POST() {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeSelfService,
    })

    if (!access.user.employeeId) {
      throw new AppError(
        "บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน",
        409,
        "EMPLOYEE_PROFILE_NOT_LINKED",
      )
    }

    const employeeId = access.user.employeeId
    const now = new Date()
    const workDate = getWorkDate(now)

    await assertPayrollPeriodOpenForDate(access.user.tenantId, workDate)

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          workEndMinutes: true,
        },
      }),
      prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: access.user.tenantId,
          active: true,
        },
      }),
    ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    if (!employee) {
      throw new AppError("ไม่พบข้อมูลพนักงาน", 404, "NOT_FOUND")
    }

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        workDate: "desc",
      },
    })

    if (!attendance?.checkIn) {
      throw new AppError("ยังไม่ได้บันทึกเข้างานวันนี้", 400, "CHECKIN_NOT_FOUND")
    }

    if (attendance.workDate.getTime() !== workDate.getTime()) {
      throw new AppError(
        "พบรายการลงเวลาเดิมที่ยังไม่ปิดงาน กรุณาติดต่อหัวหน้า",
        409,
        "OPEN_ATTENDANCE_OUTSIDE_TODAY",
      )
    }

    const workedMinutes = ensureCheckoutAfterCheckin(attendance.checkIn, now)
    const shiftEnd = getShiftEnd(now, tenant.workEndMinutes)

    if (now.getTime() < shiftEnd.getTime()) {
      const earlyCheckoutRequest = await prisma.earlyCheckoutRequest.findFirst({
        where: {
          tenantId: access.user.tenantId,
          employeeId,
          workDate,
          status: "APPROVED",
        },
      })

      if (!earlyCheckoutRequest) {
        throw new AppError(
          "ยังไม่ถึงเวลาเลิกงาน กรุณายื่นคำขอกลับก่อนเวลาและรอหัวหน้าอนุมัติก่อน",
          409,
          "EARLY_CHECKOUT_NOT_APPROVED",
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAttendance = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: now,
          workedMinutes,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: access.user.tenantId,
          userId: access.user.id,
          action: "employee_portal.checked_out",
          entityType: "Attendance",
          entityId: updatedAttendance.id,
          metadata: {
            employeeId,
            workDate,
            workedMinutes,
            isEarlyCheckout: now.getTime() < shiftEnd.getTime(),
          },
        },
      })

      return updatedAttendance
    })

    return jsonResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
