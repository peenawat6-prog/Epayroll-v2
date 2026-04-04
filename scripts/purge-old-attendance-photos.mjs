import fs from "node:fs"
import { rm } from "node:fs/promises"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const envFilePath = path.resolve(process.cwd(), ".env")

if (fs.existsSync(envFilePath)) {
  const envFile = fs.readFileSync(envFilePath, "utf8")

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL")
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const now = new Date()
  const cutoffDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, -7, 0, 0, 0),
  )
  const photoRoot = path.resolve(
    process.cwd(),
    process.env.ATTENDANCE_PHOTO_STORAGE_DIR || "storage/check-in-photos",
  )

  try {
    const attendances = await prisma.attendance.findMany({
      where: {
        checkInPhotoUrl: {
          not: null,
        },
        workDate: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        employeeId: true,
        employee: {
          select: {
            tenantId: true,
          },
        },
      },
    })

    for (const attendance of attendances) {
      const photoPath = path.join(
        photoRoot,
        attendance.employee.tenantId,
        attendance.employeeId,
        `${attendance.id}.jpg`,
      )

      await rm(photoPath, { force: true })
    }

    const result = await prisma.attendance.updateMany({
      where: {
        id: {
          in: attendances.map((attendance) => attendance.id),
        },
      },
      data: {
        checkInPhotoUrl: null,
      },
    })

    console.log(
      `Purged ${result.count} old attendance photos before ${cutoffDate.toISOString()}`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
