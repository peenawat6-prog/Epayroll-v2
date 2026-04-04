import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  asMeterRadius,
  asOptionalLatitude,
  asOptionalLongitude,
  asTrimmedString,
} from "@/lib/validators"

type BranchCreateBody = {
  name?: unknown
  latitude?: unknown
  longitude?: unknown
  allowedRadiusMeters?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.employeeRead,
  },
  async (_req, _context, access) => {
    const branches = await prisma.branch.findMany({
      where: {
        tenantId: access.user.tenantId,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    })

    return jsonResponse({
      items: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        latitude: branch.latitude,
        longitude: branch.longitude,
        allowedRadiusMeters: branch.allowedRadiusMeters,
        employeeCount: branch._count.employees,
      })),
    })
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (req, _context, access) => {
    const body = await readJsonBody<BranchCreateBody>(req)
    const name = asTrimmedString(body.name, "name")
    const latitude = asOptionalLatitude(body.latitude)
    const longitude = asOptionalLongitude(body.longitude)
    const allowedRadiusMeters =
      body.allowedRadiusMeters === undefined ||
      body.allowedRadiusMeters === null ||
      body.allowedRadiusMeters === ""
        ? null
        : asMeterRadius(body.allowedRadiusMeters)

    if ((latitude === null) !== (longitude === null)) {
      throw new AppError(
        "กรุณากรอกละติจูดและลองจิจูดของสาขาให้ครบทั้งคู่",
        400,
        "INVALID_INPUT",
      )
    }

    const existingBranch = await prisma.branch.findFirst({
      where: {
        tenantId: access.user.tenantId,
        name,
      },
      select: {
        id: true,
      },
    })

    if (existingBranch) {
      throw new AppError("มีสาขาชื่อนี้อยู่แล้ว", 409, "BRANCH_EXISTS")
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId: access.user.tenantId,
        name,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: {
        name: branch.name,
        latitude: branch.latitude,
        longitude: branch.longitude,
        allowedRadiusMeters: branch.allowedRadiusMeters,
      },
    })

    return jsonResponse(branch, 201)
  },
)
