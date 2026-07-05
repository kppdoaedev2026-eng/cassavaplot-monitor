# คู่มือ Deploy CassavaPlot Monitor v4 บน GitHub + Google Apps Script
## ฉบับละเอียด — ตั้งแต่เริ่มต้นจนใช้งานได้จริง

---

## ภาพรวมขั้นตอน

```
[โค้ดในเครื่อง] → [GitHub Repository] → [GitHub Actions]
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  
                  [Google Apps Script]    [GitHub Pages]            
                  (backend + frontend)    (GeoJSON files)           
                         │                      │                   
                         └──────────┬───────────┘                   
                                    ▼                               
                             [Web App URL]                          
                          (ผู้ใช้งานเข้าระบบ)                      
```

---

## ขั้นตอนที่ 1 — ติดตั้ง Tools ที่จำเป็น

### 1.1 ติดตั้ง Node.js

ดาวน์โหลดจาก https://nodejs.org (เลือก LTS version)

ตรวจสอบ:
```bash
node --version   # ควรได้ v18+ หรือ v20+
npm --version
```

### 1.2 ติดตั้ง clasp (Google Apps Script CLI)

```bash
npm install -g @google/clasp
```

ตรวจสอบ:
```bash
clasp --version   # ควรได้ 2.4.x หรือใหม่กว่า
```

### 1.3 ติดตั้ง Git

- Windows: ดาวน์โหลดจาก https://git-scm.com
- ตรวจสอบ: `git --version`

---

## ขั้นตอนที่ 2 — สร้าง GitHub Repository

### 2.1 สร้าง Repository ใหม่

1. ไปที่ https://github.com → กด **New repository**
2. ตั้งชื่อ เช่น `cassavaplot-monitor`
3. เลือก **Public** (GitHub Pages ฟรีสำหรับ public repo)
4. กด **Create repository**

### 2.2 Clone หรือ Init

**กรณีสร้างใหม่จากโฟลเดอร์ v4-github:**
```bash
cd "d:/2569-มันสำปะหลัง/แหล่งท่อนพันธุ์/ระบบ2/v4-github"

git init
git add .
git commit -m "Initial commit: CassavaPlot Monitor v4"

git remote add origin https://github.com/kppdoaedev2026-eng/cassavaplot-monitor.git
git branch -M main
git push -u origin main
```

---

## ขั้นตอนที่ 3 — Login clasp

### 3.1 เปิดใช้ Apps Script API

1. ไปที่ https://script.google.com/home/usersettings
2. เปิดสวิตช์ **"Google Apps Script API"**

### 3.2 Login

```bash
clasp login
```

คำสั่งนี้จะเปิด browser ให้ login ด้วย Google Account  
หลัง login สำเร็จ clasp จะบันทึก credentials ไว้ที่:
- Windows: `C:\Users\[ชื่อ]\.clasprc.json`
- Mac/Linux: `~/.clasprc.json`

> **สำคัญ:** ไฟล์นี้มี refresh token สำหรับ Google Account — เก็บเป็นความลับ

---

## ขั้นตอนที่ 4 — สร้าง Google Apps Script Project

### 4.1 สร้างโปรเจกต์ใหม่

```bash
cd "d:/2569-มันสำปะหลัง/แหล่งท่อนพันธุ์/ระบบ2/v4-github/gas"
clasp create --type webapp --title "CassavaPlot Monitor v4"
```

คำสั่งนี้จะ:
- สร้าง GAS project ใหม่ใน Google Drive
- สร้าง/อัปเดต `.clasp.json` พร้อม `scriptId`

**หรือ** ถ้าสร้างโปรเจกต์ใน script.google.com มาแล้ว:
1. เปิด https://script.google.com
2. เลือกโปรเจกต์ → **Project Settings** (ไอคอนฟันเฟือง)
3. Copy **Script ID**
4. แก้ `gas/.clasp.json`:
   ```json
   {
     "scriptId": "PASTE_YOUR_SCRIPT_ID_HERE",
     "rootDir": ".",
     "filePushOrder": ["appsscript.json", "Code.gs", "Index.html"]
   }
   ```

### 4.2 Push โค้ดครั้งแรก

```bash
cd gas/
clasp push
```

ตรวจสอบที่ https://script.google.com → ดูไฟล์ Code.gs และ Index ปรากฏ

---

## ขั้นตอนที่ 5 — ตั้งค่า GitHub Secret

