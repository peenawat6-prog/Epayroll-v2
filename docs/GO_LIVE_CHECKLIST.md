# Go-Live Checklist

เอกสารนี้ใช้สำหรับตรวจความพร้อมก่อนเปิดใช้งานบนคลาวด์จริง
และใช้เป็น checklist วัน deploy / วัน go-live

## 1. ก่อน Deploy

- ยืนยันว่าใช้โค้ดจากโฟลเดอร์หลัก `cafe-saas`
- รัน `npm run verify`
- ถ้าจะตรวจ runtime แบบกึ่ง production ในเครื่อง ให้รัน `npm run verify:runtime`
- ถ้าต้องใช้บัญชีเดโม ให้รัน `npm run seed:demo` เฉพาะ environment ทดสอบเท่านั้น
- ตรวจว่า `.env` local ไม่ถูก commit
- ตรวจว่า migration ล่าสุดอยู่ใน `prisma/migrations/`

## 2. ค่าที่ต้องมีบน Production

ต้องตั้งค่าอย่างน้อย:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`

ถ้าใช้ R2:

- `ATTENDANCE_PHOTO_STORAGE_BACKEND=r2`
- `R2_ATTENDANCE_PHOTO_ENDPOINT`
- `R2_ATTENDANCE_PHOTO_BUCKET`
- `R2_ATTENDANCE_PHOTO_ACCESS_KEY_ID`
- `R2_ATTENDANCE_PHOTO_SECRET_ACCESS_KEY`

## 3. Deploy Database

- สร้าง database production แยกจาก local/test
- รัน `npx prisma migrate deploy`
- ห้ามใช้ `db push` แทน migration บน production
- สำรองฐานข้อมูลก่อน go-live ครั้งแรก

## 4. Deploy App

- Deploy ตัวแอปขึ้น Vercel / hosting target
- ยืนยันว่า build ใช้ `npm run build`
- ยืนยันว่า runtime ใช้ `npm run start` หรือ hosting equivalent
- ถ้าพึ่งผูก domain ใหม่ ให้ตรวจ `NEXTAUTH_URL` ให้ตรง domain จริง
- ถ้าใช้ Vercel automation ให้ตั้ง:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

## 5. Post-Deploy Smoke Test

หลัง deploy ให้รัน:

```bash
SMOKE_BASE_URL="https://your-project.vercel.app" npm run verify:smoke
```

ถ้าใช้งานจาก PowerShell:

```powershell
.\scripts\verify-smoke.ps1 -BaseUrl "https://your-project.vercel.app"
```

ถ้าไม่ใช้บัญชีเดโม ให้ส่ง credential จริงของ environment นั้นแทน

## 6. Manual Checks หลัง Smoke Test

- เปิด `/login`
- ล็อกอิน owner
- เปิด `/dashboard`
- เปิด `/employees`
- เปิด `/attendance`
- เปิด `/payroll`
- เปิด `/requests`
- เปิด `/ops`
- เปิด `/audit`
- ล็อกอิน employee
- ตรวจว่า employee เข้า `/employee` ได้
- ตรวจว่า employee เข้า `/payroll` ไม่ได้

## 7. Attendance-Specific Checks

- ตรวจว่า browser บน production ขอสิทธิ์กล้องได้
- ตรวจว่า browser บน production ขอสิทธิ์ตำแหน่งได้
- ทดสอบถ่ายรูป check-in จริง 1 ครั้ง
- เปิดรูป attendance จาก history ได้
- ถ้าใช้ R2 ให้ตรวจว่าไฟล์ถูกอ่านกลับได้จริง

## 8. Payroll-Specific Checks

- เปิด `/payroll`
- preview payroll ได้
- save ได้
- lock ได้
- update payment status ได้
- unlock ได้เฉพาะ role ที่ควรทำได้

## 9. Monitoring ขั้นต่ำ

- ตรวจ `/api/health`
- ดู log startup
- ดู log error ล่าสุด
- ตรวจ cron cleanup route ว่าถูกเรียกได้
- ตั้ง uptime monitor ยิง `/api/health`

## 10. Rollback Plan

- เก็บ deployment id / release ref ล่าสุด
- มี database backup ก่อนเปลี่ยน schema
- ถ้า deploy พัง:
  - rollback app
  - restore env ถ้าตั้งค่าผิด
  - restore database เฉพาะเมื่อจำเป็นจริงและมีแผน downtime

## 11. ถือว่า Go-Live ได้เมื่อ

- `npm run verify` ผ่าน
- `npm run verify:smoke` ผ่านบน URL จริง
- owner flow ผ่าน
- employee flow ผ่าน
- attendance จริงผ่าน
- payroll จริงผ่าน
- `/api/health` ผ่าน
- monitoring ขั้นต่ำพร้อม
