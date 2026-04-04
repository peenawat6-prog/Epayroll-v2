import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { asOptionalBusinessDate } from "@/lib/validators"

export async function GET(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceView,
    })
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get("employeeId")
    const startDate = asOptionalBusinessDate(searchParams.get("startDate"))
    const endDate = asOptionalBusinessDate(searchParams.get("endDate"))

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new AppError("Invalid attendance date range", 400, "INVALID_INPUT")
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employee: {
          tenantId: access.user.tenantId,
        },
        ...(employeeId ? { employeeId } : {}),
        ...(startDate || endDate
          ? {
              workDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
      orderBy: [{ workDate: "desc" }, { checkIn: "desc" }],
      take: 90,
    })

    return jsonResponse(attendanceRecords)
  } catch (error) {
    return handleApiError(error)
  }
}
