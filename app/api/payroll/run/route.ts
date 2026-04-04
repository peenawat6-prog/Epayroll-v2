import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { getPayrollResult, savePayrollPeriod, unlockPayrollPeriod } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { hasAnyRole } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { asAction, asMonth, asOptionalTrimmedString, asYear } from "@/lib/validators"

type PayrollRunBody = {
  month?: unknown
  year?: unknown
  action?: unknown
  reason?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const month = asMonth(searchParams.get("month"), now.getMonth() + 1)
    const year = asYear(searchParams.get("year"), now.getFullYear())

    return jsonResponse(await getPayrollResult(access.user.tenantId, month, year))
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollManage,
  },
  async (req, _context, access) => {
    const now = new Date()
    const body = await readJsonBody<PayrollRunBody>(req)
    const month = asMonth(body.month, now.getMonth() + 1)
    const year = asYear(body.year, now.getFullYear())
    const action = asAction(body.action, ["save", "lock", "unlock"]) as
      | "save"
      | "lock"
      | "unlock"

    if (action === "unlock") {
      if (!hasAnyRole(access.user.role, ROLE_GROUPS.payrollUnlock)) {
        throw new AppError("Forbidden", 403, "FORBIDDEN")
      }

      const reason = asOptionalTrimmedString(body.reason)

      if (!reason) {
        throw new AppError(
          "Unlock reason is required",
          400,
          "UNLOCK_REASON_REQUIRED",
        )
      }

      return jsonResponse(
        await unlockPayrollPeriod({
          tenantId: access.user.tenantId,
          userId: access.user.id,
          month,
          year,
          reason,
        }),
      )
    }

    return jsonResponse(
      await savePayrollPeriod({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        month,
        year,
        action,
      }),
    )
  },
)
