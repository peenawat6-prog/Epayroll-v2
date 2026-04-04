import { jsonResponse, readJsonBody } from "@/lib/http"
import { updatePayrollPaymentStatus } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  asMonth,
  asPaymentStatus,
  asTrimmedString,
  asYear,
} from "@/lib/validators"

type PaymentStatusBody = {
  employeeId?: unknown
  month?: unknown
  year?: unknown
  paymentStatus?: unknown
}

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollManage,
  },
  async (req, _context, access) => {
    const now = new Date()
    const body = await readJsonBody<PaymentStatusBody>(req)

    return jsonResponse(
      await updatePayrollPaymentStatus({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        employeeId: asTrimmedString(body.employeeId, "employeeId"),
        month: asMonth(body.month, now.getMonth() + 1),
        year: asYear(body.year, now.getFullYear()),
        paymentStatus: asPaymentStatus(body.paymentStatus),
      }),
    )
  },
)
