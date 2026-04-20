import { jsonResponse, readJsonBody } from "@/lib/http"
import { updatePayrollAdjustments } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  asMonth,
  asOptionalNumber,
  asTrimmedString,
  asYear,
} from "@/lib/validators"

type PayrollAdjustmentBody = {
  employeeId?: unknown
  month?: unknown
  year?: unknown
  specialBonus?: unknown
  advanceDeduction?: unknown
}

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollManage,
  },
  async (req, _context, access) => {
    const now = new Date()
    const body = await readJsonBody<PayrollAdjustmentBody>(req)

    return jsonResponse(
      await updatePayrollAdjustments({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        employeeId: asTrimmedString(body.employeeId, "employeeId"),
        month: asMonth(body.month, now.getMonth() + 1),
        year: asYear(body.year, now.getFullYear()),
        specialBonus: asOptionalNumber(body.specialBonus) ?? 0,
        advanceDeduction: asOptionalNumber(body.advanceDeduction) ?? 0,
      }),
    )
  },
)
