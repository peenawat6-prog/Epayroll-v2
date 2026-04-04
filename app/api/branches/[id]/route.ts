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

type BranchUpdateBody = {
  name?: unknown
  latitude?: unknown
  longitude?: unknown
  allowedRadiusMeters?: unknown
}

export const PATCH = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (req, context: { params: Promise<{ id: string }> }, access) => {
    const { id } = await context.params
    const body = await readJsonBody<BranchUpdateBody>(req)

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: access.user.tenantId,
      },
    })

    if (!branch) {
      throw new AppError("ไม่พบสาขานี้", 404, "NOT_FOUND")
    }

    const name =
      body.name === undefined ? branch.name : asTrimmedString(body.name, "name")
    const latitude =
      body.latitude === undefined
        ? branch.latitude
        : asOptionalLatitude(body.latitude)
    const longitude =
      body.longitude === undefined
        ? branch.longitude
        : asOptionalLongitude(body.longitude)
    const allowedRadiusMeters =
      body.allowedRadiusMeters === undefined
        ? branch.allowedRadiusMeters
        : body.allowedRadiusMeters === null || body.allowedRadiusMeters === ""
          ? null
          : asMeterRadius(body.allowedRadiusMeters)

    if ((latitude === null) !== (longitude === null)) {
      throw new AppError(
        "กรุณากรอกละติจูดและลองจิจูดของสาขาให้ครบทั้งคู่",
        400,
        "INVALID_INPUT",
      )
    }

    const duplicateBranch = await prisma.branch.findFirst({
      where: {
        tenantId: access.user.tenantId,
        name,
        id: {
          not: branch.id,
        },
      },
      select: {
        id: true,
      },
    })

    if (duplicateBranch) {
      throw new AppError("มีสาขาชื่อนี้อยู่แล้ว", 409, "BRANCH_EXISTS")
    }

    const updatedBranch = await prisma.branch.update({
      where: {
        id: branch.id,
      },
      data: {
        name,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "branch.updated",
      entityType: "Branch",
      entityId: updatedBranch.id,
      metadata: {
        name: updatedBranch.name,
        latitude: updatedBranch.latitude,
        longitude: updatedBranch.longitude,
        allowedRadiusMeters: updatedBranch.allowedRadiusMeters,
      },
    })

    return jsonResponse(updatedBranch)
  },
)
