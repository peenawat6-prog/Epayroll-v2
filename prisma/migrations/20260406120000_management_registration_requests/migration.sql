CREATE TYPE "ManagementRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ManagementRegistrationRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "requestedRole" "UserRole" NOT NULL,
    "status" "ManagementRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementRegistrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagementRegistrationRequest_tenantId_status_createdAt_idx" ON "ManagementRegistrationRequest"("tenantId", "status", "createdAt");
CREATE INDEX "ManagementRegistrationRequest_tenantId_email_idx" ON "ManagementRegistrationRequest"("tenantId", "email");
CREATE INDEX "ManagementRegistrationRequest_status_createdAt_idx" ON "ManagementRegistrationRequest"("status", "createdAt");

ALTER TABLE "ManagementRegistrationRequest"
ADD CONSTRAINT "ManagementRegistrationRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
