import { prisma } from "@/lib/prisma"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { asTrimmedString } from "@/lib/validators"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const registrationCode = asTrimmedString(
      searchParams.get("registrationCode"),
      "registrationCode",
    )

    const tenant = await prisma.tenant.findUnique({
      where: {
        registrationCode,
      },
      select: {
        id: true,
        name: true,
        branches: {
          orderBy: {
            name: "asc",
          },
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!tenant) {
      throw new AppError("รหัสร้านไม่ถูกต้อง", 404, "TENANT_NOT_FOUND")
    }

    return jsonResponse({
      tenantName: tenant.name,
      branches: tenant.branches,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
