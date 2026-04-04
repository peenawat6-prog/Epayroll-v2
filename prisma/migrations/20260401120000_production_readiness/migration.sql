-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED');

-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "terminatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Attendance"
ADD COLUMN "workedMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lateMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "Branch"("tenantId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_active_idx" ON "Employee"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Attendance_workDate_idx" ON "Attendance"("workDate");
