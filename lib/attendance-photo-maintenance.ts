import { prisma } from "@/lib/prisma"
import {
  deleteStoredCheckInPhoto,
  getCheckInPhotoStorageRoot,
  storedCheckInPhotoExists,
} from "@/lib/check-in-photo-storage"
import { logServerEvent } from "@/lib/observability"

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

declare global {
  var attendancePhotoCleanupScheduled: boolean | undefined
}

function getCleanupCutoffDate() {
  const now = new Date()

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, -7, 0, 0, 0),
  )
}

export async function purgeOldAttendancePhotos() {
  const cutoffDate = getCleanupCutoffDate()

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
    await deleteStoredCheckInPhoto({
      tenantId: attendance.employee.tenantId,
      employeeId: attendance.employeeId,
      attendanceId: attendance.id,
    })
  }

  const updated = await prisma.attendance.updateMany({
    where: {
      id: {
        in: attendances.map((attendance) => attendance.id),
      },
    },
    data: {
      checkInPhotoUrl: null,
    },
  })

  return {
    cutoffDate,
    deletedCount: updated.count,
  }
}

export async function getAttendancePhotoStorageHealth(tenantId: string) {
  const attendances = await prisma.attendance.findMany({
    where: {
      checkInPhotoUrl: {
        not: null,
      },
      employee: {
        tenantId,
      },
    },
    select: {
      id: true,
      employeeId: true,
    },
    orderBy: {
      workDate: "desc",
    },
    take: 500,
  })

  let missingPhotoFiles = 0

  for (const attendance of attendances) {
    const exists = await storedCheckInPhotoExists({
      tenantId,
      employeeId: attendance.employeeId,
      attendanceId: attendance.id,
    })

    if (!exists) {
      missingPhotoFiles += 1
    }
  }

  return {
    storageRoot: getCheckInPhotoStorageRoot(),
    checkedPhotoRecords: attendances.length,
    missingPhotoFiles,
  }
}

export function scheduleAttendancePhotoCleanup() {
  if (globalThis.attendancePhotoCleanupScheduled) {
    return
  }

  globalThis.attendancePhotoCleanupScheduled = true

  const runCleanup = async () => {
    try {
      const result = await purgeOldAttendancePhotos()

      logServerEvent("info", {
        event: "attendance_photo.cleanup_completed",
        metadata: {
          cutoffDate: result.cutoffDate.toISOString(),
          deletedCount: result.deletedCount,
          storageRoot: getCheckInPhotoStorageRoot(),
        },
      })
    } catch (error) {
      logServerEvent("error", {
        event: "attendance_photo.cleanup_failed",
        metadata: {
          message: error instanceof Error ? error.message : "unknown error",
        },
      })
    }
  }

  void runCleanup()
  setInterval(() => {
    void runCleanup()
  }, CLEANUP_INTERVAL_MS)
}
