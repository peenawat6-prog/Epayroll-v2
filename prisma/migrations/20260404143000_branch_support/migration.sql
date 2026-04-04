ALTER TABLE "EmployeeRegistrationRequest"
ADD COLUMN "branchId" TEXT;

CREATE INDEX "EmployeeRegistrationRequest_branchId_idx"
ON "EmployeeRegistrationRequest"("branchId");

ALTER TABLE "EmployeeRegistrationRequest"
ADD CONSTRAINT "EmployeeRegistrationRequest_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
