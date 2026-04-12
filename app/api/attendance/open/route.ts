import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { getShiftWorkDate } from "@/lib/attendance"
import { handleApiError, jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"

export async function GET() {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })

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
      return jsonResponse([])
    }

    const openAttendances = await prisma.attendance.findMany({
      where: {
        checkIn: {
          not: null,
        },
        checkOut: null,
        employee: {
          tenantId: access.user.tenantId,
          active: true,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            position: true,
            workShift: true,
          },
        },
      },
      orderBy: [
        {
          workDate: "asc",
        },
        {
          checkIn: "asc",
        },
      ],
    })

    const now = new Date()

    return jsonResponse(
      openAttendances.map((attendance) => {
        const currentWorkDate = getShiftWorkDate(
          now,
          tenant,
          attendance.workShift,
        )

        return {
          id: attendance.id,
          workDate: attendance.workDate,
          checkIn: attendance.checkIn,
          workShift: attendance.workShift,
          isStale: attendance.workDate.getTime() < currentWorkDate.getTime(),
          employee: attendance.employee,
        }
      }),
    )
  } catch (error) {
    return handleApiError(error)
  }
}
