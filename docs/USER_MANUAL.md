# Epayroll User Manual / คู่มือการใช้งาน Epayroll

เอกสารนี้เป็นคู่มือใช้งานจริงแบบ 2 ภาษา สำหรับร้านค้า ฝ่ายบริหาร ฝ่ายบุคคล ฝ่ายการเงิน พนักงาน และทีมซัพพอร์ต  
This is a practical bilingual user manual for shop owners, managers, HR, finance staff, employees, and support teams.

เว็บไซต์หลัก / Main website:

- `https://epayroll.cloud`

ลิงก์ใช้งานพิเศษ / Special links:

- สมัครร้านใหม่ / New shop registration: `https://register.epayroll.cloud`
- สมัครสิทธิ์บริหาร / Management registration: `https://manage.epayroll.cloud`

## 1. ภาพรวมระบบ / System Overview

Epayroll ถูกออกแบบมาสำหรับกิจการขนาดเล็ก เช่น ร้านกาแฟ ร้านอาหาร และร้านค้าทั่วไป  
Epayroll is designed for small businesses such as cafes, restaurants, and retail shops.

ระบบช่วยงานหลัก 5 เรื่อง / The system covers 5 main jobs:

- ลงทะเบียนร้านและเริ่มใช้งานระบบ / Register a new shop and start using the system
- ลงเวลาเข้างานและออกงานด้วยรูปถ่ายและ GPS / Check in and check out with photo and GPS
- รับคำขอพนักงาน เช่น ลา, OT, กลับก่อนเวลา, ลาออก / Handle staff requests such as leave, OT, early leave, and resignation
- ตรวจรายงานการลงเวลาและแก้ไขข้อมูลย้อนหลัง / Review attendance reports and attendance corrections
- สรุปเงินเดือน ยืนยันสรุปเงินเดือน เปิดงวดกลับมาแก้ และติดตามสถานะการโอน / Review payroll, confirm payroll, reopen payroll periods, and track transfer status

## 2. สิทธิ์ผู้ใช้งาน / User Roles

### OWNER

เจ้าของร้าน ใช้งานได้ครบทุกส่วนของร้านตัวเอง  
Shop owner with full access to their own shop.

ทำได้ / Can do:

- จัดการพนักงาน / Manage employees
- อนุมัติคำขอพนักงาน / Approve staff requests
- จัดการสิทธิ์ `ADMIN`, `HR`, `FINANCE` / Manage `ADMIN`, `HR`, `FINANCE` access
- ดูและยืนยันสรุปเงินเดือน / Review and confirm payroll
- เปิดงวดเงินเดือนกลับมาแก้ / Reopen confirmed payroll periods
- ตั้งค่าร้าน สาขา กะงาน GPS และวันจ่ายเงินเดือน / Configure shop settings, branches, shifts, GPS, and payday

### ADMIN

ผู้ช่วยดูแลร้าน / Store administrator.

ทำได้ / Can do:

- จัดการข้อมูลพนักงาน / Manage employee records
- อนุมัติคำขอทั่วไป / Approve general requests
- ดูรายงานการลงเวลา / Review attendance reports
- ช่วยตรวจสรุปเงินเดือน / Assist with payroll review

### HR

ฝ่ายบุคคล / Human resources.

ทำได้ / Can do:

- อนุมัติคำขอลงทะเบียนพนักงาน / Approve employee registration requests
- ดูและแก้ข้อมูลพนักงาน / View and edit employee details
- ดูรายงานการลงเวลา / Review attendance reports
- ตรวจคำขอของพนักงาน / Review staff requests

### FINANCE

ฝ่ายการเงิน / Finance team.

ทำได้ / Can do:

- ดูสรุปเงินเดือน / View payroll summary
- ดูข้อมูลบัญชีและพร้อมเพย์ / View bank and PromptPay details
- อัปเดตสถานะการโอน / Update payment transfer status

### EMPLOYEE

พนักงาน / Employee.

ทำได้ / Can do:

- ดูข้อมูลตัวเอง / View their own profile
- กรอกหรือแก้ข้อมูลบัญชีรับเงิน / Add or edit bank/payment details
- ลงเวลาเข้างานและออกงาน / Check in and check out
- ส่งคำขอลา, OT, กลับก่อนเวลา, ลาออก / Submit leave, OT, early leave, and resignation requests

