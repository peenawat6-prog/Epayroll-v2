# Full File Export

สร้างจากเวอร์ชันล่าสุดใน workspace เพื่อใช้ handoff หรือส่งตรวจต่อ

Generated at: 2026-04-02T21:13:27

## prisma.config.ts

```ts
import "dotenv/config"
import { defineConfig, env } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
})
```

## prisma\schema.prisma

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "binary"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// =========================
/// ENUMS
/// =========================

enum UserRole {
  OWNER
  ADMIN
  HR
  FINANCE
  EMPLOYEE
}

enum EmployeeType {
  FULL_TIME
  PART_TIME
}

enum PayType {
  MONTHLY
  DAILY
  HOURLY
}

enum AttendanceStatus {
  PRESENT
  LATE
  ABSENT
  LEAVE
  DAY_OFF
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PAID
}

enum ReceiptStatus {
  ISSUED
  VOID
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  EXPIRED
}

enum PayrollPeriodStatus {
  OPEN
  LOCKED
}

enum AttendanceCorrectionStatus {
  PENDING
  APPROVED
  REJECTED
}

/// =========================
/// CORE
/// =========================

model Tenant {
  id                    String             @id @default(cuid())
  name                  String
  subscriptionPlan      String             @default("starter")
  subscriptionStatus    SubscriptionStatus @default(TRIAL)
  subscriptionExpiresAt DateTime?
  payrollPayday         Int                @default(31)
  latitude              Float?
  longitude             Float?
  allowedRadiusMeters   Int                @default(150)
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  users                 User[]
  employees             Employee[]
  branches              Branch[]
  invoices              Invoice[]
  receipts              Receipt[]
  payrollPeriods        PayrollPeriod[]
  auditLogs             AuditLog[]
  attendanceCorrections AttendanceCorrection[]
}

model User {
  id           String   @id @default(cuid())
  tenantId     String
  email        String   @unique
  passwordHash String
  role         UserRole
  createdAt    DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}

model Branch {
  id                  String  @id @default(cuid())
  tenantId            String
  name                String
  latitude            Float?
  longitude           Float?
  allowedRadiusMeters Int?

  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  employees Employee[]

  @@index([tenantId])
}

/// =========================
/// EMPLOYEE
/// =========================

model Employee {
  id           String       @id @default(cuid())
  tenantId     String
  branchId     String?
  code         String
  firstName    String
  lastName     String
  phone        String?
  position     String
  employeeType EmployeeType
  payType      PayType

  baseSalary Float?
  dailyRate  Float?
  hourlyRate Float?

  active       Boolean  @default(true)
  startDate    DateTime
  terminatedAt DateTime?
  createdAt    DateTime @default(now())

  tenant Tenant  @relation(fields: [tenantId], references: [id])
  branch Branch? @relation(fields: [branchId], references: [id])

  attendances Attendance[]
  leaves      Leave[]
  payrolls    Payroll[]
  bank        BankAccount?

  @@unique([tenantId, code])
  @@index([tenantId, active])
}

model BankAccount {
  id            String  @id @default(cuid())
  employeeId    String  @unique
  bankName      String
  accountName   String
  accountNumber String
  promptPayId   String?

  employee Employee @relation(fields: [employeeId], references: [id])
}

/// =========================
/// ATTENDANCE
/// =========================

model Attendance {
  id                    String           @id @default(cuid())
  employeeId            String
  workDate              DateTime
  checkIn               DateTime?
  checkOut              DateTime?
  workedMinutes         Int              @default(0)
  lateMinutes           Int              @default(0)
  status                AttendanceStatus
  checkInPhotoUrl       String?
  checkInLatitude       Float?
  checkInLongitude      Float?
  checkInDistanceMeters Int?

  employee    Employee               @relation(fields: [employeeId], references: [id])
  corrections AttendanceCorrection[]

  @@unique([employeeId, workDate])
  @@index([workDate])
}

model AttendanceCorrection {
  id                String                     @id @default(cuid())
  tenantId          String
  attendanceId      String
  requestedByUserId String
  reviewedByUserId  String?
  requestedCheckIn  DateTime?
  requestedCheckOut DateTime?
  requestedStatus   AttendanceStatus?
  requestedWorkDate DateTime?
  reason            String
  reviewNote        String?
  status            AttendanceCorrectionStatus @default(PENDING)
  createdAt         DateTime                   @default(now())
  reviewedAt        DateTime?

  tenant     Tenant     @relation(fields: [tenantId], references: [id])
  attendance Attendance @relation(fields: [attendanceId], references: [id])

  @@index([tenantId, status, createdAt])
  @@index([attendanceId, status])
}

/// =========================
/// LEAVE
/// =========================

model Leave {
  id         String      @id @default(cuid())
  employeeId String
  startDate  DateTime
  endDate    DateTime
  reason     String?
  status     LeaveStatus @default(PENDING)

  employee Employee @relation(fields: [employeeId], references: [id])
}

/// =========================
/// PAYROLL
/// =========================

model Payroll {
  id              String        @id @default(cuid())
  employeeId      String
  month           Int
  year            Int
  payTypeSnapshot PayType
  presentDays     Int           @default(0)
  absentDays      Int           @default(0)
  workedHours     Float         @default(0)
  lateMinutes     Int           @default(0)
  basePay         Float
  overtimePay     Float
  deduction       Float
  netPay          Float
  paymentStatus   PaymentStatus @default(PENDING)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  employee Employee @relation(fields: [employeeId], references: [id])

  @@unique([employeeId, month, year])
}

model PayrollPeriod {
  id             String              @id @default(cuid())
  tenantId       String
  month          Int
  year           Int
  status         PayrollPeriodStatus @default(OPEN)
  lockedAt       DateTime?
  lockedByUserId String?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, month, year])
  @@index([tenantId, status])
}

model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  userId     String?
  action     String
  entityType String
  entityId   String?
  metadata   Json?
  createdAt  DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@index([tenantId, createdAt])
  @@index([tenantId, entityType, entityId])
}

/// =========================
/// BILLING
/// =========================

model Invoice {
  id        String        @id @default(cuid())
  tenantId  String
  amount    Float
  status    InvoiceStatus @default(DRAFT)
  createdAt DateTime      @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
}

