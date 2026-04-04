CREATE TYPE "SalesAgentRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "ShopRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "SalesAgent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "lineId" TEXT,
    "commissionPerShopBaht" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesAgentRegistrationRequest" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "lineId" TEXT,
    "status" "SalesAgentRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesAgentRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopRegistrationRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "shopName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "ownerFirstName" TEXT NOT NULL,
    "ownerLastName" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT NOT NULL,
    "ownerPasswordHash" TEXT NOT NULL,
    "registrationCode" TEXT,
    "payrollPayday" INTEGER NOT NULL,
    "morningShiftStartMinutes" INTEGER NOT NULL,
    "morningShiftEndMinutes" INTEGER NOT NULL,
    "afternoonShiftStartMinutes" INTEGER NOT NULL,
    "afternoonShiftEndMinutes" INTEGER NOT NULL,
    "nightShiftStartMinutes" INTEGER NOT NULL,
    "nightShiftEndMinutes" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "allowedRadiusMeters" INTEGER NOT NULL,
    "requestedSubscriptionDays" INTEGER NOT NULL DEFAULT 365,
    "salesAgentId" TEXT,
    "status" "ShopRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopRegistrationRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tenant"
ADD COLUMN "salesAgentId" TEXT;

ALTER TABLE "Employee"
ADD COLUMN "dayOffWeekdays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "EmployeeRegistrationRequest"
ADD COLUMN "dayOffWeekdays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE UNIQUE INDEX "SalesAgent_code_key" ON "SalesAgent"("code");
CREATE UNIQUE INDEX "SalesAgent_email_key" ON "SalesAgent"("email");
CREATE INDEX "SalesAgent_active_createdAt_idx" ON "SalesAgent"("active", "createdAt");
CREATE INDEX "SalesAgentRegistrationRequest_status_createdAt_idx"
ON "SalesAgentRegistrationRequest"("status", "createdAt");
CREATE INDEX "SalesAgentRegistrationRequest_email_idx"
ON "SalesAgentRegistrationRequest"("email");
CREATE INDEX "ShopRegistrationRequest_status_createdAt_idx"
ON "ShopRegistrationRequest"("status", "createdAt");
CREATE INDEX "ShopRegistrationRequest_ownerEmail_idx"
ON "ShopRegistrationRequest"("ownerEmail");
CREATE INDEX "Tenant_salesAgentId_idx" ON "Tenant"("salesAgentId");
CREATE INDEX "ShopRegistrationRequest_salesAgentId_idx"
ON "ShopRegistrationRequest"("salesAgentId");

ALTER TABLE "Tenant"
ADD CONSTRAINT "Tenant_salesAgentId_fkey"
FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopRegistrationRequest"
ADD CONSTRAINT "ShopRegistrationRequest_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShopRegistrationRequest"
ADD CONSTRAINT "ShopRegistrationRequest_salesAgentId_fkey"
FOREIGN KEY ("salesAgentId") REFERENCES "SalesAgent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
