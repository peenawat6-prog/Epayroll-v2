import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { ensureCheckoutAfterCheckin, getShiftEnd, getWorkDate } from "@/lib/attendance"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { asTrimmedString } from "@/lib/validators"

type CheckOutBody = {
  employeeId?: unknown
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })
    const body = await readJsonBody<CheckOutBody>(req)
    const employeeId = asTrimmedString(body.employeeId, "employeeId")
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
      throw new AppError("Employee not found", 404, "NOT_FOUND")
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
      throw new AppError("ยังไม่ได้ check-in วันนี้", 400, "CHECKIN_NOT_FOUND")
    }

    if (attendance.workDate.getTime() !== workDate.getTime()) {
      throw new AppError(
        "พบรายการลงเวลาเดิมที่ยังไม่ปิดงาน กรุณาตรวจสอบก่อน",
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
          `ยังไม่ถึงเวลาเลิกงาน กรุณาส่งคำขอกลับก่อนเวลาและรอหัวหน้าอนุมัติก่อน`,
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
          action: "attendance.checked_out",
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
