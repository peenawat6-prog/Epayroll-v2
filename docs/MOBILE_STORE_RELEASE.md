# Epayroll Mobile Release Guide

เอกสารนี้อธิบายสิ่งที่พร้อมแล้วใน repo และสิ่งที่ต้องทำต่อเพื่อส่งขึ้น Google Play และ Apple App Store

## สถานะปัจจุบันของ repo

โปรเจกต์นี้ถูกเตรียมเป็น mobile wrapper ด้วย Capacitor แล้ว

สิ่งที่มีใน repo:

- `capacitor.config.ts`
- `android/`
- `ios/`
- Android permissions สำหรับ:
  - internet
  - camera
  - coarse location
  - fine location
- iOS usage descriptions สำหรับ:
  - camera
  - location when in use

แนวทางของแอพมือถือชุดนี้:

- native app จะโหลด production app จาก `https://epayroll.cloud`
- ใช้ web app เดิมเป็นแกนหลัก
- มี fallback page ใน `public/index.html`

ข้อสำคัญ:

- iOS build และ upload ต้องทำบน macOS ที่ติดตั้ง Xcode
- Android build ต้องมี Android Studio + Android SDK
- App Store review ของ Apple อาจขอให้แอพแสดงคุณค่าเกินกว่า web wrapper ธรรมดา ดังนั้นควรอธิบาย use case ให้ชัดว่าแอพนี้ใช้กล้องและตำแหน่งเพื่อยืนยัน attendance หน้างานจริง

## คำสั่งที่ใช้ใน repo

ติดตั้ง dependency:

```bash
npm install
```

sync web config เข้า native projects:

```bash
npm run mobile:sync
```

sync เฉพาะ Android:

```bash
npm run mobile:sync:android
```

sync เฉพาะ iOS:

```bash
npm run mobile:sync:ios
```

เปิด Android Studio:

```bash
npm run mobile:open:android
```

เปิด Xcode:

```bash
npm run mobile:open:ios
```

## Android / Google Play

### 1. ติดตั้งเครื่องมือ

ต้องมี:

- Android Studio
- Android SDK
- Java ที่ Android Studio รองรับ

### 2. เปิดโปรเจกต์ Android

```bash
npm run mobile:open:android
```

หรือเปิดโฟลเดอร์ `android/` ใน Android Studio

### 3. ตั้งค่า release signing

สร้าง keystore สำหรับ release

ตัวอย่าง:

```bash
keytool -genkey -v -keystore epayroll-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias epayroll
```

จากนั้นตั้งค่า signing ใน Android Studio หรือ Gradle

### 4. ตั้ง version

แก้ค่า version ใน Android project ก่อนส่งขึ้น store

อย่างน้อยต้องดู:

- `versionCode`
- `versionName`

### 5. Build ไฟล์สำหรับส่ง Play Console

แนะนำให้ build เป็น `Android App Bundle (.aab)`

ใน Android Studio:

- Build
- Generate Signed Bundle / APK
- Android App Bundle

### 6. สิ่งที่ต้องมีใน Play Console

- Google Play Developer account
- package name นี้:
  - `cloud.epayroll.app`
- privacy policy URL
- app description
- app icon 512x512
- feature graphic
- screenshots
- content rating
- data safety form

### 7. ข้อมูล policy ที่ควรกรอกให้ตรง

แอพนี้ใช้:

- Camera
- Location
- Authentication / account data

จึงต้องกรอก Data safety และ permission declaration ให้ตรงกับการใช้งานจริง

## iOS / App Store

### 1. เครื่องที่ต้องใช้

ต้องใช้:

- macOS
- Xcode
- Apple Developer Program account

### 2. เปิดโปรเจกต์ iOS

บน Mac:

```bash
npm install
npm run mobile:sync:ios
npm run mobile:open:ios
```

หรือเปิด:

- `ios/App/App.xcodeproj`

### 3. ตั้งค่า signing

ใน Xcode:

- เลือก target `App`
- Signing & Capabilities
- เลือก Team
- ตรวจ bundle identifier:
  - `cloud.epayroll.app`

ถ้า identifier นี้เคยถูกใช้แล้วและไม่สามารถใช้ต่อได้ ให้เปลี่ยนเป็นตัวใหม่ เช่น:

- `cloud.epayroll.mobile`

และอัปเดตใน `capacitor.config.ts` ให้ตรงกัน

### 4. ตั้งค่า version/build

ใน Xcode:

- Marketing Version
- Current Project Version

### 5. Archive และอัปขึ้น App Store Connect

ใน Xcode:

- Product
- Archive
- Distribute App
- App Store Connect

### 6. สิ่งที่ต้องมีใน App Store Connect

- Apple Developer Program
- App record
- privacy policy URL
- support URL
- app description
- screenshots:
  - iPhone
  - iPad ถ้าจะรองรับ iPad
- app icon 1024x1024
- App Privacy answers

### 7. จุดเสี่ยงของการ review

Apple มักตรวจเข้มกับแอพที่เป็น web wrapper

สิ่งที่ควรสื่อใน review notes:

- แอพนี้ใช้สำหรับ attendance และ payroll ของร้าน
- ต้องใช้ camera เพื่อถ่ายรูปตอนเข้างาน/ออกงาน
- ต้องใช้ location เพื่อยืนยันพื้นที่ทำงาน
- ใช้ account login ตาม tenant จริง
- ออกแบบสำหรับใช้งานบนมือถือของพนักงานและผู้จัดการ

## Store Assets ที่ยังต้องเตรียมเอง

สิ่งที่ repo ยังไม่ได้สร้างให้:

- Play Store screenshots
- App Store screenshots
- Play feature graphic
- App Store promotional text
- final store icon ขนาดส่ง store โดยตรง
- privacy policy หน้า public แบบ mobile-specific ถ้าต้องการ

แนะนำให้เตรียมอย่างน้อย:

- icon 1024x1024
- Android screenshots 2-8 ภาพ
- iPhone screenshots 3-6 ภาพ
- app description TH/EN
- privacy policy URL

## ขั้นตอนแนะนำก่อนส่งจริง

1. ทดสอบบนเครื่องจริง Android
2. ทดสอบบนเครื่องจริง iPhone
3. ตรวจ login
4. ตรวจ camera
5. ตรวจ geolocation
6. ตรวจ attendance check-in/check-out
7. ตรวจหน้า employees, requests, payroll
8. ตรวจ logout
9. ตรวจว่าถ้าเน็ตหลุด แอพแสดง fallback อย่างสุภาพ

## ข้อสรุป

repo นี้พร้อมสำหรับขั้น “native wrapper + store preparation” แล้ว

สิ่งที่ยังต้องทำบนเครื่อง/บัญชีของผู้เผยแพร่:

- Android signing key
- Apple signing / provisioning
- screenshots และ metadata
- final upload ไป Play Console และ App Store Connect