### DEV / SUPPORT

ทีมซัพพอร์ต / Support team.

ทำได้ / Can do:

- อนุมัติเปิดร้านใหม่ / Approve new shop registrations
- อนุมัติสิทธิ์บริหาร / Approve management registrations
- อนุมัติเซลล์ / Approve sales agents
- ดูวันหมดอายุร้านและต่ออายุการใช้งาน / Review subscription expiry and extend subscriptions

## 3. เริ่มต้นร้านใหม่ / Starting a New Shop

### 3.1 ลงทะเบียนร้าน / Register a New Shop

ไปที่ / Go to:

- `https://register.epayroll.cloud`

กรอกข้อมูลที่จำเป็น / Fill in the required details:

- ชื่อร้าน / Shop name
- ชื่อสาขาหลัก / Main branch name
- ชื่อเจ้าของร้าน / Owner name
- เบอร์โทร / Phone number
- อีเมล / Email
- รหัสผ่าน / Password
- พิกัดร้าน / Shop GPS location
- รัศมีลงเวลา / Allowed check-in radius
- วันจ่ายเงินเดือน / Payroll payday
- เวลาเปิด-ปิดของกะเช้า กะบ่าย กะดึก / Morning, afternoon, and night shift times

หมายเหตุ / Notes:

- ระบบจะจำค่าพิกัดที่เลือกไว้จนกว่าจะบันทึกใหม่ / The selected location is remembered until a new one is saved
- เลือกเวลาแบบ 24 ชั่วโมง / Time selection uses 24-hour format
- หลังส่งคำขอ ร้านจะรอทีมซัพพอร์ตอนุมัติ / After submission, the shop waits for support approval

### 3.2 ทีมซัพพอร์ตอนุมัติร้าน / Support Team Approves the Shop

DEV เข้าหน้าแดชบอร์ดซัพพอร์ต / DEV opens the support dashboard:

- `https://epayroll.cloud/dev/dashboard`

ทำได้ / Can do:

- ดูคำขอร้านใหม่ / Review new shop requests
- อนุมัติหรือไม่อนุมัติ / Approve or reject
- กำหนดจำนวนวันใช้งาน / Set subscription days
- ดูวันหมดอายุร้าน / See expiry dates
- ต่ออายุร้าน / Extend subscriptions

## 4. การลงทะเบียนพนักงาน / Employee Registration

พนักงานเข้าไปที่ / Employees go to:

- `https://epayroll.cloud/login`

แล้วกด / Then click:

- `ลงทะเบียนพนักงาน / Employee registration`

กรอกข้อมูล / Fill in:

- ชื่อร้าน / Shop name
- สาขา / Branch
- ชื่อ-นามสกุล / First and last name
- เบอร์โทร / Phone number
- ตำแหน่ง / Position
- กะประจำ / Assigned shift
- วันหยุดประจำสัปดาห์ / Weekly day off
- อีเมล / Email
- รหัสผ่าน / Password
- ข้อมูลธนาคาร / Bank details
- พร้อมเพย์ / PromptPay

ถ้าใช้อีเมลซ้ำ ระบบจะแจ้ง / If the email already exists, the system will show:

- `บัญชีนี้มีผู้ใช้แล้ว โปรดติดต่อเจ้าของร้าน`
- `This account is already in use. Please contact the shop owner.`

## 5. การลงทะเบียนสิทธิ์บริหาร / Management Registration

สำหรับเจ้าของร่วม หุ้นส่วน หรือทีมบริหาร / For co-owners, partners, or management team members.

เข้าไปที่ / Go to:

- `https://manage.epayroll.cloud`

เลือก / Choose:

- ร้าน / Shop
- สิทธิ์ที่ต้องการ / Requested role
  - `OWNER`
  - `ADMIN`
  - `HR`
  - `FINANCE`

หลังส่งคำขอแล้ว DEV จะเป็นผู้อนุมัติ / After submission, DEV approves the request.

## 6. การใช้งานประจำวันของพนักงาน / Daily Employee Usage

### 6.1 เข้าสู่ระบบ / Login

หน้าใช้งาน / Login page:

- `https://epayroll.cloud/login`

ถ้าบัญชีเป็นพนักงาน ระบบจะพาไปหน้าโหมดพนักงานอัตโนมัติ  
If the account is an employee account, the system redirects to the employee mode automatically.