model Receipt {
  id        String        @id @default(cuid())
  tenantId  String
  amount    Float
  status    ReceiptStatus @default(ISSUED)
  createdAt DateTime      @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id])
}
```

## prisma\seed.ts

```ts
import bcrypt from "bcrypt"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10)

  const tenant = await prisma.tenant.upsert({
    where: {
      id: "demo-tenant",
    },
    update: {
      name: "ร้านกาแฟของฉัน",
      subscriptionPlan: "starter",
      subscriptionStatus: "TRIAL",
      subscriptionExpiresAt: new Date("2026-12-31T23:59:59.000+07:00"),
      payrollPayday: 31,
      latitude: 13.7563,
      longitude: 100.5018,
      allowedRadiusMeters: 150,
    },
    create: {
      id: "demo-tenant",
      name: "ร้านกาแฟของฉัน",
      subscriptionPlan: "starter",
      subscriptionStatus: "TRIAL",
      subscriptionExpiresAt: new Date("2026-12-31T23:59:59.000+07:00"),
      payrollPayday: 31,
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

  await prisma.employee.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "EMP001",
      },
    },
    update: {
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
  console.log("Login password: demo1234")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

## proxy.ts

```ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = ["/login"]
const PROTECTED_PATHS = ["/dashboard", "/employees", "/attendance", "/payroll", "/audit", "/ops"]

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (token && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/payroll/:path*",
    "/audit/:path*",
    "/ops/:path*",
  ],
}
```

## next.config.ts

```ts
import type { NextConfig } from "next"

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
```

## instrumentation.ts

```ts
import { validateServerEnv } from "@/lib/env"
import { logServerEvent } from "@/lib/observability"

export async function register() {
  validateServerEnv()

  logServerEvent("info", {
    event: "app.startup.validated_env",
    metadata: {
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
  })
}
```

## package.json

```json
{
  "name": "cafe-saas",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "prebuild": "node scripts/validate-env.mjs",
    "prestart": "node scripts/validate-env.mjs",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "verify:env": "node scripts/validate-env.mjs"
  },
  "dependencies": {
    "@prisma/client": "^6.19.2",
    "bcrypt": "^6.0.0",
    "next": "16.2.1",
    "next-auth": "^4.24.13",
    "prisma": "^6.19.2",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.2",
    "@types/bcrypt": "^6.0.0",
    "@types/node": "25.5.0",
    "@types/react": "19.2.14",
    "postcss": "^8.5.8",
    "tailwindcss": "^4.2.2",
    "tsx": "^4.21.0",
    "typescript": "6.0.2"
  }
}
```

## .env.example

```example
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

## README.md

```md
# Cafe SaaS

ระบบ SaaS แบบ multi-tenant สำหรับธุรกิจขนาดเล็ก เช่น คาเฟ่หรือร้านอาหาร
โฟกัสที่ attendance, payroll, subscription gating และ operational safety

## ความสามารถหลัก

- Multi-tenant พร้อม tenant isolation
- Subscription gating ระดับ tenant
- RBAC สำหรับ `OWNER`, `ADMIN`, `HR`, `FINANCE`, `EMPLOYEE`
- Attendance tracking พร้อม `workedMinutes` และ `lateMinutes`
- Payroll รองรับ `MONTHLY`, `DAILY`, `HOURLY`
- Payroll save / lock / unlock พร้อม audit
- Attendance correction request / approval พร้อม audit trail
- Audit log viewer ภายในระบบ
- Health endpoint สำหรับ production checks

## Stack

- Next.js 16
- Prisma
- PostgreSQL
- NextAuth
- Tailwind CSS 4

## Environment Variables

คัดลอกจาก [`.env.example`](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/.env.example) แล้วใส่ค่าจริง:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

ตรวจ environment ได้ด้วย:

```bash
npm run verify:env
```

## Development

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Production Run

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

หมายเหตุ:
- `prebuild` และ `prestart` จะตรวจ env ให้อัตโนมัติก่อนรัน
- Health check ใช้ที่ [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Demo Account

- Email: `owner@demo.local`
- Password: `demo1234`

## Deployment Checklist

### 1. Database

- ใช้ PostgreSQL managed service เช่น Neon, Supabase, RDS
- เปิด SSL
- ตั้ง `DATABASE_URL`
- รัน:

```bash
npx prisma generate
npx prisma migrate deploy
```

### 2. App Hosting

แนะนำ:
- Vercel สำหรับ app
- Managed PostgreSQL สำหรับ database

Environment ที่ต้องใส่บน Vercel:
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Build command:

```bash
npm run build
```

Start command:

```bash
npm run start
```

### 3. Operational Checks ก่อนเปิดใช้งาน

- ตรวจ `/api/health`
- ทดสอบ login
- ทดสอบ check-in / check-out
- ทดสอบ payroll save / lock / unlock
- ทดสอบ attendance correction request / approval
- ทดสอบ audit log page

## Backup

PowerShell script:

```powershell
.\scripts\backup-db.ps1
```

หรือกำหนด output directory:

```powershell
.\scripts\backup-db.ps1 -OutputDir .\backups
```

Prerequisites:
- ต้องมี `pg_dump` อยู่ใน PATH
- ต้องตั้ง `DATABASE_URL`

## Restore

PowerShell script:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\backup_YYYYMMDD_HHMMSS.sql
```

Prerequisites:
- ต้องมี `psql` อยู่ใน PATH
- ต้องตั้ง `DATABASE_URL`

## Monitoring เบื้องต้น

ระบบมี monitoring hooks ระดับพื้นฐานแล้ว:
- startup env validation
- health check endpoint
- security headers
- structured server logs สำหรับ startup/health
- audit log สำหรับ business-critical actions

สิ่งที่ควรทำต่อเมื่อขึ้น production จริง:
- ผูก log aggregation เช่น Better Stack, Datadog, Axiom
- ตั้ง uptime monitor ยิง `/api/health`
- ตั้ง database backup schedule อย่างน้อยวันละครั้ง

## Real-world Ready Status

ตอนนี้ระบบพร้อมสำหรับ:
- pilot customers
- internal production usage
- early paid operations

ยังควรเพิ่มต่อในอนาคต:
- external monitoring/alerting เต็มรูป
- PDF reporting
- billing integration
- scheduled backup automation
```

## lib\access.ts

```ts
import type { UserRole } from "@prisma/client"
import { getSessionUser, type SessionUser } from "@/lib/auth"
import { AppError } from "@/lib/http"
import { hasAnyRole } from "@/lib/role"
import {
  getTenantSubscription,
  type TenantSubscription,
} from "@/lib/subscription"

type AccessOptions = {
  roles?: readonly UserRole[]
  requireSubscription?: boolean
}

export type AuthorizedAccess = {
  user: SessionUser
  subscription: TenantSubscription
}

export async function authorizeRequest(
  options: AccessOptions = {},
): Promise<AuthorizedAccess> {
  const user = await getSessionUser()

  if (!user) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED")
  }

  if (options.roles && !hasAnyRole(user.role, options.roles)) {
    throw new AppError("Forbidden", 403, "FORBIDDEN")
  }

  const subscription = await getTenantSubscription(user.tenantId)

  if (options.requireSubscription !== false && !subscription.isActive) {
    throw new AppError("Subscription expired", 402, "SUBSCRIPTION_EXPIRED", {
      plan: subscription.plan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
    })
  }

  return {
    user,
    subscription,
  }
}

export async function getTenantAccess() {
  try {
    const access = await authorizeRequest()

    return {
      ok: true as const,
      ...access,
    }
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false as const,
        status: error.status,
        error: error.message,
        details: error.details,
      }
    }

    throw error
  }
}
```

## lib\attendance-correction.ts

```ts
import type { AttendanceCorrectionStatus, AttendanceStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { calculateAttendanceMetrics } from "@/lib/attendance"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"

export async function getAttendanceCorrectionList(
  tenantId: string,
  filters?: {
    status?: AttendanceCorrectionStatus
    search?: string
  },
) {
  return prisma.attendanceCorrection.findMany({
    where: {
      tenantId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              {
                reason: {
                  contains: filters.search,
                  mode: "insensitive",
                },
              },
              {
                attendance: {
                  employee: {
                    code: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                attendance: {
                  employee: {
                    firstName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                attendance: {
                  employee: {
                    lastName: {
                      contains: filters.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      attendance: {
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  })
}

export async function createAttendanceCorrection(params: {
  tenantId: string
  attendanceId: string
  requestedByUserId: string
  reason: string
  requestedCheckIn?: Date | null
  requestedCheckOut?: Date | null
  requestedStatus?: AttendanceStatus | null
  requestedWorkDate?: Date | null
}) {
  const attendance = await prisma.attendance.findFirst({
    where: {
      id: params.attendanceId,
      employee: {
        tenantId: params.tenantId,
      },
    },
  })

  if (!attendance) {
    throw new AppError("Attendance record not found", 404, "NOT_FOUND")
  }

  const existingPending = await prisma.attendanceCorrection.findFirst({
    where: {
      tenantId: params.tenantId,
      attendanceId: params.attendanceId,
      status: "PENDING",
    },
  })

  if (existingPending) {
    throw new AppError(
      "This attendance record already has a pending correction request",
      409,
      "CORRECTION_ALREADY_PENDING",
    )
  }

  return prisma.$transaction(async (tx) => {
    const correction = await tx.attendanceCorrection.create({
      data: {
        tenantId: params.tenantId,
        attendanceId: params.attendanceId,
        requestedByUserId: params.requestedByUserId,
        requestedCheckIn: params.requestedCheckIn ?? attendance.checkIn,
        requestedCheckOut: params.requestedCheckOut ?? attendance.checkOut,
        requestedStatus: params.requestedStatus ?? attendance.status,
        requestedWorkDate: params.requestedWorkDate ?? attendance.workDate,
        reason: params.reason,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.requestedByUserId,
        action: "attendance.correction_requested",
        entityType: "AttendanceCorrection",
        entityId: correction.id,
        metadata: {
          attendanceId: params.attendanceId,
          requestedStatus: params.requestedStatus ?? null,
        },
      },
    })

    return correction
  })
}

export async function reviewAttendanceCorrection(params: {
  tenantId: string
  correctionId: string
  reviewedByUserId: string
  decision: AttendanceCorrectionStatus
  reviewNote?: string | null
}) {
  if (!["APPROVED", "REJECTED"].includes(params.decision)) {
    throw new AppError("Invalid correction decision", 400, "INVALID_INPUT")
  }

  const correction = await prisma.attendanceCorrection.findFirst({
    where: {
      id: params.correctionId,
      tenantId: params.tenantId,
    },
    include: {
      attendance: true,
    },
  })

  if (!correction) {
    throw new AppError("Correction request not found", 404, "NOT_FOUND")
  }

  if (correction.status !== "PENDING") {
    throw new AppError(
      "Correction request has already been reviewed",
      409,
      "CORRECTION_ALREADY_REVIEWED",
    )
  }

  if (params.decision === "REJECTED") {
    if (!params.reviewNote) {
      throw new AppError(
        "Review note is required when rejecting a correction",
        400,
        "REVIEW_NOTE_REQUIRED",
      )
    }

    return prisma.$transaction(async (tx) => {
      const reviewed = await tx.attendanceCorrection.update({
        where: {
          id: correction.id,
        },
        data: {
          status: "REJECTED",
          reviewedByUserId: params.reviewedByUserId,
          reviewedAt: new Date(),
          reviewNote: params.reviewNote ?? null,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.reviewedByUserId,
          action: "attendance.correction_rejected",
          entityType: "AttendanceCorrection",
          entityId: reviewed.id,
          metadata: {
            attendanceId: reviewed.attendanceId,
          },
        },
      })

      return reviewed
    })
  }

  const nextWorkDate = correction.requestedWorkDate ?? correction.attendance.workDate
  await assertPayrollPeriodOpenForDate(params.tenantId, nextWorkDate)

  const nextCheckIn = correction.requestedCheckIn ?? correction.attendance.checkIn
  const nextCheckOut = correction.requestedCheckOut ?? correction.attendance.checkOut
  const metrics = calculateAttendanceMetrics({
    checkIn: nextCheckIn,
    checkOut: nextCheckOut,
    status: correction.requestedStatus ?? correction.attendance.status,
  })

  return prisma.$transaction(async (tx) => {
    const updatedAttendance = await tx.attendance.update({
      where: {
        id: correction.attendanceId,
      },
      data: {
        workDate: nextWorkDate,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        workedMinutes: metrics.workedMinutes,
        lateMinutes: metrics.lateMinutes,
        status: metrics.status,
      },
    })

    const reviewed = await tx.attendanceCorrection.update({
      where: {
        id: correction.id,
      },
      data: {
        status: "APPROVED",
        reviewedByUserId: params.reviewedByUserId,
        reviewedAt: new Date(),
        reviewNote: params.reviewNote ?? null,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.reviewedByUserId,
        action: "attendance.correction_approved",
        entityType: "AttendanceCorrection",
        entityId: reviewed.id,
        metadata: {
          attendanceId: reviewed.attendanceId,
          updatedAttendanceId: updatedAttendance.id,
          workDate: updatedAttendance.workDate,
          status: updatedAttendance.status,
        },
      },
    })

    return reviewed
  })
}
```

## lib\attendance.ts

```ts
import type { AttendanceStatus } from "@prisma/client"
import { AppError } from "@/lib/http"
import { getBusinessDateKey, getBusinessDateStart, minutesBetween } from "@/lib/time"

const DEFAULT_SHIFT_START = "09:00:00.000+07:00"

export function getShiftStart(date = new Date()) {
  return new Date(`${getBusinessDateKey(date)}T${DEFAULT_SHIFT_START}`)
}

export function getWorkDate(date = new Date()) {
  return getBusinessDateStart(date)
}

export function ensureCheckoutAfterCheckin(checkIn: Date, checkOut: Date) {
  const workedMinutes = minutesBetween(checkIn, checkOut)

  if (workedMinutes <= 0) {
    throw new AppError(
      "Check-out time must be after check-in time",
      400,
      "INVALID_ATTENDANCE_TIME",
    )
  }

  return workedMinutes
}

export function calculateAttendanceMetrics(input: {
  checkIn: Date | null
  checkOut: Date | null
  status?: AttendanceStatus | null
}) {
  const checkIn = input.checkIn
  const checkOut = input.checkOut

  let workedMinutes = 0
  let lateMinutes = 0

  if (checkIn) {
    lateMinutes = Math.max(0, minutesBetween(getShiftStart(checkIn), checkIn))
  }

  if (checkIn && checkOut) {
    workedMinutes = ensureCheckoutAfterCheckin(checkIn, checkOut)
  }

  const derivedStatus =
    input.status ??
    (checkIn ? (lateMinutes > 0 ? "LATE" : "PRESENT") : "ABSENT")

  return {
    workedMinutes,
    lateMinutes,
    status: derivedStatus,
  }
}
```

## lib\audit.ts

```ts
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type AuditInput = {
  tenantId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

type AuditListFilters = {
  limit?: number
  entityType?: string
  action?: string
  userId?: string
  search?: string
}

export async function createAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function getAuditLogList(
  tenantId: string,
  filters: AuditListFilters = {},
) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const entityType = filters.entityType?.trim() || undefined
  const action = filters.action?.trim() || undefined
  const userId = filters.userId?.trim() || undefined
  const search = filters.search?.trim() || undefined

  return prisma.auditLog.findMany({
    where: {
      tenantId,
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(search
        ? {
            OR: [
              {
                action: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                entityType: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                entityId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  })
}
```

## lib\auth.ts

```ts
import type { UserRole } from "@prisma/client"
import type { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { validateServerEnv } from "@/lib/env"
import { prisma } from "@/lib/prisma"

export type SessionUser = {
  id: string
  email: string
  role: UserRole
  tenantId: string
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.trim().toLowerCase(),
          },
        })

        if (!user?.passwordHash) {
          return null
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as SessionUser).role
        token.tenantId = (user as SessionUser).tenantId
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.id && token.role && token.tenantId && token.email) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.role = token.role as UserRole
        session.user.tenantId = token.tenantId
      }

      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export async function getSessionUser(): Promise<SessionUser | null> {
  validateServerEnv()
  const session = await getServerSession(authOptions)

  if (
    !session?.user?.id ||
    !session.user.email ||
    !session.user.role ||
    !session.user.tenantId
  ) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
    },
  })

  if (!user) {
    return null
  }

  return user
}
```

## lib\env.ts

```ts
type RequiredEnvKey =
  | "DATABASE_URL"
  | "NEXTAUTH_SECRET"
  | "NEXTAUTH_URL"

const REQUIRED_ENV_KEYS: RequiredEnvKey[] = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
]

let validated = false

export function getRequiredEnv(key: RequiredEnvKey) {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

export function validateServerEnv() {
  if (validated) {
    return
  }

  for (const key of REQUIRED_ENV_KEYS) {
    getRequiredEnv(key)
  }

  validated = true
}
```

## lib\http.ts

```ts
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

type ErrorPayload = {
  error: string
  code?: string
  details?: unknown
}

export class AppError extends Error {
  status: number
  code: string
  details?: unknown

  constructor(
    message: string,
    status = 400,
    code = "BAD_REQUEST",
    details?: unknown,
  ) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

export function jsonError(
  error: string,
  status = 400,
  code?: string,
  details?: unknown,
) {
  const payload: ErrorPayload = { error }

  if (code) {
    payload.code = code
  }

  if (details !== undefined) {
    payload.details = details
  }

  return jsonResponse(payload, status)
}

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new AppError("Invalid JSON body", 400, "INVALID_JSON")
  }
}

export function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.code, error.details)
  }

  if (isPrismaKnownError(error)) {
    if (error.code === "P2002") {
      return jsonError("Duplicate record", 409, "DUPLICATE_RECORD")
    }

    if (error.code === "P2025") {
      return jsonError("Record not found", 404, "NOT_FOUND")
    }
  }

  console.error(error)
  return jsonError("Internal server error", 500, "INTERNAL_SERVER_ERROR")
}
```

## lib\observability.ts

```ts
import { headers } from "next/headers"

type LogLevel = "info" | "warn" | "error"

type LogPayload = {
  event: string
  requestId?: string
  route?: string
  tenantId?: string
  userId?: string
  metadata?: Record<string, unknown>
}

function serialize(payload: LogPayload) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

export function logServerEvent(level: LogLevel, payload: LogPayload) {
  const line = serialize(payload)

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.log(line)
}

export function createRequestId() {
  return crypto.randomUUID()
}

export async function getCurrentRequestId() {
  const requestHeaders = await headers()
  return requestHeaders.get("x-request-id") ?? undefined
}
```

## lib\payroll.ts

```ts
import type { PaymentStatus, PayrollPeriodStatus, PayType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/lib/http"
import { getBusinessYearMonth, roundCurrency } from "@/lib/time"

const STANDARD_WORK_MINUTES = 8 * 60
const BUSINESS_OFFSET = "+07:00"

export type PayrollItem = {
  employeeId: string
  employeeCode: string
  employeeName: string
  payType: PayType
  presentDays: number
  absentDays: number
  workedHours: number
  overtimeHours: number
  lateMinutes: number
  basePay: number
  overtimePay: number
  deduction: number
  netPay: number
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  promptPayId: string | null
  paymentStatus: PaymentStatus
}

export type PayrollResult = {
  month: number
  year: number
  payday: number
  periodStart: Date
  periodEnd: Date
  status: PayrollPeriodStatus
  locked: boolean
  lockedAt: Date | null
  lockedByUserId: string | null
  source: "preview" | "saved" | "locked"
  items: PayrollItem[]
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getClampedPayday(year: number, month: number, payday: number) {
  return Math.min(Math.max(payday, 1), getDaysInMonth(year, month))
}

function getBusinessDate(year: number, month: number, day: number) {
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00.000${BUSINESS_OFFSET}`)
}

function shiftMonth(year: number, month: number, offset: number) {
  const shiftedMonthIndex = month - 1 + offset
  const shiftedYear = year + Math.floor(shiftedMonthIndex / 12)
  const normalizedMonthIndex = ((shiftedMonthIndex % 12) + 12) % 12

  return {
    year: shiftedYear,
    month: normalizedMonthIndex + 1,
  }
}

export function getPayrollCycleRange(payday: number, year: number, month: number) {
  const previous = shiftMonth(year, month, -1)
  const previousPayday = getClampedPayday(previous.year, previous.month, payday)
  const currentPayday = getClampedPayday(year, month, payday)

  const periodStart =
    previousPayday < getDaysInMonth(previous.year, previous.month)
      ? getBusinessDate(previous.year, previous.month, previousPayday + 1)
      : getBusinessDate(year, month, 1)

  const periodEndExclusive =
    currentPayday < getDaysInMonth(year, month)
      ? getBusinessDate(year, month, currentPayday + 1)
      : getBusinessDate(shiftMonth(year, month, 1).year, shiftMonth(year, month, 1).month, 1)

  const periodEnd = new Date(periodEndExclusive.getTime() - 1)

  return {
    start: periodStart,
    endExclusive: periodEndExclusive,
    end: periodEnd,
  }
}

export function getPayrollPeriodLabelForDate(workDate: Date, payday: number) {
  const { year, month } = getBusinessYearMonth(workDate)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
  })
  const day = Number(formatter.format(workDate))
  const currentPayday = getClampedPayday(year, month, payday)

  if (day <= currentPayday) {
    return { year, month }
  }

  return shiftMonth(year, month, 1)
}

export async function getPayrollPeriod(
  tenantId: string,
  month: number,
  year: number,
) {
  return prisma.payrollPeriod.findUnique({
    where: {
      tenantId_month_year: {
        tenantId,
        month,
        year,
      },
    },
  })
}

async function getTenantPayrollSettings(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { payrollPayday: true },
  })

  if (!tenant) {
    throw new AppError("Tenant not found", 404, "NOT_FOUND")
  }

  return tenant
}

function deriveDailyRate(baseSalary: number | null, dailyRate: number | null) {
  return dailyRate ?? (baseSalary ? roundCurrency(baseSalary / 30) : 0)
}

function deriveHourlyRate(baseSalary: number | null, hourlyRate: number | null) {
  return hourlyRate ?? (baseSalary ? roundCurrency(baseSalary / (30 * 8)) : 0)
}

