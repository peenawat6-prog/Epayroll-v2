import bcrypt from "bcrypt"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash("@Epayroll2026", 10)

  const tenant = await prisma.tenant.upsert({
    where: {
      id: "demo-tenant",
    },
    update: {
      name: "ร้านกาแฟของฉัน",
      registrationCode: "DEMO-CAFE",
      subscriptionPlan: "starter",
      subscriptionStatus: "TRIAL",
      subscriptionExpiresAt: new Date("2026-12-31T23:59:59.000+07:00"),
      payrollPayday: 31,
      workStartMinutes: 540,
      workEndMinutes: 1080,
      latitude: 13.7563,
      longitude: 100.5018,
      allowedRadiusMeters: 150,
    },
    create: {
      id: "demo-tenant",
      name: "ร้านกาแฟของฉัน",
      registrationCode: "DEMO-CAFE",
      subscriptionPlan: "starter",
      subscriptionStatus: "TRIAL",
      subscriptionExpiresAt: new Date("2026-12-31T23:59:59.000+07:00"),
      payrollPayday: 31,
      workStartMinutes: 540,
      workEndMinutes: 1080,
      latitude: 13.7563,
      longitude: 100.5018,
      allowedRadiusMeters: 150,
    },
  })

  const branch = await prisma.branch.upsert({
    where: {
      id: "demo-branch-main",
    },
    update: {
      tenantId: tenant.id,
      name: "สาขาหลัก",
      latitude: 13.7563,
      longitude: 100.5018,
      allowedRadiusMeters: 120,
    },
    create: {
      id: "demo-branch-main",
      tenantId: tenant.id,
      name: "สาขาหลัก",
      latitude: 13.7563,
      longitude: 100.5018,
      allowedRadiusMeters: 120,
    },
  })

  await prisma.user.upsert({
    where: {
      email: "owner@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "OWNER",
    },
    create: {
      tenantId: tenant.id,
      email: "owner@demo.local",
      passwordHash,
      role: "OWNER",
    },
  })

  await prisma.user.upsert({
    where: {
      email: "owner2@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "OWNER",
    },
    create: {
      tenantId: tenant.id,
      email: "owner2@demo.local",
      passwordHash,
      role: "OWNER",
    },
  })

  await prisma.user.upsert({
    where: {
      email: "hr@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "HR",
    },
    create: {
      tenantId: tenant.id,
      email: "hr@demo.local",
      passwordHash,
      role: "HR",
    },
  })

  await prisma.user.upsert({
    where: {
      email: "admin@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      tenantId: tenant.id,
      email: "admin@demo.local",
      passwordHash,
      role: "ADMIN",
    },
  })

  await prisma.user.upsert({
    where: {
      email: "finance@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "FINANCE",
    },
    create: {
      tenantId: tenant.id,
      email: "finance@demo.local",
      passwordHash,
      role: "FINANCE",
    },
  })

  await prisma.user.upsert({
    where: {
      email: "dev@epayroll.cloud",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "DEV",
    },
    create: {
      tenantId: tenant.id,
      email: "dev@epayroll.cloud",
      passwordHash,
      role: "DEV",
    },
  })

  await prisma.user.deleteMany({
    where: {
      email: "dev@demo.local",
      role: "DEV",
    },
  })

  const employeeUser = await prisma.user.upsert({
    where: {
      email: "employee@demo.local",
    },
    update: {
      tenantId: tenant.id,
      passwordHash,
      role: "EMPLOYEE",
    },
    create: {
      tenantId: tenant.id,
      email: "employee@demo.local",
      passwordHash,
      role: "EMPLOYEE",
    },
  })

  await prisma.employee.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "EMP001",
      },
    },
    update: {
      userId: employeeUser.id,
      branchId: branch.id,
      firstName: "พนักงาน",
      lastName: "ตัวอย่าง",
      position: "Barista",
      employeeType: "FULL_TIME",
      payType: "MONTHLY",
      baseSalary: 15000,
      dailyRate: 500,
      hourlyRate: 65,
      active: true,
      startDate: new Date("2026-01-01T09:00:00.000+07:00"),
      terminatedAt: null,
    },
    create: {
      tenantId: tenant.id,
      userId: employeeUser.id,
      branchId: branch.id,
      code: "EMP001",
      firstName: "พนักงาน",
      lastName: "ตัวอย่าง",
      position: "Barista",
      employeeType: "FULL_TIME",
      payType: "MONTHLY",
      baseSalary: 15000,
      dailyRate: 500,
      hourlyRate: 65,
      active: true,
      startDate: new Date("2026-01-01T09:00:00.000+07:00"),
    },
  })

  const employee = await prisma.employee.findUnique({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "EMP001",
      },
    },
  })

  if (employee) {
    await prisma.bankAccount.upsert({
      where: {
        employeeId: employee.id,
      },
      update: {
        bankName: "SCB",
        accountName: "พนักงาน ตัวอย่าง",
        accountNumber: "123-456-7890",
        promptPayId: "0812345678",
      },
      create: {
        employeeId: employee.id,
        bankName: "SCB",
        accountName: "พนักงาน ตัวอย่าง",
        accountNumber: "123-456-7890",
        promptPayId: "0812345678",
      },
    })
  }

  console.log("Seed done")
  console.log("Login email: owner@demo.local")
  console.log("Second owner login email: owner2@demo.local")
  console.log("Admin login email: admin@demo.local")
  console.log("HR login email: hr@demo.local")
  console.log("Finance login email: finance@demo.local")
  console.log("Dev login email: dev@epayroll.cloud")
  console.log("Employee login email: employee@demo.local")
  console.log("Login password: @Epayroll2026")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
