import { prisma } from "@/lib/prisma"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { asTrimmedString } from "@/lib/validators"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const name = asTrimmedString(searchParams.get("name"), "name")

    if (name.length < 2) {
      throw new AppError("กรุณาพิมพ์ชื่อร้านอย่างน้อย 2 ตัวอักษร", 400, "INVALID_INPUT")
    }

    const shops = await prisma.tenant.findMany({
      where: {
        name: {
          contains: name,
          mode: "insensitive",
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 10,
      select: {
        id: true,
        name: true,
        registrationCode: true,
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

    return jsonResponse({
      items: shops,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