export async function calculatePayrollPreview(
  tenantId: string,
  month: number,
  year: number,
) {
  const tenant = await getTenantPayrollSettings(tenantId)
  const { start, endExclusive } = getPayrollCycleRange(tenant.payrollPayday, year, month)

  const [employees, existingPayrolls] = await Promise.all([
    prisma.employee.findMany({
      where: {
        tenantId,
        OR: [
          { active: true },
          {
            terminatedAt: {
              gte: start,
            },
          },
        ],
      },
      include: {
        bank: true,
        attendances: {
          where: {
            workDate: {
              gte: start,
              lt: endExclusive,
            },
          },
          orderBy: {
            workDate: "asc",
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    }),
    prisma.payroll.findMany({
      where: {
        month,
        year,
        employee: {
          tenantId,
        },
      },
      select: {
        employeeId: true,
        paymentStatus: true,
      },
    }),
  ])

  const paymentStatusMap = new Map(
    existingPayrolls.map((record) => [record.employeeId, record.paymentStatus]),
  )

  return {
    payday: tenant.payrollPayday,
    ...getPayrollCycleRange(tenant.payrollPayday, year, month),
    items: employees.map((employee) => {
      const presentRecords = employee.attendances.filter(
        (attendance) =>
          attendance.status === "PRESENT" || attendance.status === "LATE",
      )
      const absentRecords = employee.attendances.filter(
        (attendance) => attendance.status === "ABSENT",
      )
      const totalWorkedMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.workedMinutes,
        0,
      )
      const totalLateMinutes = presentRecords.reduce(
        (sum, attendance) => sum + attendance.lateMinutes,
        0,
      )
      const overtimeMinutes = presentRecords.reduce(
        (sum, attendance) =>
          sum + Math.max(0, attendance.workedMinutes - STANDARD_WORK_MINUTES),
        0,
      )

      const dailyRate = deriveDailyRate(employee.baseSalary, employee.dailyRate)
      const hourlyRate = deriveHourlyRate(employee.baseSalary, employee.hourlyRate)

      let basePay = 0
      let deduction = 0

      if (employee.payType === "MONTHLY") {
        basePay = employee.baseSalary ?? 0
        deduction = absentRecords.length * dailyRate
      }

      if (employee.payType === "DAILY") {
        basePay = presentRecords.length * dailyRate
      }

      if (employee.payType === "HOURLY") {
        basePay = (totalWorkedMinutes / 60) * hourlyRate
      }

      const overtimePay = (overtimeMinutes / 60) * hourlyRate * 1.5
      const netPay = Math.max(0, basePay + overtimePay - deduction)

      return {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        payType: employee.payType,
        presentDays: presentRecords.length,
        absentDays: absentRecords.length,
        workedHours: roundCurrency(totalWorkedMinutes / 60),
        overtimeHours: roundCurrency(overtimeMinutes / 60),
        lateMinutes: totalLateMinutes,
        basePay: roundCurrency(basePay),
        overtimePay: roundCurrency(overtimePay),
        deduction: roundCurrency(deduction),
        netPay: roundCurrency(netPay),
        bankName: employee.bank?.bankName ?? null,
        accountName: employee.bank?.accountName ?? null,
        accountNumber: employee.bank?.accountNumber ?? null,
        promptPayId: employee.bank?.promptPayId ?? null,
        paymentStatus: paymentStatusMap.get(employee.id) ?? "PENDING",
      } satisfies PayrollItem
    }),
  }
}

export async function getStoredPayrollItems(
  tenantId: string,
  month: number,
  year: number,
) {
  const records = await prisma.payroll.findMany({
    where: {
      month,
      year,
      employee: {
        tenantId,
      },
    },
    include: {
      employee: {
        include: {
          bank: true,
        },
      },
    },
    orderBy: {
      employee: {
        code: "asc",
      },
    },
  })

  return records.map((record) => ({
    employeeId: record.employeeId,
    employeeCode: record.employee.code,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    payType: record.payTypeSnapshot,
    presentDays: record.presentDays,
    absentDays: record.absentDays,
    workedHours: roundCurrency(record.workedHours),
    overtimeHours: roundCurrency(Math.max(0, record.overtimePay) / Math.max(1, (record.employee.hourlyRate ?? (record.employee.baseSalary ? roundCurrency(record.employee.baseSalary / (30 * 8)) : 1)) * 1.5)),
    lateMinutes: record.lateMinutes,
    basePay: roundCurrency(record.basePay),
    overtimePay: roundCurrency(record.overtimePay),
    deduction: roundCurrency(record.deduction),
    netPay: roundCurrency(record.netPay),
    bankName: record.employee.bank?.bankName ?? null,
    accountName: record.employee.bank?.accountName ?? null,
    accountNumber: record.employee.bank?.accountNumber ?? null,
    promptPayId: record.employee.bank?.promptPayId ?? null,
    paymentStatus: record.paymentStatus,
  }))
}

export async function getPayrollResult(
  tenantId: string,
  month: number,
  year: number,
): Promise<PayrollResult> {
  const tenant = await getTenantPayrollSettings(tenantId)
  const range = getPayrollCycleRange(tenant.payrollPayday, year, month)
  const period = await getPayrollPeriod(tenantId, month, year)

  if (period?.status === "LOCKED") {
    const items = await getStoredPayrollItems(tenantId, month, year)

    return {
      month,
      year,
      payday: tenant.payrollPayday,
      periodStart: range.start,
      periodEnd: range.end,
      status: period.status,
      locked: true,
      lockedAt: period.lockedAt,
      lockedByUserId: period.lockedByUserId,
      source: "locked",
      items,
    }
  }

  const preview = await calculatePayrollPreview(tenantId, month, year)

  return {
    month,
    year,
    payday: preview.payday,
    periodStart: preview.start,
    periodEnd: preview.end,
    status: period?.status ?? "OPEN",
    locked: false,
    lockedAt: null,
    lockedByUserId: null,
    source: period ? "saved" : "preview",
    items: preview.items,
  }
}

export async function savePayrollPeriod(params: {
  tenantId: string
  userId: string
  month: number
  year: number
  action: "save" | "lock"
}) {
  const preview = await calculatePayrollPreview(
    params.tenantId,
    params.month,
    params.year,
  )

  const now = new Date()

  await prisma.$transaction(async (tx) => {
    const existingPeriod = await tx.payrollPeriod.upsert({
      where: {
        tenantId_month_year: {
          tenantId: params.tenantId,
          month: params.month,
          year: params.year,
        },
      },
      update: {},
      create: {
        tenantId: params.tenantId,
        month: params.month,
        year: params.year,
      },
    })

    if (existingPeriod.status === "LOCKED") {
      throw new AppError(
        "Payroll period is locked and cannot be recalculated",
        409,
        "PAYROLL_PERIOD_LOCKED",
      )
    }

    for (const item of preview.items) {
      await tx.payroll.upsert({
        where: {
          employeeId_month_year: {
            employeeId: item.employeeId,
            month: params.month,
            year: params.year,
          },
        },
        update: {
          payTypeSnapshot: item.payType,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          workedHours: item.workedHours,
          lateMinutes: item.lateMinutes,
          basePay: item.basePay,
          overtimePay: item.overtimePay,
          deduction: item.deduction,
          netPay: item.netPay,
        },
        create: {
          employeeId: item.employeeId,
          month: params.month,
          year: params.year,
          payTypeSnapshot: item.payType,
          presentDays: item.presentDays,
          absentDays: item.absentDays,
          workedHours: item.workedHours,
          lateMinutes: item.lateMinutes,
          basePay: item.basePay,
          overtimePay: item.overtimePay,
          deduction: item.deduction,
          netPay: item.netPay,
        },
      })
    }

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action === "lock" ? "payroll.locked" : "payroll.saved",
        entityType: "PayrollPeriod",
        entityId: existingPeriod.id,
        metadata: {
          month: params.month,
          year: params.year,
          payday: preview.payday,
          itemCount: preview.items.length,
        },
      },
    })

    if (params.action === "lock") {
      await tx.payrollPeriod.update({
        where: {
          id: existingPeriod.id,
        },
        data: {
          status: "LOCKED",
          lockedAt: now,
          lockedByUserId: params.userId,
        },
      })
    }
  })

  return getPayrollResult(params.tenantId, params.month, params.year)
}

export async function unlockPayrollPeriod(params: {
  tenantId: string
  userId: string
  month: number
  year: number
  reason: string
}) {
  const period = await prisma.payrollPeriod.findUnique({
    where: {
      tenantId_month_year: {
        tenantId: params.tenantId,
        month: params.month,
        year: params.year,
      },
    },
  })

  if (!period) {
    throw new AppError("Payroll period not found", 404, "NOT_FOUND")
  }

  if (period.status !== "LOCKED") {
    throw new AppError(
      "Payroll period is not locked",
      409,
      "PAYROLL_PERIOD_NOT_LOCKED",
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollPeriod.update({
      where: {
        id: period.id,
      },
      data: {
        status: "OPEN",
        lockedAt: null,
        lockedByUserId: null,
      },
    })

    await tx.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: "payroll.unlocked",
        entityType: "PayrollPeriod",
        entityId: period.id,
        metadata: {
          month: params.month,
          year: params.year,
          reason: params.reason,
        },
      },
    })
  })

  return getPayrollResult(params.tenantId, params.month, params.year)
}

export async function assertPayrollPeriodOpenForDate(
  tenantId: string,
  workDate: Date,
) {
  const tenant = await getTenantPayrollSettings(tenantId)
  const { month, year } = getPayrollPeriodLabelForDate(workDate, tenant.payrollPayday)
  const period = await getPayrollPeriod(tenantId, month, year)

  if (period?.status === "LOCKED") {
    throw new AppError(
      "Payroll period is locked for this work date",
      409,
      "PAYROLL_PERIOD_LOCKED",
    )
  }
}
```

## lib\prisma.ts

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

## lib\role.ts

```ts
import type { UserRole } from "@prisma/client"

export const ROLE_GROUPS = {
  employeeRead: ["OWNER", "ADMIN", "HR", "FINANCE"] as UserRole[],
  employeeManage: ["OWNER", "ADMIN", "HR"] as UserRole[],
  attendanceView: ["OWNER", "ADMIN", "HR", "FINANCE"] as UserRole[],
  attendanceManage: ["OWNER", "ADMIN", "HR"] as UserRole[],
  attendanceApprove: ["OWNER", "ADMIN"] as UserRole[],
  payrollView: ["OWNER", "ADMIN", "FINANCE"] as UserRole[],
  payrollManage: ["OWNER", "ADMIN", "FINANCE"] as UserRole[],
  payrollUnlock: ["OWNER"] as UserRole[],
  auditView: ["OWNER", "ADMIN", "HR", "FINANCE"] as UserRole[],
  opsView: ["OWNER", "ADMIN"] as UserRole[],
  dashboardView: ["OWNER", "ADMIN", "HR", "FINANCE", "EMPLOYEE"] as UserRole[],
} as const

export function hasAnyRole(
  role: UserRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return allowedRoles.includes(role)
}
```

## lib\route-guard.ts

```ts
import type { UserRole } from "@prisma/client"
import { authorizeRequest, type AuthorizedAccess } from "@/lib/access"
import { handleApiError } from "@/lib/http"

type RouteOptions = {
  roles?: readonly UserRole[]
  requireSubscription?: boolean
}

type RouteContext = {
  params?: Promise<Record<string, string>> | Record<string, string>
}

type AuthorizedRouteHandler<TContext extends RouteContext> = (
  req: Request,
  context: TContext,
  access: AuthorizedAccess,
) => Promise<Response>

export function withAuthorizedRoute<TContext extends RouteContext = RouteContext>(
  options: RouteOptions,
  handler: AuthorizedRouteHandler<TContext>,
) {
  return async (req: Request, context: TContext) => {
    try {
      const access = await authorizeRequest(options)
      return await handler(req, context, access)
    } catch (error) {
      return handleApiError(error)
    }
  }
}
```

## lib\subscription.ts

```ts
import type { SubscriptionStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type TenantSubscription = {
  plan: string
  status: SubscriptionStatus | "EXPIRED"
  expiresAt: Date | null
  isActive: boolean
  daysRemaining: number | null
}

export async function getTenantSubscription(
  tenantId: string,
): Promise<TenantSubscription> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
    },
  })

  if (!tenant) {
    return {
      plan: "starter",
      status: "EXPIRED",
      expiresAt: null,
      isActive: false,
      daysRemaining: null,
    }
  }

  const expiresAt = tenant.subscriptionExpiresAt
  const now = new Date()

  if (!expiresAt || expiresAt.getTime() < now.getTime()) {
    return {
      plan: tenant.subscriptionPlan,
      status: "EXPIRED",
      expiresAt,
      isActive: false,
      daysRemaining: expiresAt
        ? Math.max(
            0,
            Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : null,
    }
  }

  return {
    plan: tenant.subscriptionPlan,
    status: tenant.subscriptionStatus,
    expiresAt,
    isActive:
      tenant.subscriptionStatus === "ACTIVE" ||
      tenant.subscriptionStatus === "TRIAL",
    daysRemaining: Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    ),
  }
}

export async function isSubscriptionActive(tenantId: string): Promise<boolean> {
  const subscription = await getTenantSubscription(tenantId)
  return subscription.isActive
}
```

## lib\time.ts

```ts
export const BUSINESS_TIMEZONE = "Asia/Bangkok"
const BUSINESS_OFFSET = "+07:00"

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getParts(date: Date): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  }
}

export function getBusinessDateKey(date = new Date()): string {
  const parts = getParts(date)
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

export function getBusinessYearMonth(date = new Date()) {
  const parts = getParts(date)

  return {
    year: parts.year,
    month: parts.month,
  }
}

export function getBusinessDateStart(date = new Date()): Date {
  const parts = getParts(date)
  return new Date(
    `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T00:00:00.000${BUSINESS_OFFSET}`,
  )
}

export function getBusinessMonthRange(year: number, month: number) {
  const start = new Date(
    `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000${BUSINESS_OFFSET}`,
  )
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = new Date(
    `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00.000${BUSINESS_OFFSET}`,
  )

  return { start, end }
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
```

## lib\validators.ts

```ts
import type { AttendanceStatus, EmployeeType, PayType } from "@prisma/client"
import { AppError } from "@/lib/http"

const EMPLOYEE_TYPES: EmployeeType[] = ["FULL_TIME", "PART_TIME"]
const PAY_TYPES: PayType[] = ["MONTHLY", "DAILY", "HOURLY"]
const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "LEAVE",
  "DAY_OFF",
]

export function asTrimmedString(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new AppError(`${fieldName} is required`, 400, "INVALID_INPUT")
  }

  return trimmed
}

export function asOptionalTrimmedString(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== "string") {
    throw new AppError("Invalid text field", 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()
  return trimmed || null
}

export function asOptionalSearchString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new AppError("Invalid search field", 400, "INVALID_INPUT")
  }

  const trimmed = value.trim()
  return trimmed || undefined
}

