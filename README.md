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
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
CRON_SECRET="replace-with-a-long-random-cron-secret"

ATTENDANCE_PHOTO_STORAGE_BACKEND="r2"
R2_ATTENDANCE_PHOTO_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ATTENDANCE_PHOTO_BUCKET="cafe-saas-check-in-photos"
R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID="..."
R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY="..."
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

ถ้าต้องการบัญชีเดโมกลับมาใช้ทดสอบ:

```bash
npm run seed:demo
```

## Production Run

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

ตรวจสภาพพร้อมใช้งานแบบรวมได้ด้วย:

```bash
npm run verify
```

ตรวจ smoke test กับระบบที่กำลังรันอยู่ได้ด้วย:

```bash
npm run verify:smoke
```

ถ้าต้องการให้ระบบเปิดแอปบนพอร์ตชั่วคราวแล้วรัน smoke test ให้อัตโนมัติ:

```bash
npm run verify:runtime
```

ถ้าจะยิง environment อื่น:

```bash
SMOKE_BASE_URL="https://your-domain.com" npm run verify:smoke
```

PowerShell wrapper:

```powershell
.\scripts\verify-smoke.ps1 -BaseUrl "https://your-domain.com"
```

CI พื้นฐานถูกเพิ่มไว้ที่:
[.github/workflows/ci.yml](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/.github/workflows/ci.yml)

Deploy workflow สำหรับ Vercel อยู่ที่:
[.github/workflows/deploy-vercel.yml](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/.github/workflows/deploy-vercel.yml)

หมายเหตุ:
- `prebuild` และ `prestart` จะตรวจ env ให้อัตโนมัติก่อนรัน
- Health check ใช้ที่ [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Demo Account

- Owner: `owner@demo.local`
- Admin: `admin@demo.local`
- Dev: `dev@epayroll.cloud`
- Password: `@Epayroll2026`

## Deployment Checklist

คู่มือ deploy แบบละเอียดอยู่ที่
[DEPLOY_VERCEL_NEON_R2.md](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/docs/DEPLOY_VERCEL_NEON_R2.md)

Checklist วันขึ้นระบบจริงอยู่ที่
[GO_LIVE_CHECKLIST.md](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/docs/GO_LIVE_CHECKLIST.md)

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
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`
- `ATTENDANCE_PHOTO_STORAGE_BACKEND`
- `R2_ATTENDANCE_PHOTO_ENDPOINT`
- `R2_ATTENDANCE_PHOTO_BUCKET`
- `R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID`
- `R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY`

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

## Verified Local Status

ตรวจล่าสุดบนโฟลเดอร์หลัก
[cafe-saas](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas)
แล้วผ่านดังนี้:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `http://localhost:3000/api/health`
- owner login + owner pages/APIs หลัก
- employee login + employee self-service + RBAC restrictions
- reversible request workflow: employee submit leave -> owner reject -> employee เห็นสถานะอัปเดต
