ALTER TABLE "Tenant"
ADD COLUMN "workStartMinutes" INTEGER NOT NULL DEFAULT 540,
ADD COLUMN "workEndMinutes" INTEGER NOT NULL DEFAULT 1080;

CREATE TABLE "EarlyCheckoutRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "workDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "reviewNote" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "EarlyCheckoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EarlyCheckoutRequest_tenantId_status_createdAt_idx" ON "EarlyCheckoutRequest"("tenantId", "status", "createdAt");
CREATE INDEX "EarlyCheckoutRequest_employeeId_status_workDate_idx" ON "EarlyCheckoutRequest"("employeeId", "status", "workDate");

ALTER TABLE "EarlyCheckoutRequest"
ADD CONSTRAINT "EarlyCheckoutRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EarlyCheckoutRequest"
ADD CONSTRAINT "EarlyCheckoutRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