GitHub Actions ต้องการ clasp credentials เพื่อ push โค้ด

### 5.1 Copy เนื้อหา .clasprc.json

```bash
# Windows PowerShell:
Get-Content "$env:USERPROFILE\.clasprc.json"

# Mac/Linux:
cat ~/.clasprc.json
```

จะได้ข้อความ JSON ลักษณะนี้:
```json
{
  "token": {
    "access_token": "ya29.xxx",
    "refresh_token": "1//xxx",
    "scope": "...",
    "token_type": "Bearer",
    "expiry_date": 1234567890123
  },
  "oauth2ClientSettings": { ... },
  "isLocalCreds": false
}
```

### 5.2 เพิ่ม Secret ใน GitHub

1. ไปที่ GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. กด **New repository secret**
3. ตั้งค่า:
   - **Name:** `CLASPRC_JSON`
   - **Secret:** วางเนื้อหา `.clasprc.json` ทั้งหมด
4. กด **Add secret**

---

## ขั้นตอนที่ 6 — Enable GitHub Pages

1. ไปที่ GitHub repo → **Settings** → **Pages**
2. ตั้งค่า:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
3. กด **Save**
4. รอ 1-2 นาที → GitHub Pages URL จะแสดง เช่น:
   ```
   https://YOUR_USERNAME.github.io/cassavaplot-monitor/
   ```

ตรวจสอบว่า GeoJSON เข้าถึงได้:
```
https://YOUR_USERNAME.github.io/cassavaplot-monitor/geojson/kpp_province.geojson
```

---

## ขั้นตอนที่ 7 — แก้ GEOJSON_BASE_URL ในโค้ด

แก้ไขไฟล์ `gas/Index.html` บรรทัด:

```javascript
var GEOJSON_BASE_URL = 'https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPO_NAME/geojson';
```

เปลี่ยนเป็น URL จริง เช่น:
```javascript
var GEOJSON_BASE_URL = 'https://danuphon.github.io/cassavaplot-monitor/geojson';
```

จากนั้น:
```bash
git add gas/Index.html
git commit -m "Set GEOJSON_BASE_URL to GitHub Pages"
git push
```

GitHub Actions จะ deploy ให้อัตโนมัติ

---

## ขั้นตอนที่ 8 — ตั้งค่า GAS ครั้งแรก

### 8.1 Run setupSystem()

1. ไปที่ https://script.google.com → เปิดโปรเจกต์
2. เลือก function: `setupSystem`
3. กด **Run**
4. อนุมัติสิทธิ์ที่ขอ (Spreadsheet, Drive, Properties, Lock)
5. ดู log: ควรได้ "ติดตั้งระบบ v4.0 สำเร็จ"

### 8.2 เพิ่ม Admin User

1. เปิด Google Spreadsheet ที่สร้างใหม่ (URL ใน log)
2. ไปที่ชีต **ผู้ใช้งาน**
3. เพิ่มแถว:
   | อีเมล | ชื่อ-สกุล | บทบาท | อำเภอ | สถานะ | เบอร์โทร | PIN |
   |-------|---------|-------|-------|-------|--------|-----|
   | admin@agri.go.th | ผู้ดูแลระบบ | admin | (ว่าง) | ใช้งาน | 0812345678 | (ว่าง) |

### 8.3 Deploy Web App

1. GAS Editor → **Deploy** → **New deployment**
2. ตั้งค่า:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
3. กด **Deploy**
4. Copy **Web App URL**

---

## ขั้นตอนที่ 9 — ทดสอบระบบ

### 9.1 Login ครั้งแรก

เปิด Web App URL → Login เจ้าหน้าที่
- เบอร์โทร: `0812345678`
- PIN: (ว่าง — กด Login เลย)

ไปที่ **ตั้งค่า** → ตั้ง PIN ใหม่

### 9.2 ทดสอบแผนที่

1. ไปที่เมนู **แผนที่**
2. ขอบเขตจังหวัดควรโหลดอัตโนมัติ
3. ทดสอบ checkbox GeoJSON layers:
   - ☑ ขอบเขตอำเภอ → ควรแสดง 11 อำเภอ + tooltip ชื่อไทย
   - ☑ ขอบเขตตำบล → 78 ตำบล
   - ☑ ความเหมาะสมมันสำปะหลัง → โหลดช้า ~3-5 วินาที (1.75MB)

### 9.3 ตรวจ GitHub Actions

