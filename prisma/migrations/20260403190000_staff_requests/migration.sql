ALTER TABLE "Leave"
ADD COLUMN "tenantId" TEXT,
ADD COLUMN "requestedByUserId" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "reviewedAt" TIMESTAMP(3);

UPDATE "Leave"
SET "tenantId" = "Employee"."tenantId"
FROM "Employee"
WHERE "Leave"."employeeId" = "Employee"."id";

ALTER TABLE "Leave"
ALTER COLUMN "tenantId" SET NOT NULL;

CREATE TABLE "OvertimeRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "workDate" TIMESTAMP(3) NOT NULL,
  "overtimeMinutes" INTEGER NOT NULL,
  "reason" TEXT,
  "reviewNote" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResignationRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "lastWorkDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "reviewNote" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ResignationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Leave_tenantId_status_createdAt_idx" ON "Leave"("tenantId", "status", "createdAt");
CREATE INDEX "Leave_employeeId_status_startDate_idx" ON "Leave"("employeeId", "status", "startDate");
CREATE INDEX "OvertimeRequest_tenantId_status_createdAt_idx" ON "OvertimeRequest"("tenantId", "status", "createdAt");
CREATE INDEX "OvertimeRequest_employeeId_status_workDate_idx" ON "OvertimeRequest"("employeeId", "status", "workDate");
CREATE INDEX "ResignationRequest_tenantId_status_createdAt_idx" ON "ResignationRequest"("tenantId", "status", "createdAt");
CREATE INDEX "ResignationRequest_employeeId_status_lastWorkDate_idx" ON "ResignationRequest"("employeeId", "status", "lastWorkDate");

ALTER TABLE "Leave"
ADD CONSTRAINT "Leave_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OvertimeRequest"
ADD CONSTRAINT "OvertimeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OvertimeRequest"
ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResignationRequest"
ADD CONSTRAINT "ResignationRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResignationRequest"
ADD CONSTRAINT "ResignationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
