import fs from "node:fs"
import path from "node:path"
import { purgeOldAttendancePhotos } from "@/lib/attendance-photo-maintenance"
import { validateServerEnv } from "@/lib/env"
import { prisma } from "@/lib/prisma"

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
  validateServerEnv()

  const result = await purgeOldAttendancePhotos()
  console.log(
    `Purged ${result.deletedCount} old attendance photos before ${result.cutoffDate.toISOString()}`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
