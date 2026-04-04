CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "requestedCheckIn" TIMESTAMP(3),
    "requestedCheckOut" TIMESTAMP(3),
    "requestedStatus" "AttendanceStatus",
    "requestedWorkDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "reviewNote" TEXT,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceCorrection_tenantId_status_createdAt_idx" ON "AttendanceCorrection"("tenantId", "status", "createdAt");
CREATE INDEX "AttendanceCorrection_attendanceId_status_idx" ON "AttendanceCorrection"("attendanceId", "status");

ALTER TABLE "AttendanceCorrection"
ADD CONSTRAINT "AttendanceCorrection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceCorrection"
ADD CONSTRAINT "AttendanceCorrection_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
