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

    const [
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      absentToday,
      pendingEmployeeRegistrations,
      pendingAttendanceCorrections,
      pendingLeaves,
      pendingOvertimeRequests,
      pendingEarlyCheckoutRequests,
      pendingResignationRequests,
    ] = await Promise.all([
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
      prisma.employeeRegistrationRequest.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.attendanceCorrection.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.leave.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.overtimeRequest.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.earlyCheckoutRequest.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.resignationRequest.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
    ])

    const pendingStaffRequests =
      pendingLeaves +
      pendingOvertimeRequests +
      pendingEarlyCheckoutRequests +
      pendingResignationRequests
    const pendingTotalRequests =
      pendingEmployeeRegistrations +
      pendingAttendanceCorrections +
      pendingStaffRequests

    return jsonResponse({
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      absentToday,
      pendingEmployeeRegistrations,
      pendingStaffRequests,
      pendingAttendanceCorrections,
      pendingTotalRequests,
      subscription: access.subscription,
    })
  },
)
