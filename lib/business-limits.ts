import type { Prisma } from "@prisma/client"
import { AppError } from "@/lib/http"
import { prisma } from "@/lib/prisma"

export const MAX_ACTIVE_EMPLOYEES_PER_TENANT = 30

type EmployeeCountClient = Pick<Prisma.TransactionClient, "employee">

export async function assertCanAddActiveEmployee(
  tenantId: string,
  client: EmployeeCountClient = prisma,
) {
  const activeEmployeeCount = await client.employee.count({
    where: {
      tenantId,
      active: true,
    },
  })

  if (activeEmployeeCount >= MAX_ACTIVE_EMPLOYEES_PER_TENANT) {
    throw new AppError(
      `ร้านนี้มีพนักงานที่ยังใช้งานอยู่ครบ ${MAX_ACTIVE_EMPLOYEES_PER_TENANT} คนแล้ว หากต้องการเพิ่มคนใหม่ กรุณาระงับพนักงานที่ลาออกแล้วก่อน`,
      409,
      "EMPLOYEE_LIMIT_REACHED",
      {
        maxActiveEmployees: MAX_ACTIVE_EMPLOYEES_PER_TENANT,
        activeEmployeeCount,
      },
    )
  }

  return {
    activeEmployeeCount,
    remainingSlots: MAX_ACTIVE_EMPLOYEES_PER_TENANT - activeEmployeeCount,
  }
}
