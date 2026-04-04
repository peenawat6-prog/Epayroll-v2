import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { readStoredCheckInPhoto } from "@/lib/check-in-photo-storage"

export const runtime = "nodejs"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceView,
  },
  async (_req, context: { params: Promise<{ id: string }> }, access) => {
    const { id } = await context.params

    const attendance = await prisma.attendance.findFirst({
      where: {
        id,
        employee: {
          tenantId: access.user.tenantId,
        },
      },
      select: {
        id: true,
        employeeId: true,
      },
    })

    if (!attendance) {
      throw new AppError("ไม่พบรูปเช็กอิน", 404, "ATTENDANCE_PHOTO_NOT_FOUND")
    }

    const { mimeType, photoBuffer } = await readStoredCheckInPhoto({
      tenantId: access.user.tenantId,
      employeeId: attendance.employeeId,
      attendanceId: attendance.id,
    })

    return new Response(new Uint8Array(photoBuffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    })
  },
)
