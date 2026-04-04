import type { UserRole } from "@prisma/client"

export const ROLE_GROUPS = {
  employeeRead: ["DEV", "OWNER", "ADMIN", "HR", "FINANCE", "EMPLOYEE"] as UserRole[],
  employeeManage: ["DEV", "OWNER", "ADMIN", "HR"] as UserRole[],
  attendanceView: ["DEV", "OWNER", "ADMIN", "HR", "FINANCE"] as UserRole[],
  attendanceManage: ["DEV", "OWNER", "ADMIN", "HR"] as UserRole[],
  attendanceApprove: ["DEV", "OWNER", "ADMIN"] as UserRole[],
  payrollView: ["DEV", "OWNER", "ADMIN", "FINANCE"] as UserRole[],
  payrollManage: ["DEV", "OWNER", "ADMIN", "FINANCE"] as UserRole[],
  payrollUnlock: ["DEV", "OWNER"] as UserRole[],
  auditView: ["DEV", "OWNER", "ADMIN", "HR", "FINANCE"] as UserRole[],
  opsView: ["DEV", "OWNER", "ADMIN"] as UserRole[],
  staffRequestSubmit: ["OWNER", "ADMIN", "HR", "EMPLOYEE"] as UserRole[],
  staffRequestReview: ["DEV", "OWNER", "ADMIN", "HR"] as UserRole[],
  employeeSelfService: ["EMPLOYEE"] as UserRole[],
  dashboardView: ["DEV", "OWNER", "ADMIN", "HR", "FINANCE", "EMPLOYEE"] as UserRole[],
} as const

export function hasAnyRole(
  role: UserRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return allowedRoles.includes(role)
}
