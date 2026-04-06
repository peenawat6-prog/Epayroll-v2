import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({
  log: ["error", "warn"],
})

async function main() {
  const corrections = await prisma.attendanceCorrection.findMany({
    where: {
      status: "APPROVED",
      attendance: {
        status: "LATE",
        checkIn: {
          not: null,
        },
      },
      OR: [
        {
          requestedStatus: null,
        },
        {
          requestedStatus: "PRESENT",
        },
        {
          requestedStatus: "LATE",
        },
      ],
    },
    include: {
      attendance: true,
    },
  })

  let updatedCount = 0

  for (const correction of corrections) {
    const nextCheckIn = correction.requestedCheckIn ?? correction.attendance.checkIn
    const nextCheckOut =
      correction.requestedCheckOut ?? correction.attendance.checkOut
    const nextWorkDate =
      correction.requestedWorkDate ?? correction.attendance.workDate

    if (!nextCheckIn) {
      continue
    }

    const workedMinutes =
      nextCheckIn && nextCheckOut
        ? Math.max(
            0,
            Math.round(
              (nextCheckOut.getTime() - nextCheckIn.getTime()) / 60000,
            ),
          )
        : 0

    await prisma.attendance.update({
      where: {
        id: correction.attendanceId,
      },
      data: {
        workDate: nextWorkDate,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        workedMinutes,
        lateMinutes: 0,
        status: "PRESENT",
      },
    })

    updatedCount += 1
  }

  console.log(
    JSON.stringify({
      scanned: corrections.length,
      updated: updatedCount,
    }),
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