export function asOptionalNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError("Invalid numeric field", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalInteger(value: unknown) {
  const parsed = asOptionalNumber(value)

  if (parsed === null) {
    return null
  }

  if (!Number.isInteger(parsed)) {
    throw new AppError("Invalid integer field", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asBusinessDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") {
    throw new AppError(`${fieldName} is required`, 400, "INVALID_INPUT")
  }

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalBusinessDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("Invalid date", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asEmployeeType(value: unknown): EmployeeType {
  const normalized = String(value ?? "FULL_TIME") as EmployeeType

  if (!EMPLOYEE_TYPES.includes(normalized)) {
    throw new AppError("Invalid employeeType", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asPayType(value: unknown): PayType {
  const normalized = String(value ?? "MONTHLY") as PayType

  if (!PAY_TYPES.includes(normalized)) {
    throw new AppError("Invalid payType", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asMonth(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback)

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    throw new AppError("Invalid month", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asYear(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback)

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 3000) {
    throw new AppError("Invalid year", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asAction(value: unknown, allowed: readonly string[]) {
  const normalized = String(value ?? "").trim()

  if (!allowed.includes(normalized)) {
    throw new AppError("Invalid action", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asAttendanceStatus(value: unknown) {
  const normalized = String(value ?? "") as AttendanceStatus

  if (!ATTENDANCE_STATUSES.includes(normalized)) {
    throw new AppError("Invalid attendance status", 400, "INVALID_INPUT")
  }

  return normalized
}

export function asLatitude(value: unknown, fieldName = "latitude") {
  const parsed = asOptionalNumber(value)

  if (parsed === null || parsed < -90 || parsed > 90) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asLongitude(value: unknown, fieldName = "longitude") {
  const parsed = asOptionalNumber(value)

  if (parsed === null || parsed < -180 || parsed > 180) {
    throw new AppError(`${fieldName} is invalid`, 400, "INVALID_INPUT")
  }

  return parsed
}

export function asOptionalLatitude(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return asLatitude(value)
}

export function asOptionalLongitude(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null
  }

  return asLongitude(value)
}

export function asPayrollPayday(value: unknown) {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 1 || parsed > 31) {
    throw new AppError("Invalid payroll payday", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asMeterRadius(value: unknown) {
  const parsed = asOptionalInteger(value)

  if (parsed === null || parsed < 10 || parsed > 5000) {
    throw new AppError("Invalid allowed radius", 400, "INVALID_INPUT")
  }

  return parsed
}

export function asPhotoReference(value: unknown) {
  const photo = asTrimmedString(value, "photo")

  if (
    !photo.startsWith("data:image/") &&
    !photo.startsWith("http://") &&
    !photo.startsWith("https://")
  ) {
    throw new AppError("รูปภาพไม่ถูกต้อง", 400, "INVALID_INPUT")
  }

  if (photo.length > 6_000_000) {
    throw new AppError("รูปภาพมีขนาดใหญ่เกินไป", 400, "INVALID_INPUT")
  }

  return photo
}
```

## app\global-error.tsx

```tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="th">
      <body className="app-shell">
        <div className="page">
          <section className="panel">
            <div className="badge-row">
              <div className="badge">Application Error</div>
            </div>
            <h1 className="hero-title">เกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
            <p className="hero-subtitle">
              ระบบยังทำงานได้บางส่วน แต่หน้านี้เกิดปัญหา กรุณาลองใหม่อีกครั้ง
            </p>
            <div className="message message-error" style={{ marginTop: 16 }}>
              {error.message || "Unknown error"}
            </div>
            <div className="action-row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => reset()}>
                ลองใหม่
              </button>
            </div>
          </section>
        </div>
      </body>
    </html>
  )
}
```

## app\globals.css

```css
@import "tailwindcss";

:root {
  --background: #f5efe7;
  --foreground: #1d160f;
  --muted: #6b5b4d;
  --surface: rgba(255, 250, 244, 0.88);
  --surface-strong: #fff7ef;
  --border: rgba(103, 74, 45, 0.14);
  --brand: #8b4513;
  --brand-strong: #6f3410;
  --brand-soft: #f3d6bf;
  --success: #166534;
  --danger: #b91c1c;
  --warning: #b45309;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: "Segoe UI", "Noto Sans Thai", sans-serif;
  --font-mono: "Cascadia Code", monospace;
}

* {
  box-sizing: border-box;
}

html {
  min-height: 100%;
}

body {
  min-height: 100vh;
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  background-image:
    radial-gradient(circle at top left, rgba(255, 215, 181, 0.8), transparent 32%),
    radial-gradient(circle at top right, rgba(196, 139, 89, 0.18), transparent 26%),
    linear-gradient(180deg, #fff8f2 0%, #f5efe7 100%);
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
}

.page {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 56px;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}

.hero-title {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1;
}

.hero-subtitle {
  margin: 8px 0 0;
  color: var(--muted);
}

.badge-row,
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid var(--border);
  color: var(--muted);
}

.panel {
  background: var(--surface);
  backdrop-filter: blur(14px);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 16px 44px rgba(94, 67, 39, 0.08);
}

.panel + .panel {
  margin-top: 16px;
}

.panel-title {
  margin: 0 0 4px;
  font-size: 1.1rem;
}

.panel-subtitle {
  margin: 0;
  color: var(--muted);
}

.grid {
  display: grid;
  gap: 16px;
}

.grid.stats {
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  margin-bottom: 20px;
}

.stat-card {
  padding: 20px;
  border-radius: 22px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 248, 240, 0.88));
}

.stat-label {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 0.95rem;
}

.stat-value {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.btn {
  border: 0;
  border-radius: 14px;
  min-height: 48px;
  padding: 13px 18px;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
  font-weight: 600;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
}

.btn-primary {
  background: var(--brand);
  color: #fff;
}

.btn-primary:hover {
  background: var(--brand-strong);
}

.btn-secondary {
  background: #fff;
  color: var(--foreground);
  border: 1px solid var(--border);
}

.btn-danger {
  background: #fff1f2;
  color: var(--danger);
  border: 1px solid rgba(185, 28, 28, 0.14);
}

.btn-ghost {
  background: transparent;
  color: var(--muted);
  border: 1px dashed var(--border);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 0.92rem;
  color: var(--muted);
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-height: 48px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.92);
  padding: 10px 12px;
}

.message {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 14px;
}

.message-success {
  background: rgba(22, 101, 52, 0.09);
  color: var(--success);
}

.message-error {
  background: rgba(185, 28, 28, 0.08);
  color: var(--danger);
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.data-table th {
  color: var(--muted);
  font-weight: 600;
  font-size: 0.92rem;
}

.table-meta {
  color: var(--muted);
  font-size: 0.85rem;
}

.pre-wrap {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.photo-preview {
  width: 100%;
  max-width: 280px;
  border-radius: 18px;
  border: 1px solid var(--border);
  margin-top: 10px;
  object-fit: cover;
}

.record-card {
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  padding: 16px;
}

.record-card + .record-card {
  margin-top: 12px;
}

.record-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.record-card-body {
  display: grid;
  gap: 10px;
}

.record-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.95rem;
}

.record-line span {
  color: var(--muted);
}

.mobile-only {
  display: none;
}

.desktop-only {
  display: block;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.status-pill.success {
  background: rgba(22, 101, 52, 0.1);
  color: var(--success);
}

.status-pill.warning {
  background: rgba(180, 83, 9, 0.12);
  color: var(--warning);
}

.status-pill.danger {
  background: rgba(185, 28, 28, 0.12);
  color: var(--danger);
}

.empty-state {
  padding: 24px;
  text-align: center;
  color: var(--muted);
}

.login-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: min(460px, 100%);
  padding: 28px;
}

.login-card h1 {
  margin: 0;
  font-size: 2.3rem;
}

.login-card p {
  color: var(--muted);
}

@media (max-width: 640px) {
  .page {
    width: min(100% - 20px, 1180px);
    padding: 20px 0 36px;
  }

  .hero {
    align-items: flex-start;
  }

  .panel,
  .stat-card {
    padding: 16px;
  }

  .action-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .action-row .btn {
    width: 100%;
  }

  .hero-title {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 1.7rem;
  }

  .field input,
  .field select,
  .field textarea {
    font-size: 16px;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }
}

@media (min-width: 641px) {
  .mobile-only {
    display: none;
  }

  .desktop-only {
    display: block;
  }
}
```

## app\layout.tsx

```tsx
import type { Metadata } from "next"
import "./globals.css"
import Providers from "./providers"

export const metadata: Metadata = {
  title: "Cafe SaaS",
  description: "ระบบ attendance และ payroll สำหรับธุรกิจหลายสาขา",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className="app-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## app\page.tsx

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"

export default async function HomePage() {
  const session = await getServerSession(authOptions)
  redirect(session ? "/dashboard" : "/login")
}
```

## app\providers.tsx

```tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return <SessionProvider>{children}</SessionProvider>
}
```

## app\api\auth\[...nextauth]\route.ts

`FILE NOT FOUND`

## app\api\login\route.ts

```ts
import bcrypt from "bcrypt"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    )
  }

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const passwordMatched = await bcrypt.compare(password, user.passwordHash)

  if (!passwordMatched) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 })
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  })
}
```

## app\api\me\route.ts

```ts
import { jsonResponse } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute({}, async (_req, _context, access) => {
    return jsonResponse({
      ...access.user,
      subscription: access.subscription,
    })
})
```

## app\api\health\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { jsonResponse } from "@/lib/http"
import { validateServerEnv } from "@/lib/env"
import { logServerEvent } from "@/lib/observability"

export async function GET() {
  try {
    validateServerEnv()
    await prisma.$queryRaw`SELECT 1`

    logServerEvent("info", {
      event: "health.ok",
      route: "/api/health",
      metadata: {
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
    })

    return jsonResponse({
      ok: true,
      database: "up",
      app: "up",
      nodeEnv: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "0.0.0",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logServerEvent("error", {
      event: "health.failed",
      route: "/api/health",
      metadata: {
        error: error instanceof Error ? error.message : "unknown",
      },
    })

    return jsonResponse(
      {
        ok: false,
        database: "down",
        app: "degraded",
        nodeEnv: process.env.NODE_ENV ?? "development",
        version: process.env.npm_package_version ?? "0.0.0",
        timestamp: new Date().toISOString(),
      },
      500,
    )
  }
}
```

## app\api\dashboard-summary\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { getBusinessDateStart } from "@/lib/time"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.dashboardView,
  },
  async (_req, _context, access) => {
    const today = getBusinessDateStart(new Date())
    const tenantId = access.user.tenantId

    const [totalEmployees, checkedInToday, checkedOutToday, absentToday] =
      await Promise.all([
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkIn: { not: null },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkOut: { not: null },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
            attendances: {
              none: {
                workDate: today,
              },
            },
          },
        }),
      ])

    return jsonResponse({
      totalEmployees,
      checkedInToday,
      checkedOutToday,
      absentToday,
      subscription: access.subscription,
    })
  },
)
```

## app\api\employees\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { createAuditLog } from "@/lib/audit"
import { handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import {
  asBusinessDate,
  asEmployeeType,
  asOptionalNumber,
  asOptionalTrimmedString,
  asPayType,
  asTrimmedString,
} from "@/lib/validators"

type EmployeeCreateBody = {
  code?: unknown
  firstName?: unknown
  lastName?: unknown
  phone?: unknown
  position?: unknown
  employeeType?: unknown
  payType?: unknown
  baseSalary?: unknown
  dailyRate?: unknown
  hourlyRate?: unknown
  startDate?: unknown
  bankName?: unknown
  accountName?: unknown
  accountNumber?: unknown
  promptPayId?: unknown
}

export async function GET(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeRead,
    })
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get("includeInactive") === "true"

    const employees = await prisma.employee.findMany({
      where: {
        tenantId: access.user.tenantId,
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
        bank: true,
      },
      orderBy: [{ active: "desc" }, { code: "asc" }],
    })

    return jsonResponse(employees)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.employeeManage,
    })
    const body = await readJsonBody<EmployeeCreateBody>(req)
    const code = asTrimmedString(body.code, "code")
    const firstName = asTrimmedString(body.firstName, "firstName")
    const lastName = asTrimmedString(body.lastName, "lastName")
    const phone = asOptionalTrimmedString(body.phone)
    const position = asTrimmedString(body.position, "position")
    const employeeType = asEmployeeType(body.employeeType)
    const payType = asPayType(body.payType)
    const baseSalary = asOptionalNumber(body.baseSalary)
    const dailyRate = asOptionalNumber(body.dailyRate)
    const hourlyRate = asOptionalNumber(body.hourlyRate)
    const startDate = body.startDate
      ? asBusinessDate(body.startDate, "startDate")
      : new Date()
    const bankName = asOptionalTrimmedString(body.bankName)
    const accountName = asOptionalTrimmedString(body.accountName)
    const accountNumber = asOptionalTrimmedString(body.accountNumber)
    const promptPayId = asOptionalTrimmedString(body.promptPayId)

    const shouldCreateBankAccount = Boolean(bankName && accountName && accountNumber)

    const existing = await prisma.employee.findUnique({
      where: {
        tenantId_code: {
          tenantId: access.user.tenantId,
          code,
        },
      },
    })

    if (existing) {
      return jsonResponse(
        { error: "รหัสพนักงานนี้ถูกใช้งานแล้ว" },
        409,
      )
    }

    const employee = await prisma.employee.create({
      data: {
        tenantId: access.user.tenantId,
        code,
        firstName,
        lastName,
        phone,
        position,
        employeeType,
        payType,
        baseSalary,
        dailyRate,
        hourlyRate,
        startDate,
        active: true,
        ...(shouldCreateBankAccount
          ? {
              bank: {
                create: {
                  bankName: bankName!,
                  accountName: accountName!,
                  accountNumber: accountNumber!,
                  promptPayId,
                },
              },
            }
          : {}),
      },
      include: {
        bank: true,
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "employee.created",
      entityType: "Employee",
      entityId: employee.id,
      metadata: {
        code: employee.code,
        payType: employee.payType,
        hasBank: shouldCreateBankAccount,
      },
    })

    return jsonResponse(employee, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

## app\api\employees\[id]\route.ts

`FILE NOT FOUND`

## app\api\attendance\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { AppError, handleApiError, jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { asOptionalBusinessDate } from "@/lib/validators"

export async function GET(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceView,
    })
    const { searchParams } = new URL(req.url)
    const employeeId = searchParams.get("employeeId")
    const startDate = asOptionalBusinessDate(searchParams.get("startDate"))
    const endDate = asOptionalBusinessDate(searchParams.get("endDate"))

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      throw new AppError("Invalid attendance date range", 400, "INVALID_INPUT")
    }

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        employee: {
          tenantId: access.user.tenantId,
        },
        ...(employeeId ? { employeeId } : {}),
        ...(startDate || endDate
          ? {
              workDate: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            code: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
      },
      orderBy: [{ workDate: "desc" }, { checkIn: "desc" }],
      take: 90,
    })

    return jsonResponse(attendanceRecords)
  } catch (error) {
    return handleApiError(error)
  }
}
```

## app\api\attendance\check-in\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { getShiftStart, getWorkDate } from "@/lib/attendance"
import { assertWithinAllowedRadius, getEffectiveLocationConfig } from "@/lib/gps"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { minutesBetween } from "@/lib/time"
import {
  asLatitude,
  asLongitude,
  asPhotoReference,
  asTrimmedString,
} from "@/lib/validators"

type CheckInBody = {
  employeeId?: unknown
  photo?: unknown
  latitude?: unknown
  longitude?: unknown
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })
    const body = await readJsonBody<CheckInBody>(req)
    const employeeId = asTrimmedString(body.employeeId, "employeeId")
    const photo = asPhotoReference(body.photo)
    const latitude = asLatitude(body.latitude)
    const longitude = asLongitude(body.longitude)
    const now = new Date()
    const workDate = getWorkDate(now)

    await assertPayrollPeriodOpenForDate(access.user.tenantId, workDate)

    const [tenant, employee] = await Promise.all([
      prisma.tenant.findUnique({
        where: {
          id: access.user.tenantId,
        },
        select: {
          latitude: true,
          longitude: true,
          allowedRadiusMeters: true,
        },
      }),
      prisma.employee.findFirst({
        where: {
          id: employeeId,
          tenantId: access.user.tenantId,
          active: true,
        },
        include: {
          branch: {
            select: {
              name: true,
              latitude: true,
              longitude: true,
              allowedRadiusMeters: true,
            },
          },
        },
      }),
    ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    if (!employee) {
      throw new AppError("Employee not found", 404, "NOT_FOUND")
    }

    const locationConfig = getEffectiveLocationConfig({
      tenant,
      branch: employee.branch,
    })
    const distanceMeters = assertWithinAllowedRadius({
      latitude,
      longitude,
      targetLatitude: locationConfig.latitude,
      targetLongitude: locationConfig.longitude,
      allowedRadiusMeters: locationConfig.allowedRadiusMeters,
    })

    const openAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        workDate: "desc",
      },
    })

    if (openAttendance) {
      if (openAttendance.workDate.getTime() === workDate.getTime()) {
        throw new AppError("ลงเวลาเข้าแล้ววันนี้", 409, "ALREADY_CHECKED_IN")
      }

      throw new AppError(
        "พนักงานมีรายการลงเวลาเดิมที่ยังไม่ check-out",
        409,
        "OPEN_ATTENDANCE_EXISTS",
      )
    }

    const shiftStart = getShiftStart(now)
    const lateMinutes = Math.max(0, minutesBetween(shiftStart, now))

    const attendance = await prisma.$transaction(async (tx) => {
      const created = await tx.attendance.create({
        data: {
          employeeId,
          workDate,
          checkIn: now,
          lateMinutes,
          status: lateMinutes > 0 ? "LATE" : "PRESENT",
          checkInPhotoUrl: photo,
          checkInLatitude: latitude,
          checkInLongitude: longitude,
          checkInDistanceMeters: distanceMeters,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: access.user.tenantId,
          userId: access.user.id,
          action: "attendance.checked_in",
          entityType: "Attendance",
          entityId: created.id,
          metadata: {
            employeeId,
            workDate,
            lateMinutes,
            latitude,
            longitude,
            distanceMeters,
            locationLabel: locationConfig.label,
          },
        },
      })

      return created
    })

    return jsonResponse(attendance, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

## app\api\attendance\check-out\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { authorizeRequest } from "@/lib/access"
import { ensureCheckoutAfterCheckin, getWorkDate } from "@/lib/attendance"
import { AppError, handleApiError, jsonResponse, readJsonBody } from "@/lib/http"
import { assertPayrollPeriodOpenForDate } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { asTrimmedString } from "@/lib/validators"

type CheckOutBody = {
  employeeId?: unknown
}

export async function POST(req: Request) {
  try {
    const access = await authorizeRequest({
      roles: ROLE_GROUPS.attendanceManage,
    })
    const body = await readJsonBody<CheckOutBody>(req)
    const employeeId = asTrimmedString(body.employeeId, "employeeId")
    const now = new Date()
    const workDate = getWorkDate(now)

    await assertPayrollPeriodOpenForDate(access.user.tenantId, workDate)

    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        tenantId: access.user.tenantId,
        active: true,
      },
    })

    if (!employee) {
      throw new AppError("Employee not found", 404, "NOT_FOUND")
    }

    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: {
        workDate: "desc",
      },
    })

    if (!attendance?.checkIn) {
      throw new AppError("ยังไม่ได้ check-in วันนี้", 400, "CHECKIN_NOT_FOUND")
    }

    if (attendance.workDate.getTime() !== workDate.getTime()) {
      throw new AppError(
        "พบรายการลงเวลาเดิมที่ยังไม่ปิดงาน กรุณาตรวจสอบก่อน",
        409,
        "OPEN_ATTENDANCE_OUTSIDE_TODAY",
      )
    }

    const workedMinutes = ensureCheckoutAfterCheckin(attendance.checkIn, now)

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAttendance = await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: now,
          workedMinutes,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: access.user.tenantId,
          userId: access.user.id,
          action: "attendance.checked_out",
          entityType: "Attendance",
          entityId: updatedAttendance.id,
          metadata: {
            employeeId,
            workDate,
            workedMinutes,
          },
        },
      })

      return updatedAttendance
    })

    return jsonResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
```

## app\api\attendance\corrections\route.ts

```ts
import { createAttendanceCorrection, getAttendanceCorrectionList } from "@/lib/attendance-correction"
import { jsonResponse, readJsonBody, AppError } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import {
  asAttendanceStatus,
  asAction,
  asOptionalBusinessDate,
  asOptionalSearchString,
  asTrimmedString,
} from "@/lib/validators"

