CREATE TYPE "EmployeeRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Tenant" ADD COLUMN "registrationCode" TEXT;

UPDATE "Tenant"
SET "registrationCode" = COALESCE("registrationCode", 'SHOP-' || "id");

ALTER TABLE "Tenant" ALTER COLUMN "registrationCode" SET NOT NULL;

CREATE UNIQUE INDEX "Tenant_registrationCode_key" ON "Tenant"("registrationCode");

CREATE TABLE "EmployeeRegistrationRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT,
  "position" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "employeeType" "EmployeeType" NOT NULL,
  "payType" "PayType" NOT NULL,
  "status" "EmployeeRegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeRegistrationRequest_tenantId_status_createdAt_idx"
ON "EmployeeRegistrationRequest"("tenantId", "status", "createdAt");

CREATE INDEX "EmployeeRegistrationRequest_tenantId_code_idx"
ON "EmployeeRegistrationRequest"("tenantId", "code");

CREATE INDEX "EmployeeRegistrationRequest_tenantId_email_idx"
ON "EmployeeRegistrationRequest"("tenantId", "email");

ALTER TABLE "EmployeeRegistrationRequest"
ADD CONSTRAINT "EmployeeRegistrationRequest_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
