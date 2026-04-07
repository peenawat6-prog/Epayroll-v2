# Launch Handoff

เอกสารนี้สรุปสถานะล่าสุดของระบบสำหรับการใช้งานจริงระดับ `pilot / early paid customers`
และใช้เป็นจุดอ้างอิงก่อนเชื่อมบัญชี production ภายนอกในภายหลัง

## สถานะปัจจุบัน

- ระบบเป็น Next.js + Prisma + PostgreSQL แบบ multi-tenant
- ใช้งานโหมด production ได้แล้ว
- migration, seed, lint, typecheck, build และ start ผ่านแล้ว
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

- Owner: `owner@demo.local`
- Owner 2: `owner2@demo.local`
- Admin: `admin@demo.local`
- HR: `hr@demo.local`
- Finance: `finance@demo.local`
- Dev: `dev@epayroll.cloud`
- Employee: `employee@demo.local`
- Password: `@Epayroll2026`

## ผลการตรวจล่าสุด

ตรวจล่าสุดบนโฟลเดอร์หลัก `cafe-saas` และยืนยันแล้วว่า:

- `npm run lint` ผ่าน
- `npm run typecheck` ผ่าน
- `npm run build` ผ่าน
- `npm run verify:smoke` ผ่าน
- health endpoint `/api/health` ตอบ `ok=true`, `database=up`, `app=up`
- `Permissions-Policy` ล่าสุดอนุญาต `camera=(self)` และ `geolocation=(self)` สำหรับ attendance flow
- protected routes ก่อน login redirect ถูกต้อง
- owner login และหน้า/ API หลักตอบปกติ
- employee login และหน้า self-service ตอบปกติ
- employee ถูกกันสิทธิ์จาก payroll / ops / audit APIs ถูกต้อง
- flow จริงแบบ reversible ผ่าน:
  employee ส่ง leave request -> owner review reject -> employee เห็นสถานะ `REJECTED`

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

- รัน `npm run verify`
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