type AttendanceCorrectionBody = {
  attendanceId?: unknown
  requestedCheckIn?: unknown
  requestedCheckOut?: unknown
  requestedStatus?: unknown
  requestedWorkDate?: unknown
  reason?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const search = asOptionalSearchString(searchParams.get("search"))
    const statusParam = asOptionalSearchString(searchParams.get("status"))
    const status =
      statusParam === undefined
        ? undefined
        : (asAction(statusParam, ["PENDING", "APPROVED", "REJECTED"]) as
            | "PENDING"
            | "APPROVED"
            | "REJECTED")

    const items = await getAttendanceCorrectionList(access.user.tenantId, {
      search,
      status,
    })
    return jsonResponse({ items })
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.attendanceManage,
  },
  async (req, _context, access) => {
    const body = await readJsonBody<AttendanceCorrectionBody>(req)
    const attendanceId = asTrimmedString(body.attendanceId, "attendanceId")
    const reason = asTrimmedString(body.reason, "reason")
    const requestedCheckIn = asOptionalBusinessDate(body.requestedCheckIn)
    const requestedCheckOut = asOptionalBusinessDate(body.requestedCheckOut)
    const requestedWorkDate = asOptionalBusinessDate(body.requestedWorkDate)
    const requestedStatus =
      body.requestedStatus === undefined || body.requestedStatus === null || body.requestedStatus === ""
        ? undefined
        : asAttendanceStatus(body.requestedStatus)

    if (
      !requestedCheckIn &&
      !requestedCheckOut &&
      !requestedWorkDate &&
      requestedStatus === undefined
    ) {
      throw new AppError(
        "At least one correction field must be provided",
        400,
        "INVALID_INPUT",
      )
    }

    if (requestedCheckIn && requestedCheckOut && requestedCheckOut <= requestedCheckIn) {
      throw new AppError(
        "requestedCheckOut must be after requestedCheckIn",
        400,
        "INVALID_INPUT",
      )
    }

    const correction = await createAttendanceCorrection({
      tenantId: access.user.tenantId,
      attendanceId,
      requestedByUserId: access.user.id,
      requestedCheckIn,
      requestedCheckOut,
      requestedStatus,
      requestedWorkDate,
      reason,
    })

    return jsonResponse(correction, 201)
  },
)
```

## app\api\attendance\corrections\[id]\route.ts

`FILE NOT FOUND`

## app\api\audit\route.ts

```ts
import { getAuditLogList } from "@/lib/audit"
import { jsonResponse } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.auditView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const logs = await getAuditLogList(access.user.tenantId, {
      limit: Number(searchParams.get("limit") ?? 50),
      entityType: searchParams.get("entityType") ?? undefined,
      action: searchParams.get("action") ?? undefined,
      userId: searchParams.get("userId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    })

    return jsonResponse({
      items: logs,
    })
  },
)
```

## app\api\ops\summary\route.ts

```ts
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { ROLE_GROUPS } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { getBusinessDateStart } from "@/lib/time"
import {
  asMeterRadius,
  asOptionalLatitude,
  asOptionalLongitude,
  asPayrollPayday,
} from "@/lib/validators"

type OpsSettingsBody = {
  payrollPayday?: unknown
  latitude?: unknown
  longitude?: unknown
  allowedRadiusMeters?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (_req, _context, access) => {
    const tenantId = access.user.tenantId
    const today = getBusinessDateStart(new Date())
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)

    await prisma.$queryRaw`SELECT 1`

    const [tenant, activeEmployees, pendingCorrections, lockedPayrollPeriods, openAttendanceShifts, auditEventsLast24h, checkedInToday] =
      await Promise.all([
        prisma.tenant.findUnique({
          where: {
            id: tenantId,
          },
          select: {
            payrollPayday: true,
            latitude: true,
            longitude: true,
            allowedRadiusMeters: true,
          },
        }),
        prisma.employee.count({
          where: {
            tenantId,
            active: true,
          },
        }),
        prisma.attendanceCorrection.count({
          where: {
            tenantId,
            status: "PENDING",
          },
        }),
        prisma.payrollPeriod.count({
          where: {
            tenantId,
            status: "LOCKED",
          },
        }),
        prisma.attendance.count({
          where: {
            checkIn: {
              not: null,
            },
            checkOut: null,
            employee: {
              tenantId,
            },
          },
        }),
        prisma.auditLog.count({
          where: {
            tenantId,
            createdAt: {
              gte: last24Hours,
            },
          },
        }),
        prisma.attendance.count({
          where: {
            workDate: today,
            checkIn: {
              not: null,
            },
            employee: {
              tenantId,
              active: true,
            },
          },
        }),
      ])

    if (!tenant) {
      throw new AppError("Tenant not found", 404, "NOT_FOUND")
    }

    return jsonResponse({
      app: "up",
      database: "up",
      nodeEnv: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "0.0.0",
      timestamp: new Date().toISOString(),
      activeEmployees,
      pendingCorrections,
      lockedPayrollPeriods,
      openAttendanceShifts,
      auditEventsLast24h,
      checkedInToday,
      settings: {
        payrollPayday: tenant.payrollPayday,
        latitude: tenant.latitude,
        longitude: tenant.longitude,
        allowedRadiusMeters: tenant.allowedRadiusMeters,
      },
      subscription: access.subscription,
    })
  },
)

export const PUT = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.opsView,
  },
  async (req, _context, access) => {
    const body = await readJsonBody<OpsSettingsBody>(req)
    const payrollPayday = asPayrollPayday(body.payrollPayday)
    const latitude = asOptionalLatitude(body.latitude)
    const longitude = asOptionalLongitude(body.longitude)
    const allowedRadiusMeters = asMeterRadius(body.allowedRadiusMeters)

    if ((latitude === null) !== (longitude === null)) {
      throw new AppError(
        "กรุณากรอกละติจูดและลองจิจูดให้ครบทั้งคู่",
        400,
        "INVALID_INPUT",
      )
    }

    const updatedTenant = await prisma.tenant.update({
      where: {
        id: access.user.tenantId,
      },
      data: {
        payrollPayday,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    await createAuditLog({
      tenantId: access.user.tenantId,
      userId: access.user.id,
      action: "ops.settings_updated",
      entityType: "Tenant",
      entityId: updatedTenant.id,
      metadata: {
        payrollPayday,
        latitude,
        longitude,
        allowedRadiusMeters,
      },
    })

    return jsonResponse({
      ok: true,
      settings: {
        payrollPayday: updatedTenant.payrollPayday,
        latitude: updatedTenant.latitude,
        longitude: updatedTenant.longitude,
        allowedRadiusMeters: updatedTenant.allowedRadiusMeters,
      },
    })
  },
)
```

## app\api\payroll\run\route.ts

```ts
import { AppError, jsonResponse, readJsonBody } from "@/lib/http"
import { getPayrollResult, savePayrollPeriod, unlockPayrollPeriod } from "@/lib/payroll"
import { ROLE_GROUPS } from "@/lib/role"
import { hasAnyRole } from "@/lib/role"
import { withAuthorizedRoute } from "@/lib/route-guard"
import { asAction, asMonth, asOptionalTrimmedString, asYear } from "@/lib/validators"

type PayrollRunBody = {
  month?: unknown
  year?: unknown
  action?: unknown
  reason?: unknown
}

export const GET = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollView,
  },
  async (req, _context, access) => {
    const { searchParams } = new URL(req.url)
    const now = new Date()
    const month = asMonth(searchParams.get("month"), now.getMonth() + 1)
    const year = asYear(searchParams.get("year"), now.getFullYear())

    return jsonResponse(await getPayrollResult(access.user.tenantId, month, year))
  },
)

export const POST = withAuthorizedRoute(
  {
    roles: ROLE_GROUPS.payrollManage,
  },
  async (req, _context, access) => {
    const now = new Date()
    const body = await readJsonBody<PayrollRunBody>(req)
    const month = asMonth(body.month, now.getMonth() + 1)
    const year = asYear(body.year, now.getFullYear())
    const action = asAction(body.action, ["save", "lock", "unlock"]) as
      | "save"
      | "lock"
      | "unlock"

    if (action === "unlock") {
      if (!hasAnyRole(access.user.role, ROLE_GROUPS.payrollUnlock)) {
        throw new AppError("Forbidden", 403, "FORBIDDEN")
      }

      const reason = asOptionalTrimmedString(body.reason)

      if (!reason) {
        throw new AppError(
          "Unlock reason is required",
          400,
          "UNLOCK_REASON_REQUIRED",
        )
      }

      return jsonResponse(
        await unlockPayrollPeriod({
          tenantId: access.user.tenantId,
          userId: access.user.id,
          month,
          year,
          reason,
        }),
      )
    }

    return jsonResponse(
      await savePayrollPeriod({
        tenantId: access.user.tenantId,
        userId: access.user.id,
        month,
        year,
        action,
      }),
    )
  },
)
```

## app\login\page.tsx

```tsx
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (!result) {
      setError("ไม่สามารถเชื่อมต่อระบบล็อกอินได้")
      return
    }

    if (result.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="login-shell">
      <form onSubmit={handleSubmit} className="panel login-card">
        <div className="badge">Cafe SaaS</div>
        <h1>เข้าสู่ระบบร้านกาแฟ</h1>
        <p>ระบบ attendance, payroll และ subscription สำหรับหลายสาขา</p>

        <div className="field">
          <label htmlFor="email">อีเมล</label>
          <input
            id="email"
            type="email"
            placeholder="owner@demo.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input
            id="password"
            type="password"
            placeholder="demo1234"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error ? <div className="message message-error">{error}</div> : null}

        <div className="action-row">
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
          </button>
        </div>
      </form>
    </div>
  )
}
```

## app\subscription-expired\page.tsx

```tsx
"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function SubscriptionExpiredPage() {
  const router = useRouter()

  return (
    <div className="login-shell">
      <div className="panel login-card">
        <div className="badge">Subscription</div>
        <h1>การสมัครใช้งานหมดอายุแล้ว</h1>
        <p>กรุณาต่ออายุแพ็กเกจก่อนกลับไปใช้งาน dashboard และโมดูลเงินเดือน</p>

        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push("/login")}>
            กลับหน้าเข้าสู่ระบบ
          </button>
          <button
            className="btn btn-primary"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}

// End of file
```

## app\dashboard\page.tsx

```tsx
'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type CurrentUser = {
  id: string
  email: string
  role: string
  tenantId: string
}

