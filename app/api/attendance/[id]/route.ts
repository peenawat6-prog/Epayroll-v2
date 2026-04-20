import { prisma } from "@/lib/prisma"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import {
  calculateAttendanceMetrics,
  getShiftWorkDate,
} from "@/lib/attendance"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { asOptionalBusinessDate } from "@/lib/validators"

type AttendanceUpdateBody = {
  checkIn?: unknown
  checkOut?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceManage,
  },
  async (req, context: { params: Promise<{ id: string }> }, access) => {
    const { id } = await context.params
    const body = await readJsonBody<AttendanceUpdateBody>(req)
    const requestedCheckIn = asOptionalBusinessDate(body.checkIn)
    const requestedCheckOut = asOptionalBusinessDate(body.checkOut)

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        employee: {
          tenantId: access.user.tenantId,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            workShift: true,
            tenantId: true,
            tenant: {
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
            },
          },
        },
      },
    })

    if (!attendance) {
      throw new AppError("ไม่พบบันทึกลงเวลา", 404, "NOT_FOUND")
    }

    const nextCheckIn = requestedCheckIn ?? attendance.checkIn
    const nextCheckOut = requestedCheckOut ?? attendance.checkOut

    if (nextCheckOut && !nextCheckIn) {
      throw new AppError(
        "ต้องมีเวลาเข้างานก่อนจึงจะกำหนดเวลาออกงานได้",
        400,
        "INVALID_INPUT",
      )
    }

    if (nextCheckIn && nextCheckOut && nextCheckOut.getTime() <= nextCheckIn.getTime()) {
      throw new AppError(
        "เวลาออกงานต้องช้ากว่าเวลาเข้างาน",
        400,
        "INVALID_ATTENDANCE_TIME",
      )
    }

    const nextWorkDate = nextCheckIn
      ? getShiftWorkDate(
          nextCheckIn,
          attendance.employee.tenant,
          attendance.workShift,
        )
      : attendance.workDate

    await assertPayrollPeriodOpenForDate(access.user.tenantId, nextWorkDate)

    const metrics = calculateAttendanceMetrics({
      checkIn: nextCheckIn,
      checkOut: nextCheckOut,
      workShift: attendance.workShift,
      shiftSettings: attendance.employee.tenant,
    })

    const updatedAttendance = await prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.update({
        where: {
          id: attendance.id,
        },
        data: {
          workDate: nextWorkDate,
          checkIn: nextCheckIn,
          checkOut: nextCheckOut,
          workedMinutes: metrics.workedMinutes,
          lateMinutes: metrics.lateMinutes,
          status: metrics.status,
        },
      })

      await tx.attendanceCorrection.updateMany({
        where: {
          attendanceId: attendance.id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewedByUserId: access.user.id,
          reviewedAt: new Date(),
          reviewNote: "ฝ่ายบริหารแก้ไขเวลาโดยตรงจากหน้าประวัติแล้ว",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: access.user.tenantId,
          userId: access.user.id,
          action: "attendance.directly_updated",
          entityType: "Attendance",
          entityId: updated.id,
          metadata: {
            previousWorkDate: attendance.workDate,
            nextWorkDate,
            previousCheckIn: attendance.checkIn,
            nextCheckIn,
            previousCheckOut: attendance.checkOut,
            nextCheckOut,
            previousStatus: attendance.status,
            nextStatus: updated.status,
          },
        },
      })

      return updated
    })

    return jsonResponse(updatedAttendance)
  },
)