### 6.2 เข้างาน / Check In

พนักงานต้อง / Employees must:

- เปิดกล้อง / Open camera
- ถ่ายรูป / Take a photo
- เปิดตำแหน่ง / Enable location
- กดบันทึกเข้างาน / Tap check in

ระบบจะไม่ยอมให้บันทึกถ้า / The system blocks check-in if:

- ไม่มีรูป / No photo
- ไม่ได้ตำแหน่ง GPS / No GPS location
- อยู่นอกรัศมีร้านหรือสาขา / Outside allowed radius

### 6.3 ออกงาน / Check Out

ตอนออกงานก็ต้องถ่ายรูปและส่งพิกัดเช่นกัน เพื่อป้องกันการกดแทนกัน  
Check-out also requires a photo and GPS to reduce fraud and buddy punching.

### 6.4 คำขอของพนักงาน / Employee Requests

พนักงานส่งคำขอได้ดังนี้ / Employees can submit:

- ขอลางาน / Leave request
- ขอ OT / OT request
- ขอกลับก่อนเวลา / Early leave request
- ยื่นลาออก / Resignation request

## 7. การจัดการพนักงาน / Employee Management

หน้า `สรุปข้อมูลพนักงาน / Employee summary` ใช้สำหรับ:

- ดูรายชื่อพนักงาน / View employee list
- อนุมัติคำขอลงทะเบียน / Approve registrations
- เพิ่มพนักงานใหม่ / Add a new employee
- แก้ข้อมูล / Edit details
- เปลี่ยนสิทธิ์ / Change role
- ระงับใช้งาน / Deactivate

พฤติกรรมสำคัญ / Important behavior:

- ฟอร์มเพิ่มพนักงานจะไม่แสดงตลอดเวลา / The add employee form is hidden by default
- ต้องกดปุ่มเปิดฟอร์มก่อน / You must click to open the form
- เมื่อบันทึกเสร็จ ฟอร์มจะล้างค่าและปิดเอง / After saving, the form clears and closes automatically

ข้อจำกัดร้านขนาดเล็ก / Small business limit:

- จำนวนพนักงานที่ยังไม่ลาออกต้องไม่เกิน 30 คน / Active employees cannot exceed 30
- ถ้าเกิน ระบบจะไม่ให้เพิ่มพนักงาน / The system blocks new active employees beyond that limit

## 8. รายงานการลงเวลา / Attendance Reports

หน้า `รายงานการลงเวลา / Attendance history` แสดง:

- รูปเข้างาน / Check-in photo
- รูปออกงาน / Check-out photo
- เวลาเข้าและออก / Check-in and check-out times
- สถานะ / Status
- ข้อมูลพนักงาน / Employee information

ใช้สำหรับ / Used for:

- ตรวจการลงเวลา / Reviewing attendance
- ตรวจภาพประกอบ / Reviewing proof photos
- ตรวจสอบก่อนทำเงินเดือน / Checking before payroll

## 9. เงินเดือน / Payroll

หน้า `สรุปเงินเดือน / Payroll summary` แสดง:

- ชื่อพนักงาน / Employee name
- ประเภทการจ่าย / Pay type
- จำนวนวันหรือชั่วโมงทำงาน / Worked days or hours
- OT / OT
- มาสาย / Late minutes
- หักสาย / Late penalty
- ยอดสุทธิ / Net pay
- ธนาคาร / Bank
- เลขบัญชี / Account number
- พร้อมเพย์ / PromptPay
- สถานะการโอน / Transfer status

ขั้นตอน / Steps:

1. เลือกเดือนและปี / Select month and year
2. กดโหลดข้อมูลใหม่ / Reload data
3. ตรวจความถูกต้อง / Review correctness
4. กด `บันทึกยอด / Save`
5. กด `ยืนยันสรุปเงินเดือน / Confirm payroll`

ถ้ากดยืนยันผิด / If confirmed by mistake:

- เจ้าของร้านสามารถกด `เปิดงวดกลับมาแก้ / Reopen period` ได้ทุกครั้ง
- The owner can always reopen a confirmed payroll period

หลังยืนยันแล้ว / After confirmation:

- ฝ่ายการเงินหรือเจ้าของสามารถเปลี่ยนสถานะการโอน / Finance or owners can update payment status
- `รอโอน / Pending`
- `โอนแล้ว / Paid`
- `โอนไม่สำเร็จ / Failed`