type Summary = {
  totalEmployees: number
  checkedInToday: number
  checkedOutToday: number
  absentToday: number
  subscription: {
    plan: string
    status: string
    expiresAt: string | null
    daysRemaining: number | null
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    Promise.all([
      fetch('/api/me').then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      }),
      fetch('/api/dashboard-summary').then((res) => {
        if (!res.ok) throw new Error('summary')
        return res.json()
      }),
    ])
      .then(([currentUser, summaryData]) => {
        if (!mounted) return
        setUser(currentUser)
        setSummary(summaryData)
        setLoading(false)
      })
      .catch((error: Error) => {
        if (!mounted) return
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })

    return () => {
      mounted = false
    }
  }, [router])

  if (loading) {
    return <div className="page">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">สิทธิ์: {user.role}</div>
            <div className="badge">รหัสร้าน: {user.tenantId}</div>
          </div>
          <h1 className="hero-title">หน้าแรกของร้าน</h1>
          <p className="hero-subtitle">
            ดูภาพรวมพนักงาน การลงเวลา และงานที่ต้องจัดการในแต่ละวันได้จากหน้านี้
          </p>
        </div>

        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/employees')}>
            พนักงาน
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
            ลงเวลาเข้าออก
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/history')}
          >
            ดูประวัติ
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            แก้เวลา
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/payroll')}>
            เงินเดือน
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
            ตั้งค่าร้าน
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/audit')}>
            ประวัติระบบ
          </button>
          <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/login' })}>
            ออกจากระบบ
          </button>
        </div>
      </section>

      {!summary ? (
        <div className="panel">กำลังโหลดข้อมูล dashboard...</div>
      ) : (
        <>
          <section className="grid stats">
            <article className="stat-card">
              <p className="stat-label">พนักงานที่ใช้งานอยู่</p>
              <p className="stat-value">{summary.totalEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">เข้างานแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ออกงานแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedOutToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ยังไม่มีการลงเวลา</p>
              <p className="stat-value">{summary.absentToday}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">สถานะ Subscription</h2>
            <p className="panel-subtitle">
              แพ็กเกจ {summary.subscription.plan} / สถานะ {summary.subscription.status}
            </p>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                วันคงเหลือ: {summary.subscription.daysRemaining ?? 'ไม่ได้กำหนด'}
              </div>
              <div className="badge">
                หมดอายุ:{' '}
                {summary.subscription.expiresAt
                  ? new Date(summary.subscription.expiresAt).toLocaleDateString('th-TH')
                  : 'ไม่ได้กำหนด'}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">เมนูที่ใช้บ่อย</h2>
            <div className="action-row" style={{ marginTop: 14 }}>
              <button
                className="btn btn-secondary"
                onClick={() => router.push('/attendance/corrections')}
              >
                ดูคำขอแก้เวลา
              </button>
              <button className="btn btn-secondary" onClick={() => router.push('/audit')}>
                ดูประวัติระบบ
              </button>
              <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
                ตั้งค่าร้าน
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
```

## app\employees\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type EmployeeRow = {
  id: string
  code: string
  firstName: string
  lastName: string
  phone: string | null
  position: string
  employeeType: 'FULL_TIME' | 'PART_TIME'
  payType: 'MONTHLY' | 'DAILY' | 'HOURLY'
  baseSalary: number | null
  dailyRate: number | null
  hourlyRate: number | null
  active: boolean
  startDate: string
  bank: {
    bankName: string
    accountName: string
    accountNumber: string
    promptPayId: string | null
  } | null
}

type CurrentUser = {
  role: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    code: '',
    firstName: '',
    lastName: '',
    phone: '',
    position: '',
    employeeType: 'FULL_TIME',
    payType: 'MONTHLY',
    baseSalary: '',
    dailyRate: '',
    hourlyRate: '',
    startDate: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    promptPayId: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'HR'

  const fetchEmployees = () => {
    fetch('/api/employees?includeInactive=true')
      .then((res) => res.json())
      .then((data) => setEmployees(data))
  }

  useEffect(() => {
    let mounted = true

    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then((data) => {
        if (!mounted) return
        setUser(data)
        fetchEmployees()
        setLoading(false)
      })
      .catch((error: Error) => {
        if (!mounted) return
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })

    return () => {
      mounted = false
    }
  }, [router])

  const resetForm = () => {
    setEditId(null)
    setForm({
      code: '',
      firstName: '',
      lastName: '',
      phone: '',
      position: '',
      employeeType: 'FULL_TIME',
      payType: 'MONTHLY',
      baseSalary: '',
      dailyRate: '',
      hourlyRate: '',
      startDate: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
      promptPayId: '',
    })
    setMessage('')
    setError('')
  }

  const handleEditClick = (emp: EmployeeRow) => {
    setEditId(emp.id)
    setForm({
      code: emp.code,
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone ?? '',
      position: emp.position,
      employeeType: emp.employeeType,
      payType: emp.payType,
      baseSalary: emp.baseSalary?.toString() ?? '',
      dailyRate: emp.dailyRate?.toString() ?? '',
      hourlyRate: emp.hourlyRate?.toString() ?? '',
      startDate: emp.startDate.slice(0, 10),
      bankName: emp.bank?.bankName ?? '',
      accountName: emp.bank?.accountName ?? '',
      accountNumber: emp.bank?.accountNumber ?? '',
      promptPayId: emp.bank?.promptPayId ?? '',
    })
    setMessage('')
    setError('')
  }

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('ยืนยันการลบพนักงาน? การลบนี้จะเป็นการระงับใช้งานเท่านั้น')
    if (!confirmDelete) return

    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'ลบพนักงานไม่สำเร็จ')
      return
    }

    setMessage('พนักงานถูกระงับใช้งานแล้ว')
    fetchEmployees()
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!form.firstName || !form.lastName || !form.position) {
      setError('กรุณากรอกข้อมูลให้ครบทุกช่อง')
      return
    }

    let url = '/api/employees'
    let method = 'POST'
    if (editId) {
      url = `/api/employees/${editId}`
      method = 'PATCH'
    }

    const body: any = {
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      position: form.position,
      employeeType: form.employeeType,
      payType: form.payType,
      baseSalary: form.baseSalary,
      dailyRate: form.dailyRate,
      hourlyRate: form.hourlyRate,
      startDate: form.startDate || undefined,
      bankName: form.bankName,
      accountName: form.accountName,
      accountNumber: form.accountNumber,
      promptPayId: form.promptPayId,
    }

    if (!editId) {
      if (!form.code) {
        setError('กรุณากรอกรหัสพนักงาน')
        return
      }
      body.code = form.code
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'บันทึกข้อมูลไม่สำเร็จ')
      return
    }

    if (editId) {
      setMessage('แก้ไขพนักงานสำเร็จ')
    } else {
      setMessage('เพิ่มพนักงานสำเร็จ')
    }

    fetchEmployees()
    resetForm()
  }

  if (loading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">พนักงานทั้งหมด {employees.length} รายการ</div>
            <div className="badge">สิทธิ์ {user?.role}</div>
          </div>
          <h1 className="hero-title">จัดการพนักงาน</h1>
          <p className="hero-subtitle">เพิ่มข้อมูลพนักงานและบัญชีรับเงินให้พร้อมใช้ในงานจริงทั้งหน้าร้านและงานโอนเงิน</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
        </div>
      </section>

      {canManage ? (
        <section className="panel">
          <h2 className="panel-title">{editId ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-grid" style={{ marginTop: 16 }}>
              {!editId ? (
                <div className="field">
                  <label>รหัสพนักงาน</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="field">
                <label>ชื่อจริง</label>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>นามสกุล</label>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>เบอร์โทร</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ตำแหน่ง</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ประเภทพนักงาน</label>
                <select
                  value={form.employeeType}
                  onChange={(e) => setForm({ ...form, employeeType: e.target.value as 'FULL_TIME' | 'PART_TIME' })}
                >
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </div>
              <div className="field">
                <label>รูปแบบจ่ายเงิน</label>
                <select
                  value={form.payType}
                  onChange={(e) => setForm({ ...form, payType: e.target.value as 'MONTHLY' | 'DAILY' | 'HOURLY' })}
                >
                  <option value="MONTHLY">รายเดือน</option>
                  <option value="DAILY">รายวัน</option>
                  <option value="HOURLY">รายชั่วโมง</option>
                </select>
              </div>
              <div className="field">
                <label>เงินเดือนฐาน</label>
                <input
                  type="number"
                  value={form.baseSalary}
                  onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ค่าแรงรายวัน</label>
                <input
                  type="number"
                  value={form.dailyRate}
                  onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ค่าแรงรายชั่วโมง</label>
                <input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>วันเริ่มงาน</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>ธนาคาร</label>
                <input
                  value={form.bankName}
                  onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                  placeholder="เช่น SCB"
                />
              </div>
              <div className="field">
                <label>ชื่อบัญชี</label>
                <input
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>เลขบัญชี</label>
                <input
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                />
              </div>
              <div className="field">
                <label>พร้อมเพย์</label>
                <input
                  value={form.promptPayId}
                  onChange={(e) => setForm({ ...form, promptPayId: e.target.value })}
                  placeholder="เบอร์โทรหรือเลขบัตร"
                />
              </div>
            </div>

            <div className="action-row" style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                {editId ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
              </button>
              {editId ? (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  ยกเลิก
                </button>
              ) : null}
            </div>
          </form>

          {message ? <div className="message message-success">{message}</div> : null}
          {error ? <div className="message message-error">{error}</div> : null}
        </section>
      ) : (
        <section className="panel">
          <h2 className="panel-title">สิทธิ์ของคุณเป็นแบบอ่านอย่างเดียว</h2>
          <p className="panel-subtitle">สามารถดูข้อมูลพนักงานได้ แต่ไม่สามารถเพิ่มหรือแก้ไขได้</p>
        </section>
      )}

      <section className="panel">
        <h2 className="panel-title">รายชื่อพนักงาน</h2>
        <div className="table-wrap desktop-only">
          <table className="data-table">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>ตำแหน่ง</th>
                <th>รูปแบบจ่าย</th>
                <th>อัตราค่าจ้าง</th>
                <th>ข้อมูลรับเงิน</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.code}</td>
                  <td>{emp.firstName} {emp.lastName}</td>
                  <td>{emp.position}</td>
                  <td>{emp.payType}</td>
                  <td>
                    {emp.payType === 'MONTHLY' ? `${emp.baseSalary ?? 0} บาท/เดือน` : null}
                    {emp.payType === 'DAILY' ? `${emp.dailyRate ?? 0} บาท/วัน` : null}
                    {emp.payType === 'HOURLY' ? `${emp.hourlyRate ?? 0} บาท/ชั่วโมง` : null}
                  </td>
                  <td>
                    <div>{emp.bank?.bankName ?? 'ยังไม่ได้กรอก'}</div>
                    <div className="table-meta">{emp.bank?.accountNumber ?? '-'}</div>
                    <div className="table-meta">พร้อมเพย์: {emp.bank?.promptPayId ?? '-'}</div>
                  </td>
                  <td>
                    <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                      {emp.active ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}
                    </span>
                  </td>
                  <td>
                    <div className="action-row">
                      {canManage ? (
                        <>
                          <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                            แก้ไข
                          </button>
                          {emp.active ? (
                            <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                              ระงับ
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="badge">ดูข้อมูลเท่านั้น</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-card-list mobile-only">
          {employees.map((emp) => (
            <article key={emp.id} className="record-card">
              <div className="record-card-head">
                <strong>{emp.firstName} {emp.lastName}</strong>
                <span className={`status-pill ${emp.active ? 'success' : 'danger'}`}>
                  {emp.active ? 'ใช้งานอยู่' : 'ระงับใช้งาน'}
                </span>
              </div>
              <div className="record-card-body">
                <div className="record-line"><span>รหัส</span><strong>{emp.code}</strong></div>
                <div className="record-line"><span>ตำแหน่ง</span><strong>{emp.position}</strong></div>
                <div className="record-line"><span>รูปแบบจ่าย</span><strong>{emp.payType}</strong></div>
                <div className="record-line">
                  <span>บัญชีรับเงิน</span>
                  <strong>{emp.bank?.bankName ?? 'ยังไม่ได้กรอก'}</strong>
                </div>
                <div className="record-line"><span>เลขบัญชี</span><strong>{emp.bank?.accountNumber ?? '-'}</strong></div>
                <div className="record-line"><span>พร้อมเพย์</span><strong>{emp.bank?.promptPayId ?? '-'}</strong></div>
              </div>
              <div className="action-row" style={{ marginTop: 12 }}>
                {canManage ? (
                  <>
                    <button className="btn btn-secondary" onClick={() => handleEditClick(emp)}>
                      แก้ข้อมูล
                    </button>
                    {emp.active ? (
                      <button className="btn btn-danger" onClick={() => handleDelete(emp.id)}>
                        ระงับใช้งาน
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span className="badge">ดูข้อมูลเท่านั้น</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
```

## app\attendance\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type EmployeeOption = {
  id: string
  code: string
  firstName: string
  lastName: string
  active: boolean
}

type BrowserLocation = {
  latitude: number
  longitude: number
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

function getCurrentPosition() {
  return new Promise<BrowserLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('กรุณาเปิดตำแหน่งก่อนลงเวลา')),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    )
  })
}

