import { prisma } from "@/lib/prisma"

const DEFAULT_EMPLOYEE_CODE_PREFIX = "EMP"
const DEFAULT_EMPLOYEE_CODE_DIGITS = 4

function getEmployeeCodeSequence(code: string) {
  const match = code.match(/^EMP(\d+)$/i)

  if (!match) {
    return 0
  }

  const sequence = Number(match[1])
  return Number.isInteger(sequence) ? sequence : 0
}

export async function generateNextEmployeeCode(tenantId: string) {
  const [employees, registrations] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId },
      select: { code: true },
    }),
    prisma.employeeRegistrationRequest.findMany({
      where: {
        tenantId,
        status: "PENDING",
      },
      select: { code: true },
    }),
  ])

  const maxSequence = [...employees, ...registrations].reduce((max, item) => {
    return Math.max(max, getEmployeeCodeSequence(item.code))
  }, 0)

  const nextSequence = maxSequence + 1

  return `${DEFAULT_EMPLOYEE_CODE_PREFIX}${String(nextSequence).padStart(
    DEFAULT_EMPLOYEE_CODE_DIGITS,
    "0",
  )}`
}
