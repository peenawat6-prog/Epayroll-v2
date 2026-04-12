import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { forceCloseOpenAttendance } from "@/lib/attendance-auto-checkout"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { asTrimmedString } from "@/lib/validators"

type ForceCheckOutBody = {
  attendanceId?: unknown
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })
    const body = await readJsonBody<ForceCheckOutBody>(req)
    const attendanceId = asTrimmedString(body.attendanceId, "attendanceId")

    const attendance = await prisma.attendance.findFirst({
      where: {
        id: attendanceId,
        checkIn: {
          not: null,
        },
        checkOut: null,
        employee: {
          tenantId: access.user.tenantId,
          active: true,
        },
      },
    })

    if (!attendance) {
      throw new AppError("ไม่พบบันทึกลงเวลาที่ยังไม่ออกงาน", 404, "NOT_FOUND")
    }

    const tenant = await prisma.tenant.findUnique({
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
    })

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    const updatedAttendance = await forceCloseOpenAttendance({
      tenantId: access.user.tenantId,
      auditUserId: access.user.id,
      attendance,
      tenant,
    })

    if (!updatedAttendance) {
      throw new AppError(
        "บันทึกนี้ยังไม่ถึงเงื่อนไขปิดงานย้อนหลังหรือเป็นของวันปัจจุบัน",
        409,
        "FORCE_CHECKOUT_NOT_ALLOWED",
      )
    }

    return jsonResponse(updatedAttendance)
  } catch (error) {
    return handleApiError(error)
  }
}