export default function AttendancePage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [message, setMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [locationLabel, setLocationLabel] = useState('ยังไม่ได้อ่านตำแหน่ง')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then(() =>
        fetch('/api/employees')
          .then((res) => res.json())
          .then((data) => setEmployees(data))
          .catch(() => setEmployees([])),
      )
      .then(() => setPageLoading(false))
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  const clearMessages = () => {
    setMessage('')
    setStatusMessage('')
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPhotoDataUrl(dataUrl)
      setPhotoName(file.name)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'แนบรูปไม่สำเร็จ')
    }
  }

  const handleCheckIn = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage('กรุณาเลือกพนักงานก่อน')
      return
    }
    if (!photoDataUrl) {
      setMessage('กรุณาถ่ายรูปก่อนบันทึกเข้างาน')
      return
    }
    setLoading(true)

    try {
      const location = await getCurrentPosition()
      setLocationLabel(`ละติจูด ${location.latitude.toFixed(5)} / ลองจิจูด ${location.longitude.toFixed(5)}`)

      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          photo: photoDataUrl,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(data.error || 'บันทึกเข้างานไม่สำเร็จ')
      } else {
        setStatusMessage('บันทึกเข้างานเรียบร้อยแล้ว')
        setPhotoDataUrl('')
        setPhotoName('')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกเข้างานไม่สำเร็จ')
    }

    setLoading(false)
  }

  const handleCheckOut = async () => {
    clearMessages()
    if (!selectedEmployee) {
      setMessage('กรุณาเลือกพนักงานก่อน')
      return
    }
    setLoading(true)
    const res = await fetch('/api/attendance/check-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: selectedEmployee }),
    })

    const data = await res.json()

    if (!res.ok) {
      setMessage(data.error || 'บันทึกออกงานไม่สำเร็จ')
    } else {
      setStatusMessage('บันทึกออกงานเรียบร้อยแล้ว')
    }
    setLoading(false)
  }

  if (pageLoading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">พนักงานที่เลือก: {selectedEmployee ? 'พร้อมลงเวลา' : 'ยังไม่ได้เลือก'}</div>
            <div className="badge">ต้องถ่ายรูปและเปิดตำแหน่งก่อนเข้างาน</div>
          </div>
          <h1 className="hero-title">ลงเวลาเข้าออกงาน</h1>
          <p className="hero-subtitle">เหมาะกับการใช้งานหน้าร้านบนมือถือ กดง่าย อ่านง่าย และตรวจรูปกับตำแหน่งก่อนบันทึก</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance/history')}>
            ดูประวัติ
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">ลงเวลาเข้างาน</h2>
        <div className="field" style={{ marginTop: 14 }}>
          <label>พนักงานที่ต้องการลงเวลา</label>
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            disabled={loading}
          >
            <option value="">เลือกพนักงาน</option>
            {employees
              .filter((emp) => emp.active)
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} - {emp.firstName} {emp.lastName}
                </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>ถ่ายรูปหน้าพนักงานก่อนบันทึก</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            disabled={loading}
          />
          {photoName ? <div className="table-meta">ไฟล์ล่าสุด: {photoName}</div> : null}
          {photoDataUrl ? (
            <img
              src={photoDataUrl}
              alt="ตัวอย่างรูปก่อนลงเวลา"
              className="photo-preview"
            />
          ) : null}
        </div>

        <div className="badge-row" style={{ marginTop: 14 }}>
          <div className="badge">สถานะตำแหน่ง: {locationLabel}</div>
        </div>

        <div className="action-row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={handleCheckIn} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกเข้างาน'}
          </button>
          <button className="btn btn-secondary" onClick={handleCheckOut} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'บันทึกออกงาน'}
          </button>
        </div>

        {message ? <div className="message message-error">{message}</div> : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
      </section>
    </div>
  )
}
```

## app\attendance\history\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type AttendanceRecord = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  status: string
  employee: {
    id: string
    code: string
    firstName: string
    lastName: string
  }
}

export default function AttendanceHistoryPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then(() => {
        setLoading(true)
        return fetch('/api/attendance')
          .then((res) => res.json())
          .then((data) => {
            setRecords(data)
            setLoading(false)
          })
          .catch(() => {
            setRecords([])
            setLoading(false)
          })
      })
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  if (loading) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">ย้อนหลังล่าสุด 90 รายการ</div>
          </div>
          <h1 className="hero-title">ประวัติการลงเวลา</h1>
          <p className="hero-subtitle">สำหรับเจ้าของร้าน ฝ่ายบุคคล และการตรวจสอบย้อนหลัง</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/attendance')}>
            กลับหน้าลงเวลา
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            ขอแก้ไขเวลา
          </button>
        </div>
      </section>

      <section className="panel">
        {records.length === 0 ? (
          <div className="empty-state">ไม่มีบันทึกการลงเวลา</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัสพนักงาน</th>
                  <th>ชื่อพนักงาน</th>
                  <th>วันที่</th>
                  <th>เวลาเข้า</th>
                  <th>เวลาออก</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employee.code}</td>
                    <td>{`${r.employee.firstName} ${r.employee.lastName}`}</td>
                    <td>{new Date(r.workDate).toLocaleDateString('th-TH')}</td>
                    <td>{r.checkIn ? new Date(r.checkIn).toLocaleTimeString('th-TH') : '-'}</td>
                    <td>{r.checkOut ? new Date(r.checkOut).toLocaleTimeString('th-TH') : '-'}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          r.status === 'LATE'
                            ? 'warning'
                            : r.status === 'ABSENT'
                              ? 'danger'
                              : 'success'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

## app\attendance\corrections\page.tsx

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type AttendanceRecord = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  status: string
  employee: {
    id: string
    code: string
    firstName: string
    lastName: string
    position: string
  }
}

type CorrectionItem = {
  id: string
  attendanceId: string
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  requestedStatus: string | null
  requestedWorkDate: string | null
  reason: string
  reviewNote: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  attendance: AttendanceRecord
}

type CurrentUser = {
  role: string
}

export default function AttendanceCorrectionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [corrections, setCorrections] = useState<CorrectionItem[]>([])
  const [selectedAttendanceId, setSelectedAttendanceId] = useState('')
  const [requestedCheckIn, setRequestedCheckIn] = useState('')
  const [requestedCheckOut, setRequestedCheckOut] = useState('')
  const [requestedWorkDate, setRequestedWorkDate] = useState('')
  const [requestedStatus, setRequestedStatus] = useState('')
  const [reason, setReason] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canApprove = useMemo(
    () => user?.role === 'OWNER' || user?.role === 'ADMIN',
    [user],
  )

  const loadData = async () => {
    const correctionParams = new URLSearchParams()
    if (search.trim()) {
      correctionParams.set('search', search.trim())
    }
    if (statusFilter !== 'ALL') {
      correctionParams.set('status', statusFilter)
    }

    const [attendanceRes, correctionsRes] = await Promise.all([
      fetch('/api/attendance'),
      fetch(`/api/attendance/corrections?${correctionParams.toString()}`),
    ])

    const attendanceData = await attendanceRes.json()
    const correctionData = await correctionsRes.json()

    if (!attendanceRes.ok) {
      throw new Error(attendanceData.error || 'โหลด attendance ไม่สำเร็จ')
    }

    if (!correctionsRes.ok) {
      throw new Error(correctionData.error || 'โหลด correction requests ไม่สำเร็จ')
    }

    setRecords(attendanceData)
    setCorrections(correctionData.items ?? [])
  }

  useEffect(() => {
    fetch('/api/me')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then(async (currentUser) => {
        setUser(currentUser)
        await loadData()
        setLoading(false)
      })
      .catch((error: Error) => {
        if (error.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        router.push('/login')
      })
  }, [router])

  useEffect(() => {
    if (!user) {
      return
    }

    loadData().catch((error: Error) => {
      setError(error.message)
    })
  }, [search, statusFilter])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: selectedAttendanceId,
          requestedCheckIn: requestedCheckIn || undefined,
          requestedCheckOut: requestedCheckOut || undefined,
          requestedWorkDate: requestedWorkDate || undefined,
          requestedStatus: requestedStatus || undefined,
          reason,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'สร้าง correction request ไม่สำเร็จ')
      }

      setMessage('ส่งคำขอแก้ไขเวลาเรียบร้อยแล้ว')
      setSelectedAttendanceId('')
      setRequestedCheckIn('')
      setRequestedCheckOut('')
      setRequestedWorkDate('')
      setRequestedStatus('')
      setReason('')
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      if (decision === 'REJECTED' && !reviewNote.trim()) {
        throw new Error('กรุณากรอกหมายเหตุเมื่อปฏิเสธคำขอ')
      }

      const res = await fetch(`/api/attendance/corrections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewNote: reviewNote || undefined,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'รีวิว correction request ไม่สำเร็จ')
      }

      setMessage(
        decision === 'APPROVED'
          ? 'อนุมัติคำขอแก้ไขเรียบร้อยแล้ว'
          : 'ปฏิเสธคำขอแก้ไขเรียบร้อยแล้ว',
      )
      setReviewNote('')
      await loadData()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">Correction requests {corrections.length}</div>
            <div className="badge">Approval by OWNER / ADMIN</div>
          </div>
          <h1 className="hero-title">Attendance Corrections</h1>
          <p className="hero-subtitle">
            ส่งคำขอแก้ไขเวลาและตรวจอนุมัติย้อนหลังโดยยังคง audit trail ครบถ้วน
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/attendance/history')}>
            กลับประวัติลงเวลา
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">ส่งคำขอแก้ไขเวลา</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <div className="field">
              <label>Attendance record</label>
              <select
                value={selectedAttendanceId}
                onChange={(event) => setSelectedAttendanceId(event.target.value)}
              >
                <option value="">เลือกบันทึกที่ต้องการแก้ไข</option>
                {records.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.employee.code} - {record.employee.firstName} {record.employee.lastName} -{' '}
                    {new Date(record.workDate).toLocaleDateString('th-TH')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>วันที่ใหม่</label>
              <input
                type="date"
                value={requestedWorkDate}
                onChange={(event) => setRequestedWorkDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาเข้าใหม่</label>
              <input
                type="datetime-local"
                value={requestedCheckIn}
                onChange={(event) => setRequestedCheckIn(event.target.value)}
              />
            </div>
            <div className="field">
              <label>เวลาออกใหม่</label>
              <input
                type="datetime-local"
                value={requestedCheckOut}
                onChange={(event) => setRequestedCheckOut(event.target.value)}
              />
            </div>
            <div className="field">
              <label>สถานะใหม่</label>
              <select
                value={requestedStatus}
                onChange={(event) => setRequestedStatus(event.target.value)}
              >
                <option value="">ใช้สถานะเดิม</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="ABSENT">ABSENT</option>
                <option value="LEAVE">LEAVE</option>
                <option value="DAY_OFF">DAY_OFF</option>
              </select>
            </div>
            <div className="field">
              <label>เหตุผล</label>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="เช่น ลืมกดออกงาน"
              />
            </div>
          </div>
          <div className="action-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังส่ง...' : 'ส่งคำขอแก้ไข'}
            </button>
          </div>
        </form>
        {message ? <div className="message message-success">{message}</div> : null}
        {error ? <div className="message message-error">{error}</div> : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">รายการคำขอแก้ไข</h2>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>ค้นหา</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาจากรหัส, ชื่อ, เหตุผล"
            />
          </div>
          <div className="field" style={{ maxWidth: 220 }}>
            <label>สถานะคำขอ</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">ทั้งหมด</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>หมายเหตุสำหรับการอนุมัติ/ปฏิเสธ</label>
            <input
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="กรอก note สำหรับ review"
            />
          </div>
        </div>
        {corrections.length === 0 ? (
          <div className="empty-state">ยังไม่มี correction requests</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>พนักงาน</th>
                  <th>วันที่เดิม</th>
                  <th>สถานะเดิม</th>
                  <th>คำขอใหม่</th>
                  <th>เหตุผล</th>
                  <th>สถานะคำขอ</th>
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.attendance.employee.code} {item.attendance.employee.firstName}{' '}
                      {item.attendance.employee.lastName}
                      <div className="table-meta">
                        ขอเมื่อ {new Date(item.createdAt).toLocaleString('th-TH')}
                      </div>
                    </td>
                    <td>{new Date(item.attendance.workDate).toLocaleDateString('th-TH')}</td>
                    <td>{item.attendance.status}</td>
                    <td>
                      <div className="table-meta">
                        วันที่: {item.requestedWorkDate ? new Date(item.requestedWorkDate).toLocaleDateString('th-TH') : '-'}
                      </div>
                      <div className="table-meta">
                        เข้า: {item.requestedCheckIn ? new Date(item.requestedCheckIn).toLocaleString('th-TH') : '-'}
                      </div>
                      <div className="table-meta">
                        ออก: {item.requestedCheckOut ? new Date(item.requestedCheckOut).toLocaleString('th-TH') : '-'}
                      </div>
                      <div className="table-meta">สถานะ: {item.requestedStatus ?? '-'}</div>
                    </td>
                    <td>{item.reason}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.status === 'APPROVED'
                            ? 'success'
                            : item.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {canApprove && item.status === 'PENDING' ? (
                        <div className="action-row">
                          <button
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => handleReview(item.id, 'APPROVED')}
                          >
                            อนุมัติ
                          </button>
                          <button
                            className="btn btn-danger"
                            disabled={saving}
                            onClick={() => handleReview(item.id, 'REJECTED')}
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                      ) : (
                        <span className="table-meta">{item.reviewNote ?? 'ไม่มีหมายเหตุ'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

## app\payroll\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type PayrollSummaryItem = {
  employeeId: string
  employeeCode: string
  employeeName: string
  payType: string
  presentDays: number
  absentDays: number
  workedHours: number
  overtimeHours: number
  lateMinutes: number
  basePay: number
  overtimePay: number
  deduction: number
  netPay: number
  bankName: string | null
  accountName: string | null
  accountNumber: string | null
  promptPayId: string | null
  paymentStatus: string
}

type PayrollResponse = {
  month: number
  year: number
  payday: number
  periodStart: string
  periodEnd: string
  status: 'OPEN' | 'LOCKED'
  locked: boolean
  lockedAt: string | null
  lockedByUserId: string | null
  source: 'preview' | 'saved' | 'locked'
  items: PayrollSummaryItem[]
}

export default function PayrollPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<PayrollSummaryItem[]>([])
  const [userRole, setUserRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [csvReady, setCsvReady] = useState(false)
  const [periodInfo, setPeriodInfo] = useState<PayrollResponse | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const today = new Date()
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const canUnlock = userRole === 'OWNER'

  const loadPayroll = () => {
    setLoading(true)
    setErrorMessage('')
    fetch(`/api/payroll/run?month=${month}&year=${year}`)
      .then(async (res) => {
        const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'โหลด payroll ไม่สำเร็จ')
      }
      return data as PayrollResponse
      })
      .then((data: PayrollResponse) => {
        setPeriodInfo(data)
        setSummary(data.items ?? [])
        setLoading(false)
      })
      .catch((error: Error) => {
        setSummary([])
        setPeriodInfo(null)
        setErrorMessage(error.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        return res.json()
      })
      .then((currentUser) => {
        setUserRole(currentUser.role)
        loadPayroll()
      })
      .catch((error: Error) => {
        router.push(error.message === 'subscription' ? '/subscription-expired' : '/login')
      })
  }, [router])

  const persistPayroll = async (action: 'save' | 'lock' | 'unlock') => {
    setSaving(true)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const body: Record<string, unknown> = {
        month: Number(month),
        year: Number(year),
        action,
      }

      if (action === 'unlock') {
        body.reason = unlockReason
      }

      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'บันทึก payroll ไม่สำเร็จ')
      }

      setPeriodInfo(data)
      setSummary(data.items ?? [])
      setStatusMessage(
        action === 'lock'
          ? 'บันทึกและปิดงวดเงินเดือนเรียบร้อยแล้ว'
          : action === 'unlock'
            ? 'เปิดงวดเงินเดือนกลับมาแก้ไขได้แล้ว'
            : 'บันทึกสรุปเงินเดือนเรียบร้อยแล้ว',
      )
      if (action === 'unlock') {
        setUnlockReason('')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = async () => {
    if (summary.length === 0) return

    const header = [
      'employeeCode',
      'employeeName',
      'payType',
      'presentDays',
      'absentDays',
      'workedHours',
      'overtimeHours',
      'lateMinutes',
      'basePay',
      'overtimePay',
      'deduction',
      'netPay',
      'bankName',
      'accountNumber',
      'promptPayId',
      'paymentStatus',
    ]
    const rows = summary.map(item => [
      item.employeeCode,
      item.employeeName,
      item.payType,
      item.presentDays.toString(),
      item.absentDays.toString(),
      item.workedHours.toFixed(2),
      item.overtimeHours.toFixed(2),
      item.lateMinutes.toString(),
      item.basePay.toFixed(2),
      item.overtimePay.toFixed(2),
      item.deduction.toFixed(2),
      item.netPay.toFixed(2),
      item.bankName ?? '',
      item.accountNumber ?? '',
      item.promptPayId ?? '',
      item.paymentStatus,
    ])

    const csvContent = [
      header.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `payroll_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setCsvReady(true)
  }

  if (loading && summary.length === 0) return <div className="page">Loading...</div>

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">ดูยอดรวมพนักงานทุกคนในหน้าเดียว</div>
            <div className="badge">สถานะงวด: {periodInfo?.locked ? 'ปิดงวดแล้ว' : 'ยังแก้ไขได้'}</div>
          </div>
          <h1 className="hero-title">สรุปเงินเดือน</h1>
          <p className="hero-subtitle">ดูยอดจ่ายสุทธิพร้อมข้อมูลบัญชีรับเงิน เหมาะกับการตรวจยอดและโอนเงินผ่านมือถือ</p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            ดาวน์โหลดรายการโอน
          </button>
        </div>
      </section>

      <section className="panel">
        {periodInfo ? (
          <div className="badge-row" style={{ marginBottom: 16 }}>
            <div className="badge">
              รอบเงินเดือน: {new Date(periodInfo.periodStart).toLocaleDateString('th-TH')} -{' '}
              {new Date(periodInfo.periodEnd).toLocaleDateString('th-TH')}
            </div>
            <div className="badge">วันจ่ายประจำร้าน: วันที่ {periodInfo.payday}</div>
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field">
            <label>เดือน</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>ปี</label>
            <input value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          {canUnlock ? (
            <div className="field">
              <label>เหตุผลที่ต้องเปิดงวดกลับมาแก้</label>
              <input
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="เช่น พบรายการลงเวลาผิด"
              />
            </div>
          ) : null}
        </div>
        <div className="action-row" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={loadPayroll}>
            โหลดข้อมูลใหม่
          </button>
          <button
            className="btn btn-primary"
            onClick={() => persistPayroll('save')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกยอด'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => persistPayroll('lock')}
            disabled={saving || Boolean(periodInfo?.locked)}
          >
            {saving ? 'กำลังปิดงวด...' : 'บันทึกและปิดงวด'}
          </button>
          {canUnlock ? (
            <button
              className="btn btn-secondary"
              onClick={() => persistPayroll('unlock')}
              disabled={saving || !Boolean(periodInfo?.locked) || !unlockReason.trim()}
            >
              {saving ? 'กำลังเปิดงวด...' : 'เปิดงวดกลับมาแก้'}
            </button>
          ) : null}
        </div>
        {periodInfo?.lockedAt ? (
          <div className="message message-success">
            งวดนี้ถูกปิดเมื่อ {new Date(periodInfo.lockedAt).toLocaleString('th-TH')}
          </div>
        ) : null}
        {csvReady ? <div className="message message-success">ดาวน์โหลดรายการโอนเรียบร้อยแล้ว</div> : null}
        {statusMessage ? <div className="message message-success">{statusMessage}</div> : null}
        {errorMessage ? <div className="message message-error">{errorMessage}</div> : null}
      </section>

      <section className="panel">
        {loading ? (
          <div className="empty-state">กำลังคำนวณสรุปเงินเดือน...</div>
        ) : (
          <>
            <div className="table-wrap desktop-only">
            <table className="data-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ</th>
                  <th>ประเภทจ่าย</th>
                  <th>วัน/ชั่วโมงทำงาน</th>
                  <th>ล่วงเวลา</th>
                  <th>ขาดงาน</th>
                  <th>เข้าสาย (นาที)</th>
                  <th>ค่าจ้าง</th>
                  <th>ข้อมูลรับเงิน</th>
                  <th>สถานะโอน</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.employeeId}>
                    <td>{item.employeeCode}</td>
                    <td>{item.employeeName}</td>
                    <td>{item.payType}</td>
                    <td>
                      <div>{item.presentDays} วัน</div>
                      <div className="table-meta">{item.workedHours.toFixed(2)} ชั่วโมง</div>
                    </td>
                    <td>
                      <div>{item.overtimeHours.toFixed(2)} ชั่วโมง</div>
                      <div className="table-meta">{item.overtimePay.toFixed(2)} บาท</div>
                    </td>
                    <td>{item.absentDays}</td>
                    <td>{item.lateMinutes}</td>
                    <td>
                      <div>ฐาน {item.basePay.toFixed(2)}</div>
                      <div className="table-meta">หัก {item.deduction.toFixed(2)}</div>
                      <div className="table-meta"><strong>สุทธิ {item.netPay.toFixed(2)}</strong></div>
                    </td>
                    <td>
                      <div>{item.bankName ?? 'ยังไม่ได้กรอก'}</div>
                      <div className="table-meta">{item.accountNumber ?? '-'}</div>
                      <div className="table-meta">พร้อมเพย์: {item.promptPayId ?? '-'}</div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          item.paymentStatus === 'PAID'
                            ? 'success'
                            : item.paymentStatus === 'FAILED'
                              ? 'danger'
                              : 'warning'
                        }`}
                      >
                        {item.paymentStatus === 'PAID'
                          ? 'จ่ายแล้ว'
                          : item.paymentStatus === 'FAILED'
                            ? 'จ่ายไม่สำเร็จ'
                            : 'รอโอน'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="mobile-card-list mobile-only">
              {summary.map((item) => (
                <article key={item.employeeId} className="record-card">
                  <div className="record-card-head">
                    <strong>{item.employeeName}</strong>
                    <span
                      className={`status-pill ${
                        item.paymentStatus === 'PAID'
                          ? 'success'
                          : item.paymentStatus === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }`}
                    >
                      {item.paymentStatus === 'PAID'
                        ? 'จ่ายแล้ว'
                        : item.paymentStatus === 'FAILED'
                          ? 'จ่ายไม่สำเร็จ'
                          : 'รอโอน'}
                    </span>
                  </div>
                  <div className="record-card-body">
                    <div className="record-line"><span>รหัส</span><strong>{item.employeeCode}</strong></div>
                    <div className="record-line"><span>ประเภทจ่าย</span><strong>{item.payType}</strong></div>
                    <div className="record-line"><span>มาทำงาน</span><strong>{item.presentDays} วัน</strong></div>
                    <div className="record-line"><span>ชั่วโมงรวม</span><strong>{item.workedHours.toFixed(2)}</strong></div>
                    <div className="record-line"><span>ล่วงเวลา</span><strong>{item.overtimeHours.toFixed(2)} ชม.</strong></div>
                    <div className="record-line"><span>หักเงิน</span><strong>{item.deduction.toFixed(2)} บาท</strong></div>
                    <div className="record-line"><span>ยอดสุทธิ</span><strong>{item.netPay.toFixed(2)} บาท</strong></div>
                    <div className="record-line"><span>ธนาคาร</span><strong>{item.bankName ?? 'ยังไม่ได้กรอก'}</strong></div>
                    <div className="record-line"><span>เลขบัญชี</span><strong>{item.accountNumber ?? '-'}</strong></div>
                    <div className="record-line"><span>พร้อมเพย์</span><strong>{item.promptPayId ?? '-'}</strong></div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
```

## app\audit\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type AuditItem = {
  id: string
  action: string
  entityType: string
  entityId: string | null
  userId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

type AuditResponse = {
  items: AuditItem[]
}

export default function AuditPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [userId, setUserId] = useState('')

  const loadAudit = async () => {
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (entityType.trim()) params.set('entityType', entityType.trim())
    if (action.trim()) params.set('action', action.trim())
    if (userId.trim()) params.set('userId', userId.trim())
    params.set('limit', '100')

    const res = await fetch(`/api/audit?${params.toString()}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'โหลด audit log ไม่สำเร็จ')
    }

    setRecords((data as AuditResponse).items)
    setLoading(false)
  }

  const exportCsv = () => {
    if (records.length === 0) return

    const header = ['createdAt', 'action', 'entityType', 'entityId', 'userId', 'metadata']
    const rows = records.map((record) => [
      record.createdAt,
      record.action,
      record.entityType,
      record.entityId ?? '',
      record.userId ?? '',
      JSON.stringify(record.metadata ?? {}),
    ])
    const csvContent = [header.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then(() => {
        setAuthorized(true)
        return loadAudit()
      })
      .catch((error: Error) => {
        if (error.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        if (error.message === 'unauthorized') {
          router.push('/login')
          return
        }

        setError(error.message)
        setLoading(false)
      })
  }, [router])

  useEffect(() => {
    if (!authorized) return
    loadAudit().catch(() => undefined)
  }, [search, entityType, action, userId])

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">รายการล่าสุด {records.length} รายการ</div>
            <div className="badge">Operational audit trail</div>
          </div>
          <h1 className="hero-title">Audit Log</h1>
          <p className="hero-subtitle">
            ใช้ตรวจย้อนหลัง action สำคัญ เช่น attendance, employee และ payroll
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับ Dashboard
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/ops')}>
            Ops Center
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/payroll')}>
            ไปหน้า Payroll
          </button>
          <button className="btn btn-primary" onClick={exportCsv}>
            ดาวน์โหลด CSV
          </button>
        </div>
      </section>

      <section className="panel">
        {error ? <div className="message message-error">{error}</div> : null}
        <div className="form-grid" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>ค้นหา</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="action, entity หรือ id"
            />
          </div>
          <div className="field">
            <label>Entity type</label>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              placeholder="AttendanceCorrection"
            />
          </div>
          <div className="field">
            <label>Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="payroll.locked"
            />
          </div>
          <div className="field">
            <label>User ID</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty-state">ยังไม่มี audit log ใน tenant นี้</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{new Date(record.createdAt).toLocaleString('th-TH')}</td>
                    <td>{record.action}</td>
                    <td>
                      <div>{record.entityType}</div>
                      <div className="table-meta">{record.entityId ?? '-'}</div>
                    </td>
                    <td>{record.userId ?? '-'}</td>
                    <td>
                      <pre className="table-meta pre-wrap">
                        {record.metadata ? JSON.stringify(record.metadata, null, 2) : '-'}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
```

## app\ops\page.tsx

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type OpsSummary = {
  app: string
  database: string
  nodeEnv: string
  version: string
  timestamp: string
  activeEmployees: number
  pendingCorrections: number
  lockedPayrollPeriods: number
  openAttendanceShifts: number
  auditEventsLast24h: number
  checkedInToday: number
  settings: {
    payrollPayday: number
    latitude: number | null
    longitude: number | null
    allowedRadiusMeters: number
  }
  subscription: {
    plan: string
    status: string
    expiresAt: string | null
    daysRemaining: number | null
  }
}

export default function OpsPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    payrollPayday: '31',
    latitude: '',
    longitude: '',
    allowedRadiusMeters: '150',
  })

  const loadSummary = async () => {
    const res = await fetch('/api/ops/summary')
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'โหลดข้อมูล ops ไม่สำเร็จ')
    }

    const summaryData = data as OpsSummary
    setSummary(summaryData)
    setForm({
      payrollPayday: String(summaryData.settings.payrollPayday),
      latitude: summaryData.settings.latitude?.toString() ?? '',
      longitude: summaryData.settings.longitude?.toString() ?? '',
      allowedRadiusMeters: String(summaryData.settings.allowedRadiusMeters),
    })
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true

    fetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 402 ? 'subscription' : 'unauthorized')
        }
        return res.json()
      })
      .then((user) => {
        if (!['OWNER', 'ADMIN'].includes(user.role)) {
          throw new Error('forbidden')
        }

        return loadSummary()
      })
      .then(() => {
        if (!mounted) return
      })
      .catch((caughtError: Error) => {
        if (!mounted) return

        if (caughtError.message === 'subscription') {
          router.push('/subscription-expired')
          return
        }

        if (caughtError.message === 'unauthorized') {
          router.push('/login')
          return
        }

        if (caughtError.message === 'forbidden') {
          router.push('/dashboard')
          return
        }

        setError(caughtError.message)
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [router])

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/ops/summary', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payrollPayday: Number(form.payrollPayday),
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          allowedRadiusMeters: Number(form.allowedRadiusMeters),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'บันทึกการตั้งค่าไม่สำเร็จ')
      }

      await loadSummary()
      setMessage('บันทึกการตั้งค่าร้านเรียบร้อยแล้ว')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page">Loading...</div>
  }

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="badge-row">
            <div className="badge">ศูนย์ดูแลระบบร้าน</div>
            <div className="badge">เฉพาะเจ้าของร้านและแอดมิน</div>
          </div>
          <h1 className="hero-title">ตั้งค่าร้านและตรวจสุขภาพระบบ</h1>
          <p className="hero-subtitle">
            ใช้ตั้งค่ารอบเงินเดือนและพิกัดร้านสำหรับการลงเวลาแบบถ่ายรูปและตรวจตำแหน่ง
          </p>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
            กลับหน้าแรก
          </button>
          <button className="btn btn-secondary" onClick={() => router.push('/audit')}>
            ดูประวัติการใช้งาน
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/attendance/corrections')}
          >
            คำขอแก้เวลา
          </button>
        </div>
      </section>

      {error ? <div className="message message-error">{error}</div> : null}
      {message ? <div className="message message-success">{message}</div> : null}

      {summary ? (
        <>
          <section className="grid stats">
            <article className="stat-card">
              <p className="stat-label">สถานะแอป</p>
              <p className="stat-value">{summary.app}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">สถานะฐานข้อมูล</p>
              <p className="stat-value">{summary.database}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">พนักงาน active</p>
              <p className="stat-value">{summary.activeEmployees}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">ลงเวลาแล้ววันนี้</p>
              <p className="stat-value">{summary.checkedInToday}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">คำขอแก้เวลา pending</p>
              <p className="stat-value">{summary.pendingCorrections}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Open shift ที่ยังไม่ปิด</p>
              <p className="stat-value">{summary.openAttendanceShifts}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">งวด payroll ที่ lock</p>
              <p className="stat-value">{summary.lockedPayrollPeriods}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Audit 24 ชม. ล่าสุด</p>
              <p className="stat-value">{summary.auditEventsLast24h}</p>
            </article>
          </section>

          <section className="panel">
            <h2 className="panel-title">ตั้งค่าร้านสำหรับใช้งานจริง</h2>
            <p className="panel-subtitle">
              ถ้ายังไม่ตั้งค่าพิกัดร้าน พนักงานจะยังเช็กอินด้วย GPS ไม่ได้
            </p>
            <form onSubmit={handleSaveSettings}>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div className="field">
                  <label>วันจ่ายเงินเดือนของร้าน</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={form.payrollPayday}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payrollPayday: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>ละติจูดร้าน</label>
                  <input
                    inputMode="decimal"
                    value={form.latitude}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, latitude: event.target.value }))
                    }
                    placeholder="13.7563"
                  />
                </div>
                <div className="field">
                  <label>ลองจิจูดร้าน</label>
                  <input
                    inputMode="decimal"
                    value={form.longitude}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, longitude: event.target.value }))
                    }
                    placeholder="100.5018"
                  />
                </div>
                <div className="field">
                  <label>รัศมีที่อนุญาตให้ลงเวลา (เมตร)</label>
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    value={form.allowedRadiusMeters}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowedRadiusMeters: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="action-row" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="panel-title">สถานะระบบ</h2>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">สภาพแวดล้อม: {summary.nodeEnv}</div>
              <div className="badge">เวอร์ชัน: {summary.version}</div>
              <div className="badge">
                ตรวจล่าสุด: {new Date(summary.timestamp).toLocaleString('th-TH')}
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel-title">ข้อมูลแพ็กเกจ</h2>
            <p className="panel-subtitle">
              แพ็กเกจ {summary.subscription.plan} / สถานะ {summary.subscription.status}
            </p>
            <div className="badge-row" style={{ marginTop: 14 }}>
              <div className="badge">
                วันคงเหลือ: {summary.subscription.daysRemaining ?? 'ไม่ได้กำหนด'}
              </div>
              <div className="badge">
                หมดอายุ:{' '}
                {summary.subscription.expiresAt
                  ? new Date(summary.subscription.expiresAt).toLocaleDateString('th-TH')
                  : 'ไม่ได้กำหนด'}
              </div>
              <div className="badge">วันจ่ายเงินเดือน: วันที่ {summary.settings.payrollPayday}</div>
              <div className="badge">
                พิกัดร้าน:{' '}
                {summary.settings.latitude !== null && summary.settings.longitude !== null
                  ? `${summary.settings.latitude}, ${summary.settings.longitude}`
                  : 'ยังไม่ได้ตั้งค่า'}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
```

## types\next-auth.d.ts

```ts
import type { UserRole } from "@prisma/client"
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string
      email?: string | null
      role?: UserRole
      tenantId?: string
    }
  }

  interface User {
    id: string
    email: string
    role: UserRole
    tenantId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: UserRole
    tenantId?: string
  }
}
```

## scripts\validate-env.mjs

```mjs
import fs from "node:fs"
import path from "node:path"

const envFilePath = path.resolve(process.cwd(), ".env")
const requiredKeys = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]

if (fs.existsSync(envFilePath)) {
  const envFile = fs.readFileSync(envFilePath, "utf8")

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf("=")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    let value = trimmed.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const missing = requiredKeys.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`)
  process.exit(1)
}

console.log("Environment validation passed")
```

## scripts\backup-db.ps1

```ps1
param(
  [string]$OutputDir = ".\\backups"
)

$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  Write-Error "pg_dump was not found in PATH"
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = Join-Path $OutputDir "backup_$timestamp.sql"

pg_dump --dbname=$databaseUrl --format=plain --no-owner --no-privileges --file=$outputFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Backup failed"
  exit $LASTEXITCODE
}

Write-Output "Backup created at $outputFile"
```

## scripts\restore-db.ps1

```ps1
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$databaseUrl = $env:DATABASE_URL

if (-not $databaseUrl) {
  Write-Error "DATABASE_URL is required"
  exit 1
}

if (-not (Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
  exit 1
}

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Error "psql was not found in PATH"
  exit 1
}

psql $databaseUrl -f $BackupFile

if ($LASTEXITCODE -ne 0) {
  Write-Error "Restore failed"
  exit $LASTEXITCODE
}

Write-Output "Restore completed from $BackupFile"
```

## docs\LAUNCH_HANDOFF.md

```md
# Launch Handoff

เอกสารนี้สรุปสถานะล่าสุดของระบบสำหรับการใช้งานจริงระดับ `pilot / early paid customers`
และใช้เป็นจุดอ้างอิงก่อนเชื่อมบัญชี production ภายนอกในภายหลัง

## สถานะปัจจุบัน

- ระบบเป็น Next.js + Prisma + PostgreSQL แบบ multi-tenant
- ใช้งานโหมด production ได้แล้ว
- migration, seed, build และ start ผ่านแล้ว
- หน้าใช้งานหลักพร้อม:
  - `/dashboard`
  - `/employees`
  - `/attendance`
  - `/attendance/history`
  - `/attendance/corrections`
  - `/payroll`
  - `/audit`
  - `/ops`

## สิ่งที่พร้อมใช้งานแล้ว

### 1. ความปลอดภัยระดับ tenant และ role

- tenant isolation ถูกบังคับใน critical routes
- subscription gating ทำงานที่ API layer
- RBAC ครอบคลุม `OWNER`, `ADMIN`, `HR`, `FINANCE`, `EMPLOYEE`
- proxy ป้องกัน protected routes เบื้องต้น

### 2. Attendance และ payroll

- check-in / check-out มี validation และป้องกัน duplicate
- check-in ต้องมีรูปก่อนบันทึก
- check-in ตรวจ GPS ตามพิกัดร้านและรัศมีที่กำหนด
- เก็บ `workedMinutes` และ `lateMinutes`
- เก็บข้อมูลรูปและตำแหน่งตอน check-in
- attendance correction request / approval flow พร้อม audit
- payroll รองรับ `MONTHLY`, `DAILY`, `HOURLY`
- payroll ใช้ `payrollPayday` ของ tenant ในการคำนวณรอบเงินเดือน
- payroll preview / save / lock / unlock พร้อม audit trail
- payroll snapshot fields ป้องกัน historical drift
- payroll summary แสดงข้อมูลบัญชีรับเงิน, พร้อมเพย์ และสถานะการโอน

### 3. Operational safety

- audit log สำหรับ critical business actions
- health endpoint ที่ `/api/health`
- ops summary ที่ `/api/ops/summary` และหน้า `/ops`
- หน้า Ops ใช้ตั้งค่าพิกัดร้าน, รัศมี และวันจ่ายเงินเดือนได้
- environment validation ก่อน build/start
- backup / restore scripts พร้อมใช้งาน
- security headers ใน Next config
- global error page สำหรับ production runtime

## บัญชีเดโม

- Email: `owner@demo.local`
- Password: `demo1234`

## สิ่งที่ยังสามารถเชื่อมทีหลังได้

ส่วนต่อไปนี้สามารถเชื่อมเพิ่มภายหลังได้โดยไม่ต้องรื้อ business core:

- Stripe
- PromptPay
- production email provider
- SMS / LINE notification provider
- external log aggregation
- uptime alerting
- domain / SSL / production hosting accounts
- managed object storage

เหตุผลที่เชื่อมทีหลังได้:

- billing logic ยังแยกจาก attendance/payroll core
- subscription ใช้ tenant fields อยู่แล้ว
- external providers สามารถเข้ามาอัปเดต subscription state หรือส่ง notification ได้โดยไม่ต้องรื้อ route หลัก
- env-based config พร้อมรองรับการเพิ่ม provider

## ขอบเขตที่ถือว่า ready ตอนนี้

ระบบพร้อมสำหรับ:

- pilot customers
- internal business operations
- early paid operations
- admin review / correction / payroll control

ระบบยังไม่ควรอ้างว่า complete enterprise platform จนกว่าจะมี:

- external monitoring/alerting เต็มรูป
- automated scheduled backups จริง
- billing integration จริง
- public deployment พร้อม domain/SSL จริง
- legal/privacy/compliance docs จริง

## Checklist ก่อนเปิดขายจริง

### โครงสร้างพื้นฐาน

- เตรียม managed PostgreSQL production
- ตั้ง `DATABASE_URL`
- ตั้ง `NEXTAUTH_URL`
- ตั้ง `NEXTAUTH_SECRET`
- เปิด SSL ที่ฐานข้อมูล
- ตั้ง deployment target เช่น Vercel / Railway / Render

### ความพร้อมด้านปฏิบัติการ

- ตรวจ `/api/health`
- ทดสอบ login
- ทดสอบ attendance flow
- ทดสอบ attendance flow พร้อมรูปและตำแหน่ง
- ทดสอบ correction flow
- ทดสอบ payroll save / lock / unlock
- ทดสอบ audit page
- ทดสอบ ops page

### ความพร้อมด้านข้อมูล

- สำรองฐานข้อมูลก่อน go-live
- seed เฉพาะ demo/test tenant เท่านั้น
- เตรียม owner account จริงของลูกค้า

## ไฟล์อ้างอิงสำคัญ

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `lib/access.ts`
- `lib/auth.ts`
- `lib/gps.ts`
- `lib/payroll.ts`
- `lib/attendance-correction.ts`
- `app/api/attendance/check-in/route.ts`
- `app/api/payroll/run/route.ts`
- `app/api/attendance/corrections/route.ts`
- `app/api/audit/route.ts`
- `app/api/ops/summary/route.ts`
- `app/attendance/page.tsx`
- `app/payroll/page.tsx`
- `app/attendance/corrections/page.tsx`
- `app/employees/page.tsx`
- `app/dashboard/page.tsx`
- `app/audit/page.tsx`
- `app/ops/page.tsx`
- `README.md`

## Full File Export

สามารถสร้างไฟล์รวม full files ล่าสุดได้ด้วย:

```powershell
.\scripts\export-full-files.ps1
```

ผลลัพธ์จะถูกสร้างที่:

- `docs/FULL_FILE_EXPORT.md`

เอกสารนี้ใช้สำหรับ:

- handoff ให้ทีม
- ส่งให้ AI/consultant ตรวจระบบต่อ
- อ้างอิงไฟล์ล่าสุดจริงในโปรเจกต์
```