ไปที่ GitHub repo → **Actions**  
ดู workflow runs → ควร pass ทั้ง 2 jobs:
- `deploy-gas` ✅
- `deploy-pages` ✅

---

## ขั้นตอนที่ 10 — Workflow การพัฒนา (Day-to-Day)

### แก้โค้ด deploy อัตโนมัติ

```bash
# 1. แก้ไฟล์ใน gas/ หรือ geojson/
notepad "gas/Index.html"

# 2. Commit & Push
git add gas/Index.html
git commit -m "Fix: ปรับ UI หน้าแผนที่"
git push

# 3. GitHub Actions รัน deploy อัตโนมัติ (~2-3 นาที)
# ดู progress ที่ GitHub → Actions tab
```

### Push manual ด้วย clasp (ไม่ต้องผ่าน GitHub Actions)

```bash
cd gas/
clasp push
```

### Update GeoJSON data

```bash
# แก้ไข shapefile source ใน scripts/ แล้วรัน:
cd scripts/
python convert_cassava_suit.py

# Push GeoJSON ใหม่
cd ..
git add geojson/
git commit -m "Update: GeoJSON ความเหมาะสมมันสำปะหลังปี 2568"
git push
```

### สร้าง GAS version ใหม่ (สำหรับ release)

```bash
cd gas/
clasp version "Release v4.1 - เพิ่มฟีเจอร์ XYZ"
```

---

## การแก้ปัญหาที่พบบ่อย

### clasp push ไม่ผ่าน: "Error: Could not read project file"

```bash
# ตรวจสอบไฟล์ .clasp.json
cat gas/.clasp.json
# ต้องมี scriptId ที่ถูกต้อง
```

### GitHub Actions ไม่รัน

ตรวจสอบ:
- Secret `CLASPRC_JSON` ตั้งค่าแล้วหรือยัง
- Workflow trigger path ตรง: `paths: - 'gas/**'`

### GeoJSON โหลดไม่ขึ้น (ใน web app)

เปิด browser Console (F12) → ดู error:
- `fetch failed` → ตรวจสอบ GEOJSON_BASE_URL
- `CORS error` → GitHub Pages เปิด CORS อัตโนมัติ ถ้ายังไม่ขึ้นรอ 5 นาทีหลัง enable Pages
- `404` → ไฟล์ยังไม่ถูก deploy หรือ path ผิด

### GAS Web App แสดง "Script function not found: doGet"

ต้อง Deploy ใหม่ หลัง push โค้ด:
- GAS Editor → Deploy → Manage deployments → Edit → New version → Deploy

---

## การตั้งค่า Gemini AI (Optional)

1. ไปที่ https://aistudio.google.com → สร้าง API Key
2. GAS Editor → **Project Settings** → **Script Properties**
3. เพิ่ม: `GEMINI_API_KEY` = `[API Key ที่ได้]`
4. ไปที่แปลงใดก็ได้ → **🤖 AI วิเคราะห์** → Gemini จะวิเคราะห์ให้

---

## โครงสร้าง Git Branch ที่แนะนำ

```
main          ← production (deploy อัตโนมัติ)
  └── feature/xxx   ← พัฒนาฟีเจอร์ใหม่
  └── fix/xxx       ← แก้บัก
  └── data/xxx      ← อัปเดต GeoJSON
```

### Pull Request Workflow

```bash
# สร้าง branch ใหม่
git checkout -b feature/add-export-excel

# พัฒนา + commit
git add .
git commit -m "Add: export Excel report"

# Push + สร้าง PR
git push -u origin feature/add-export-excel
# → GitHub → Compare & pull request
# → Review → Merge → Auto deploy
```

---

## สรุป URL ที่สำคัญ

| ส่วน | URL |
|------|-----|
| GitHub Repository | `https://github.com/YOUR_USERNAME/cassavaplot-monitor` |
| GitHub Pages | `https://YOUR_USERNAME.github.io/cassavaplot-monitor/` |
| GeoJSON Province | `https://YOUR_USERNAME.github.io/cassavaplot-monitor/geojson/kpp_province.geojson` |
| GAS Script Editor | `https://script.google.com/d/YOUR_SCRIPT_ID/edit` |
| Web App URL | `https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec` |
| Google Spreadsheet | (URL จาก setupSystem() log) |

---

*คู่มือนี้ครอบคลุม workflow ตั้งแต่เริ่มต้นจนใช้งานจริงในสนาม*  
*สำนักงานเกษตรจังหวัดกำแพงเพชร | 2025*
