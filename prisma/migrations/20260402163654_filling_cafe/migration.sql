-- AlterTable
ALTER TABLE "Payroll" ALTER COLUMN "payTypeSnapshot" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "updatedAt" DROP DEFAULT;