## 10. สาขาและพิกัด / Branches and GPS

หน้า `ตั้งค่าร้าน / Shop settings` ใช้สำหรับ:

- เพิ่มสาขา / Add branches
- แก้ข้อมูลสาขา / Edit branches
- ลบสาขา / Delete branches
- ตั้งพิกัดร้านหลัก / Set main shop GPS
- ตั้งพิกัดสาขา / Set branch GPS
- ตั้งรัศมีลงเวลา / Set allowed radius

ระบบจะใช้พิกัดสาขาก่อน ถ้ามีพิกัดสาขา  
The system uses branch GPS first if a branch location is set.

## 11. หน้าซัพพอร์ต DEV / DEV Support Dashboard

หน้า `แดชบอร์ดทีมซัพพอร์ต / DEV dashboard` ใช้สำหรับ:

- อนุมัติร้านใหม่ / Approve new shops
- อนุมัติสิทธิ์บริหาร / Approve management access
- อนุมัติเซลล์ / Approve sales agents
- กำหนดว่าใครเป็นเซลล์เจ้าของร้าน / Track which sales agent owns which shop
- ดูวันหมดอายุร้าน / See shop expiry dates
- เพิ่มวันใช้งานร้าน / Extend subscription days
- ซ่อนร้านไม่ให้แสดงในช่องค้นหา / Hide shops from public search

คำขอที่อนุมัติแล้วจะถูกซ่อนออกจากรายการรอทันที  
Approved management requests disappear from the pending list immediately.

## 12. การเปลี่ยนภาษา / Language Switching

ทุกหน้าหลักมีปุ่ม `TH / EN`  
Main pages provide a `TH / EN` language switch.

ระบบจะจำภาษาที่เลือกไว้ในเครื่องนั้น  
The system remembers the selected language on that device.

## 13. ติดต่อซัพพอร์ต / Support Contact

ลิงก์ช่วยเหลือ / Support link:

- [LINE OA](https://lin.ee/Ouy2wb6)

ข้อความ `ติดต่อทีมซัพพอร์ต / Contact support team` อยู่ด้านล่างทุกหน้า  
The `Contact support team` link appears at the bottom of all pages.

## 14. ปัญหาที่พบบ่อย / Common Issues

### 14.1 เปิดกล้องแล้วภาพดำ / Camera opens but shows black screen

ให้ลอง / Try:

- ปิด Private Mode / Turn off Private Mode
- ใช้ Safari หรือ Chrome ปกติ / Use normal Safari or Chrome
- ตรวจสิทธิ์กล้อง / Check camera permissions
- รีเฟรชหน้า / Refresh the page

### 14.2 ลงเวลาไม่ได้ / Cannot check in or out

สาเหตุที่พบบ่อย / Common reasons:

- ยังไม่ได้ถ่ายรูป / No photo taken
- ยังไม่ได้อนุญาตตำแหน่ง / Location not allowed
- อยู่นอกรัศมี / Outside allowed radius
- ร้านหรือสาขายังไม่ได้ตั้งพิกัด / Shop or branch GPS not configured

### 14.3 ล็อกอินไม่ได้ / Cannot log in

ให้ตรวจ / Check:

- อีเมลและรหัสผ่านถูกต้อง / Correct email and password
- บัญชีได้รับอนุมัติแล้ว / Account has been approved
- บัญชีไม่ได้ถูกระงับ / Account is not deactivated

### 14.4 เปลี่ยนสถานะโอนไม่ได้ / Cannot update payment status

ต้องยืนยันสรุปเงินเดือนก่อน / Payroll must be confirmed first.

## 15. หมายเหตุสำหรับทีมเทคนิค / Notes for Technical Team

- ถ้า push เข้า `main` แล้ว Vercel จะ deploy อัตโนมัติ / Pushing to `main` triggers Vercel deployment automatically
- ถ้าเปลี่ยนโดเมน ต้องอัปเดต `NEXTAUTH_URL` / If the domain changes, update `NEXTAUTH_URL`
- รูปลงเวลาเก็บใน Cloudflare R2 / Attendance photos are stored in Cloudflare R2
- ตรวจสุขภาพระบบได้ที่ `/api/health` / System health can be checked at `/api/health`
