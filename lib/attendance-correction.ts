import type { AttendanceCorrectionStatus, AttendanceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { calculateAttendanceMetrics } from "@/lib/attendance"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"

export async function getAttendanceCorrectionList(
  tenantId: string,
  filters?: {
    status?: AttendanceCorrectionStatus
    search?: string
  },
) {
  return prisma.attendanceCorrection.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              {
                reason: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                attendance: {
                  employee: {
                    code: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                attendance: {
                  employee: {
                    firstName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                attendance: {
                  employee: {
                    lastName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      attendance: {
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  })
}

export async function createAttendanceCorrection(params: {
  tenantId: string
  attendanceId: string
  requestedByUserId: string
  reason: string
  requestedCheckIn?: Date | null
  requestedCheckOut?: Date | null
  requestedStatus?: AttendanceStatus | null
  requestedWorkDate?: Date | null
}) {
  const attendance = await prisma.attendance.findFirst({
    where: {
      id: params.attendanceId,
      employee: {
        tenantId: params.tenantId,
      },
    },
  })

  if (!attendance) {
    throw new AppError("Attendance record not found", 404, "NOT_FOUND")
  }

  const existingPending = await prisma.attendanceCorrection.findFirst({
    where: {
      tenantId: params.tenantId,
      attendanceId: params.attendanceId,
      status: "PENDING",
    },
  })

  if (existingPending) {
    throw new AppError(
      "This attendance record already has a pending correction request",
      409,
      "CORRECTION_ALREADY_PENDING",
    )
  }

  return prisma.$transaction(async (tx) => {
    const correction = await tx.attendanceCorrection.create({
      data: {
        tenantId: params.tenantId,
        attendanceId: params.attendanceId,
        requestedByUserId: params.requestedByUserId,
        requestedCheckIn: params.requestedCheckIn ?? attendance.checkIn,
        requestedCheckOut: params.requestedCheckOut ?? attendance.checkOut,
        requestedStatus: params.requestedStatus ?? null,
        requestedWorkDate: params.requestedWorkDate ?? attendance.workDate,
        reason: params.reason,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.requestedByUserId,
        action: "attendance.correction_requested",
        entityType: "AttendanceCorrection",
        entityId: correction.id,
        metadata: {
          attendanceId: params.attendanceId,
          requestedStatus: params.requestedStatus ?? null,
        },
      },
    })

    return correction
  })
}

export async function reviewAttendanceCorrection(params: {
  tenantId: string
  correctionId: string
  reviewedByUserId: string
  decision: AttendanceCorrectionStatus
  reviewNote?: string | null
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid correction decision", 400, "INVALID_INPUT")
  }

  const correction = await prisma.attendanceCorrection.findFirst({
    where: {
      id: params.correctionId,
      tenantId: params.tenantId,
    },
    include: {
      attendance: true,
    },
  })

  if (!correction) {
    throw new AppError("Correction request not found", 404, "NOT_FOUND")
  }

  if (correction.status !== "PENDING") {
    throw new AppError(
      "Correction request has already been reviewed",
      409,
      "CORRECTION_ALREADY_REVIEWED",
    )
  }

  if (params.decision === "REJECTED") {
    if (!params.reviewNote) {
      throw new AppError(
        "Review note is required when rejecting a correction",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    return prisma.$transaction(async (tx) => {
      const reviewed = await tx.attendanceCorrection.update({
        where: {
          id: correction.id,
        },
        data: {
          status: "REJECTED",
          reviewedByUserId: params.reviewedByUserId,
          reviewedAt: new Date(),
          reviewNote: params.reviewNote ?? null,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.reviewedByUserId,
          action: "attendance.correction_rejected",
          entityType: "AttendanceCorrection",
          entityId: reviewed.id,
          metadata: {
            attendanceId: reviewed.attendanceId,
          },
        },
      })

      return reviewed
    })
  }

  const nextWorkDate = correction.requestedWorkDate ?? correction.attendance.workDate
  await assertPayrollPeriodOpenForDate(params.tenantId, nextWorkDate)

  const nextCheckIn = correction.requestedCheckIn ?? correction.attendance.checkIn
  const nextCheckOut = correction.requestedCheckOut ?? correction.attendance.checkOut
  const requestedStatusChanged =
    correction.requestedStatus !== null &&
    correction.requestedStatus !== correction.attendance.status
  const normalizedStatus =
    !requestedStatusChanged && nextCheckIn
      ? "PRESENT"
      : correction.requestedStatus ?? correction.attendance.status
  const metrics = calculateAttendanceMetrics({
    checkIn: nextCheckIn,
    checkOut: nextCheckOut,
    status: normalizedStatus,
  })

  return prisma.$transaction(async (tx) => {
    const updatedAttendance = await tx.attendance.update({
      where: {
        id: correction.attendanceId,
      },
      data: {
        workDate: nextWorkDate,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        workedMinutes: metrics.workedMinutes,
        lateMinutes: metrics.lateMinutes,
        status: metrics.status,
      },
    })

    const reviewed = await tx.attendanceCorrection.update({
      where: {
        id: correction.id,
      },
      data: {
        status: "APPROVED",
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNote: params.reviewNote ?? null,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.reviewedByUserId,
        action: "attendance.correction_approved",
        entityType: "AttendanceCorrection",
        entityId: reviewed.id,
        metadata: {
          attendanceId: reviewed.attendanceId,
          updatedAttendanceId: updatedAttendance.id,
          workDate: updatedAttendance.workDate,
          status: updatedAttendance.status,
        },
      },
    })

    return reviewed
  })
}
