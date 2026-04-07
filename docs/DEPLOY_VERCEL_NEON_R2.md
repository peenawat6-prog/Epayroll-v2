# Deploy Cafe SaaS to Vercel + Neon + Cloudflare R2

เอกสารนี้คือ checklist สำหรับย้ายโปรเจกต์ขึ้น cloud โดยยังรอผูก domain name ทีหลังได้

## 1) GitHub Repo

อัปโหลดโฟลเดอร์ `cafe-saas` ขึ้น GitHub repository ก่อน

ต้องเช็กว่าไฟล์เหล่านี้ถูก commit ด้วย:

- `app/`
- `lib/`
- `prisma/`
- `scripts/`
- `types/`
- `vercel.json`
- `.env.example`
- `package.json`
- `package-lock.json`
- `README.md`

ห้าม commit:

- `.env`
- `.next/`
- `node_modules/`
- `storage/`
- `start.out.log`
- `start.err.log`

ไฟล์ `.gitignore` ถูกปรับให้กันไฟล์เหล่านี้แล้ว

## 2) Neon Production Database

แนะนำสร้าง Neon database แยกสำหรับ production เช่น `cafe-saas-prod`

นำ connection string ไปใส่ Vercel Environment Variables:

- `DATABASE_URL`
- `DIRECT_URL`

หลัง deploy ครั้งแรก ให้รัน migration จากเครื่อง dev หรือ CI:

```bash
npx prisma migrate deploy
```

ถ้ายังเป็นระบบ pilot และอยากใส่ข้อมูลตั้งต้น demo/store admin:

```bash
npx prisma db seed
```

## 3) Cloudflare R2

Bucket ที่ใช้เก็บรูปเช็กอิน:

```text
cafe-saas-check-in-photos
```

Environment Variables ที่ต้องใส่ใน Vercel:

```env
ATTENDANCE_PHOTO_STORAGE_BACKEND="r2"
R2_ATTENDANCE_PHOTO_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ATTENDANCE_PHOTO_BUCKET="cafe-saas-check-in-photos"
R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID="..."
R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY="..."
```

เช็กจากเครื่อง dev ได้ด้วย:

```bash
npm run verify:attendance-photo-storage
```

## 4) Vercel Project Settings

### Build & Install

ใช้ค่า default ของ Vercel ได้เลย:

- Install Command: `npm install`
- Build Command: `npm run build`

ใน `package.json` มี `postinstall: prisma generate` แล้ว

### Environment Variables

ตั้งค่าต่อไปนี้ใน Vercel Project:

```env
DATABASE_URL="..."
DIRECT_URL="..."
NEXTAUTH_URL="https://<your-vercel-url>"
NEXTAUTH_SECRET="..."
CRON_SECRET="..."

ATTENDANCE_PHOTO_STORAGE_BACKEND="r2"
R2_ATTENDANCE_PHOTO_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ATTENDANCE_PHOTO_BUCKET="cafe-saas-check-in-photos"
R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID="..."
R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY="..."
```

ตอนยังไม่ได้ผูก domain ให้ใช้ `NEXTAUTH_URL` เป็น Vercel URL ก่อน เช่น `https://your-project.vercel.app`

### Secrets / IDs ที่ต้องมีสำหรับ deploy automation

ถ้าจะใช้ GitHub Actions หรือ PowerShell deploy wrapper ต้องมี:

```env
VERCEL_TOKEN="..."
VERCEL_ORG_ID="..."
VERCEL_PROJECT_ID="..."
```

## 4.1) Deploy Commands

ถ้า deploy จากเครื่อง:

```powershell
$env:VERCEL_TOKEN="..."
$env:VERCEL_ORG_ID="..."
$env:VERCEL_PROJECT_ID="..."
npm run deploy:vercel
```

ถ้า deploy จาก GitHub Actions:

- ตั้ง secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - และ env ทั้งหมดของ production app
- ใช้ workflow:
  [deploy-vercel.yml](C:/Users/peena/OneDrive/Documents/Playground/cafe-saas/.github/workflows/deploy-vercel.yml)

## 5) Cron ล้างรูปเก่า 30 วัน

โปรเจกต์มี `vercel.json` แล้ว และตั้งให้เรียก:

```text
/api/maintenance/attendance-photos
```

ทุกวันเวลา `20:00 UTC` ซึ่งเท่ากับประมาณ `03:00` เวลาไทย

Route นี้จะใช้ `CRON_SECRET` ถ้ามี `Authorization: Bearer <CRON_SECRET>` จาก Vercel Cron
และยังให้ `DEV / OWNER / ADMIN` เรียกเองได้จาก session ถ้าจำเป็น

## 6) Smoke Test หลัง Deploy

เปิด URL ของ Vercel แล้วเช็ก:

- `/api/health` ต้องตอบ `200`
- `/login` ล็อกอิน OWNER/ADMIN ได้
- `/employee/register` ส่งคำขอลงทะเบียนได้
- `/employees` อนุมัติคำขอได้
- `/employee` เช็กอินด้วยกล้อง + GPS ได้
- `/attendance/history` เปิดรูปเช็กอินจาก R2 ได้
- `/payroll` สรุปเงินเดือนได้
- `/ops` เห็นสถานะ storage เป็น `r2://cafe-saas-check-in-photos`

ถ้าต้องการรัน smoke test แบบสคริปต์:

```bash
SMOKE_BASE_URL="https://your-project.vercel.app" npm run verify:smoke
```

ค่า default ของ script จะใช้บัญชี demo:

- `owner@demo.local`
- `employee@demo.local`
- password `@Epayroll2026`

ถ้าจะใช้บัญชีจริง ให้ override:

```bash
SMOKE_BASE_URL="https://your-project.vercel.app" \
SMOKE_OWNER_EMAIL="owner@example.com" \
SMOKE_OWNER_PASSWORD="..." \
SMOKE_EMPLOYEE_EMAIL="employee@example.com" \
SMOKE_EMPLOYEE_PASSWORD="..." \
npm run verify:smoke
```

หรือใช้ PowerShell wrapper:

```powershell
.\scripts\verify-smoke.ps1 -BaseUrl "https://your-project.vercel.app"
```

## 7) Domain Name

ขั้นนี้ยังรอผูก domain name ได้

หลังผูก domain แล้วให้กลับไปอัปเดต:

```env
NEXTAUTH_URL="https://your-domain.com"
```

แล้ว redeploy อีกครั้ง
