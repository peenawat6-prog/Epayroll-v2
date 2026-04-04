import { prisma } from "@/lib/prisma"
import { jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { getBusinessDateStart } from "@/lib/time"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.dashboardView,
  },
  async (_req, _context, access) => {
    const today = getBusinessDateStart(new Date())
    const tenantId = access.user.tenantId

    const [totalEmployees, checkedInToday, checkedOutToday, absentToday] =
      await Promise.all([
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkIn: { not: null },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkOut: { not: null },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
            attendances: {
              none: {
                workDate: today,
              },
            },
          },
        }),
      ])

    return jsonResponse({
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      absentToday,
      subscription: access.subscription,
    })
  },
)
