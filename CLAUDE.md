# CassavaPlot Monitor v4.0 — CLAUDE.md
## ระบบติดตามแปลงส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค
### สำนักงานเกษตรจังหวัดกำแพงเพชร | GitHub + GAS Deployment Edition

---

## 1. ภาพรวมระบบ (System Overview)

**CassavaPlot Monitor v4.0** คือ Web Application แบบ All-in-One บน Google Apps Script (GAS)  
สำหรับติดตามแปลงส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค (CMD/SLCMV) จังหวัดกำแพงเพชร

### ความแตกต่างจาก v3
| ด้าน | v3 | v4 |
|------|----|----|
| การ deploy | อัปโหลดโค้ดด้วยมือผ่าน Script Editor | **GitHub Actions CI/CD + clasp** |
| GeoJSON | ไม่มี (ใช้ WMS เท่านั้น) | **Local GeoJSON จากข้อมูลกรมพัฒนาที่ดิน** |
| การเก็บ GeoJSON | — | **GitHub Pages** (CDN ฟรี) |
| Version Control | ไม่มี | **Git (full history)** |
| การ review | ไม่มี | **Pull Request workflow** |

### สถาปัตยกรรม (Architecture)

```
[GitHub Repository]
  ├── gas/          ──→ clasp push ──→ [Google Apps Script]
  │     ├── Code.gs                          │
  │     ├── Index.html                       ▼
  │     └── appsscript.json         [Web App URL (GAS)]
  │                                          │
  └── geojson/      ──→ GitHub Pages ──→ fetch() ──→ Leaflet layers
        ├── kpp_province.geojson
        ├── kpp_districts.geojson
        ├── kpp_tambons.geojson
        └── kpp_cassava_light.geojson

[Browser/Mobile]
  → GAS Web App URL → doGet() → Index.html (SPA)
  → google.script.run.callAPI() → Code.gs → Google Sheets
  → fetch(GEOJSON_BASE_URL + '/kpp_*.geojson') → Leaflet L.geoJSON()
```

### เทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Backend | Google Apps Script (GAS) V8 |
| Database | Google Sheets (13 ชีต) |
| File Storage | Google Drive |
| Frontend | Vanilla JS + CSS (Single File SPA) |
| แผนที่ | Leaflet.js 1.9.4 |
| GeoJSON Layers | L.geoJSON() + GitHub Pages hosting |
| WMS ข้อมูลดิน | กรมพัฒนาที่ดิน (Agri-Map WMS) |
| กราฟ | Chart.js 4.4.1 |
| QR Code | QRCode.js + html5-qrcode 2.3.8 |
| AI วิเคราะห์ | Gemini 1.5 Flash (optional) |
| Auth | HMAC-SHA256 JWT (7 วัน) |
| CI/CD | GitHub Actions + clasp |
| GeoJSON Hosting | GitHub Pages |
| GeoJSON Converter | Python + pyshp + pyproj |

---

## 2. โครงสร้างไฟล์ (File Structure)

```
v4-github/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions: push GAS + deploy Pages
│
├── gas/                        # ไฟล์สำหรับ Google Apps Script
│   ├── appsscript.json         # GAS manifest (timezone, runtime, webapp config)
│   ├── Code.gs                 # Backend ทั้งหมด (~2,280 บรรทัด)
│   ├── Index.html              # Frontend SPA (~4,400+ บรรทัด)
│   └── .clasp.json             # clasp config (scriptId, rootDir)
│
├── geojson/                    # GeoJSON สำหรับ GitHub Pages
│   ├── kpp_province.geojson    # ขอบเขตจังหวัดกำแพงเพชร (14 KB)
│   ├── kpp_districts.geojson   # ขอบเขต 11 อำเภอ (50 KB)
│   ├── kpp_tambons.geojson     # ขอบเขต 78 ตำบล (206 KB)
│   ├── kpp_cassava_suit.geojson # ความเหมาะสมมันสำปะหลัง เต็มละเอียด (8 MB)
│   └── kpp_cassava_light.geojson # เวอร์ชันย่อสำหรับ web (1.75 MB)
│
├── scripts/                    # Python conversion scripts
│   ├── convert_geojson.py      # แปลง tha_admin*.geojson → kpp_*.geojson
│   └── convert_cassava_suit.py # แปลง Zon_Cass_kpt.shp (UTM) → WGS84 GeoJSON
│
├── docs/                       # เอกสารเพิ่มเติม
│
├── CLAUDE.md                   # เอกสารนี้
├── DEPLOY_GUIDE.md             # คู่มือ deploy แบบละเอียด
└── README.md                   # ภาพรวมโปรเจกต์
```

---

## 3. GeoJSON Layers — ข้อมูลแผนที่

### 3.1 แหล่งข้อมูล

| ไฟล์ | แหล่งข้อมูล | ขนาด | หมายเหตุ |
|------|------------|------|---------|
| `kpp_province.geojson` | OCHA HDX `tha_admin1.geojson` (TH62) | 14 KB | WGS84, simplified tol=0.001° |
| `kpp_districts.geojson` | OCHA HDX `tha_admin2.geojson` (TH62**) | 50 KB | 11 อำเภอ |
| `kpp_tambons.geojson` | OCHA HDX `tha_admin3.geojson` (TH62***) | 206 KB | 78 ตำบล |
| `kpp_cassava_light.geojson` | `Zon_Cass_kpt.shp` (กรมพัฒนาที่ดิน) | 1.75 MB | UTM32647→WGS84, tol=0.001° |
| `kpp_cassava_suit.geojson` | `Zon_Cass_kpt.shp` | 8.15 MB | tol=0.0001°, ไว้ offline/print |

### 3.2 Properties ของแต่ละ Layer

**kpp_province.geojson**
```json
{ "name_th": "กำแพงเพชร", "name_en": "Kamphaeng Phet", "pcode": "TH62", "area_sqkm": 8607 }
```

**kpp_districts.geojson**
```json
{ "name_th": "Mueang Kamphaeng Phet", "name_en": "Mueang Kamphaeng Phet", "pcode": "TH6201", "prov_pcode": "TH62" }
```

**kpp_tambons.geojson**
```json
{ "name_th": "Nai Mueang", "name_en": "Nai Mueang", "pcode": "TH620101", "dist_pcode": "TH6201", "prov_pcode": "TH62" }
```

**kpp_cassava_light.geojson**
```json
{ "suit": "S1", "color": "#2e7d32", "rai": 15.3 }
```

> **หมายเหตุ:** ไฟล์ `tha_admin2.geojson` และ `tha_admin3.geojson` ใช้ชื่อ RTGS (English transliteration)  
> ระบบมี lookup table `KPP_DISTRICT_TH` ใน Index.html เพื่อแปลง pcode → ชื่อไทย

### 3.3 Cassava Suitability Classes

| Class | สี (hex) | ความหมาย | พื้นที่ (ไร่) |
|-------|---------|---------|-----------|
| S1 | `#2e7d32` | เหมาะสมมาก | 232,629 |
| S2 | `#558b2f` | เหมาะสมปานกลาง | 265,368 |
| S3 | `#f9a825` | เหมาะสมน้อย | 301,526 |
| N  | `#c62828` | ไม่เหมาะสม | 1,253 |

### 3.4 การ Update GeoJSON

เมื่อต้องการ generate GeoJSON ใหม่ (เช่น ได้ shapefile ใหม่จาก LDD):

```bash
# ต้องติดตั้ง: pip install pyshp pyproj
cd scripts/
python convert_geojson.py        # admin boundaries
python convert_cassava_suit.py   # cassava zoning
# ไฟล์ใหม่จะถูก write ไปที่ ../geojson/
```

---

## 4. Code.gs — Backend

### 4.1 โครงสร้าง Code.gs

```
00_Config      บรรทัด 1–57     APP, OPTIONS, IDP, SHEETS constants
01_Database    บรรทัด 160–314  DB_* helper functions (CRUD)
02_Auth        บรรทัด 317–452  Token, Login, Permission
03_Setup       บรรทัด 455–530  setupSystem(), seedAreas()
04_Server      บรรทัด 533–651  doGet(), doPost(), callAPI(), _dispatch()
05_Api         บรรทัด 654–1148 API functions ทั้งหมด
06_AI          บรรทัด 1150+    Gemini AI integration + WMS proxy
```

### 4.2 Constants หลัก

```javascript
var APP = {
  NAME: 'ระบบติดตามแปลงส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค',
  SHORT: 'CassavaPlot Monitor',
  VERSION: '4.0',
  DEFAULT_PROVINCE: 'กำแพงเพชร',
  TZ: 'Asia/Bangkok',
  TOKEN_SECRET_KEY: 'CASSAVA_TOKEN_SECRET',
  TOKEN_EXPIRE_HOURS: 168   // 7 วัน
};
```

### 4.3 Script Properties (ต้องตั้งก่อน deploy)

| Property Key | ค่า | ตั้งโดย |
|---|---|---|
| `SPREADSHEET_ID` | Spreadsheet ID | `setupSystem()` สร้างอัตโนมัติ |
| `ROOT_FOLDER_ID` | Drive Folder ID | `setupSystem()` สร้างอัตโนมัติ |
| `CASSAVA_TOKEN_SECRET` | JWT secret key | สร้างอัตโนมัติ |
| `GEMINI_API_KEY` | Gemini API key | ตั้งเองใน Script Properties (optional) |

### 4.4 Database — Google Sheets (13 ชีต)

ชีตทั้ง 13 ชีต: โครงการ, เกษตรกร, แปลง, การเจริญเติบโต, การเกิดโรค,  
ผลผลิต, ต้นทุนการผลิต, ผู้ใช้งาน, บันทึกการใช้งาน, พื้นที่อ้างอิง,  
คำขออนุมัติ, การประเมินแปลง, การขยายผลท่อนพันธุ์

### 4.5 Authentication

```
JWT format: base64(payload) + "." + base64(HMAC-SHA256 signature)
expire: 7 วัน
roles: admin | จังหวัด | อำเภอ | เกษตรกร
```

### 4.6 RBAC

| Role | สิทธิ์ |
|------|--------|
| admin | ทุกอย่าง |
| จังหวัด | เพิ่ม/แก้ไขทุกอำเภอ, อนุมัติ |
| อำเภอ | เพิ่มข้อมูล, แก้ไขผ่านอนุมัติ |
| เกษตรกร | ดูแปลงตัวเอง, บันทึกผ่านอนุมัติ |

### 4.7 Server Entry Points

```javascript
doGet(e)                              // Serve Index.html
callAPI(fnName, argsJson, token)      // Main API gateway (google.script.run)
doPost(e)                             // REST fallback
```

---

## 5. Index.html — Frontend SPA

### 5.1 โครงสร้าง HTML

```
#splash       → Loading screen
#login-wrap   → Login (staff/farmer tabs)
#shell
  .topbar     → Brand + year selector + user menu
  .sidenav    → Side navigation (desktop ≥920px)
  .main-wrap  → #content (page output)
  .bottomnav  → Mobile bottom nav
#modalOverlay → Modal
#toast        → Toast notification
```

### 5.2 State & Router

```javascript
var S = { page, params, user, token, year, cache };
go(page, params)       // navigate
refreshPage()          // re-render current page
API.call(fn, args)     // Promise wrapper around google.script.run
```

### 5.3 หน้าทั้งหมด (PAGES)

| Page | คำอธิบาย |
|------|---------|
| dashboard | ภาพรวม: stat cards, charts, กิจกรรมล่าสุด |
| search | Hero search แปลง (debounce 400ms) |
| plots | ทะเบียนแปลง + filter + quick search |
| plot-detail | รายละเอียดแปลง + mini-map + ข้อมูลดิน |
| plot-form | เพิ่ม/แก้ไขแปลง |
| assess-form | บันทึก Growth/Disease/Yield/Cost/Propagation |
| **map** | **แผนที่ Leaflet + WMS layers + GeoJSON layers** |
| track | สแกน QR code |
| projects | รายการโครงการ |
| approvals | รออนุมัติ |
| admin | จัดการผู้ใช้ |
| settings | ตั้งค่าบัญชี |

### 5.4 GeoJSON Layer System (ใหม่ใน v4)

```javascript
// config (ต้องแก้ก่อน deploy)
var GEOJSON_BASE_URL = 'https://YOUR_USERNAME.github.io/YOUR_REPO/geojson';
var GEO_LAYERS = {
  province:  { name:'ขอบเขตจังหวัด', file:'kpp_province.geojson',      ... },
  districts: { name:'ขอบเขตอำเภอ',   file:'kpp_districts.geojson',     ... },
  tambons:   { name:'ขอบเขตตำบล',    file:'kpp_tambons.geojson',        ... },
  cassava:   { name:'ความเหมาะสม',   file:'kpp_cassava_light.geojson',  ... }
};

// functions
loadGeoLayer(key, autoAdd)    // fetch + add to map
toggleGeoLayer(key, on)       // checkbox toggle handler
setGeoOpacity(key, val)       // opacity slider handler
```

**Flow:**  
เปิดหน้า map → `loadGeoLayer('province', true)` ทันที (14KB, เร็วมาก)  
ผู้ใช้กด checkbox → `toggleGeoLayer(key, true)` → fetch GeoJSON → `L.geoJSON().addTo(map)`

**GEOJSON_BASE_URL ต้องตั้งค่า** ก่อน deploy (ดู DEPLOY_GUIDE.md ขั้นตอน 7)

### 5.5 Map Layer Panel

```
Base Layer:  [OSM] [ดาวเทียม] [Topo]

── WMS (กรมพัฒนาที่ดิน) ──────────────
☐ ชุดดิน                    [===opacity===]
☐ ความเหมาะสมมันสำปะหลัง   [===opacity===]
☐ การใช้ประโยชน์ที่ดิน      [===opacity===]
☐ ค่า pH ดิน               [===opacity===]

── GeoJSON (จากโฟลเดอร์แผนที่) ───────
☐ ขอบเขตจังหวัด             [===opacity===]
☐ ขอบเขตอำเภอ (11 อำเภอ)   [===opacity===]
☐ ขอบเขตตำบล (78 ตำบล)     [===opacity===]
☐ ความเหมาะสมมันสำปะหลัง   [===opacity===]
```

---

## 6. GitHub + GAS Deployment Workflow

### 6.1 สรุปขั้นตอน (ดูรายละเอียดใน DEPLOY_GUIDE.md)

```
1. git init + github repo
2. npm install -g @google/clasp
3. clasp login → บันทึก ~/.clasprc.json
4. script.google.com → New project → copy scriptId
5. แก้ gas/.clasp.json ใส่ scriptId
6. แก้ Index.html: GEOJSON_BASE_URL ให้ตรงกับ GitHub Pages URL ของคุณ
7. git add + git push → GitHub Actions รัน deploy อัตโนมัติ
8. enable GitHub Pages (branch: main, folder: /)
9. GAS: Deploy as Web App → copy URL
```

### 6.2 GitHub Actions Pipeline

**Trigger:** `git push main` (เฉพาะถ้า files ใน `gas/` เปลี่ยน)

```yaml
jobs:
  deploy-gas:    # clasp push → Google Apps Script
  deploy-pages:  # GitHub Pages → serve geojson/ files
```

### 6.3 Secrets ที่ต้องตั้งใน GitHub

| Secret Name | ค่า |
|-------------|-----|
| `CLASPRC_JSON` | เนื้อหาของ `~/.clasprc.json` หลัง `clasp login` |

---

## 7. ข้อมูลอำเภอกำแพงเพชร (Lookup Table)

```javascript
var KPP_DISTRICT_TH = {
  'TH6201':'เมืองกำแพงเพชร', 'TH6202':'ไทรงาม',        'TH6203':'คลองลาน',
  'TH6204':'ขาณุวรลักษบุรี', 'TH6205':'คลองขลุง',       'TH6206':'พรานกระต่าย',
  'TH6207':'ลานกระบือ',      'TH6208':'ทรายทองวัฒนา', 'TH6209':'ปางศิลาทอง',
  'TH6210':'บึงสามัคคี',     'TH6211':'โกสัมพีนคร'
};
```

---

## 8. Known Issues & Limitations

### GAS
- Execution timeout: 6 นาที/request
- Cold start: 2-5 วินาที ถ้าไม่มีคนใช้งานนาน
- Concurrent users: GAS ไม่ใช่ server ถาวร อาจช้าถ้าหลายคนใช้พร้อมกัน

### GeoJSON
- `kpp_cassava_light.geojson` (1.75MB) — อาจโหลดช้าบน 3G
- ไม่รองรับการ dissolve polygon (ต้องใช้ geopandas/shapely) → มีหลาย polygon ต่อ suit class
- ชื่อตำบลใน GeoJSON เป็น RTGS (English) จาก OCHA HDX — ต้องมี lookup ถ้าต้องการแสดงภาษาไทย
- Layer `tambons` มี 78 polygons — tooltip อาจช้าบนมือถือ

### Camera (QR Scanner)
- ใช้ได้เฉพาะเมื่อเปิด URL ตรงใน browser (ไม่ใช่ iframe)

### WMS Agri-Map
- WMS tile ทำงานปกติ ไม่ติด CORS
- `GetFeatureInfo` (JSON) อาจถูก CORS block — ใช้ GAS proxy `api_fetchAllSoilData`

---

## 9. Development Notes

### เพิ่ม GeoJSON Layer ใหม่
1. วาง `.geojson` ไว้ใน `geojson/`
2. เพิ่ม entry ใน `GEO_LAYERS` ใน `Index.html`
3. Push → GitHub Pages จะ serve ไฟล์ใหม่ทันที

### เพิ่ม API Function ใหม่
1. เพิ่ม `api_newFunction(params)` ใน `Code.gs` section `05_Api`
2. เพิ่ม `case 'api_newFunction': return api_newFunction(args);` ใน `_dispatch()`
3. เรียกจาก frontend: `await API.call('api_newFunction', { ... })`

### Update GeoJSON Data
```bash
cd scripts/
pip install pyshp pyproj  # ครั้งแรกเท่านั้น
python convert_geojson.py
python convert_cassava_suit.py
```

### local dev (ไม่มี GAS)
ไม่รองรับ local dev โดยตรง เพราะ `google.script.run` ต้องรันบน GAS  
→ ใช้ clasp push แล้วทดสอบผ่าน Web App URL เสมอ

---

## 10. Checklist ก่อน Production

- [ ] แก้ `gas/.clasp.json` → ใส่ `scriptId` จริง
- [ ] แก้ `Index.html` → ใส่ `GEOJSON_BASE_URL` จริง  
      (รูปแบบ: `https://USERNAME.github.io/REPO/geojson`)
- [ ] ตั้ง GitHub Secret `CLASPRC_JSON`
- [ ] Enable GitHub Pages บน repo
- [ ] Push ไป `main` → ตรวจ GitHub Actions ผ่าน
- [ ] GAS: `setupSystem()` → สร้าง Spreadsheet
- [ ] GAS: เพิ่ม admin ใน sheet ผู้ใช้งาน
- [ ] GAS: Deploy as Web App → URL ใช้งานได้
- [ ] ทดสอบ map → province boundary โหลดอัตโนมัติ
- [ ] ทดสอบ toggle GeoJSON layers ทุกตัว
- [ ] (Optional) ตั้ง `GEMINI_API_KEY` ใน Script Properties

---

*CassavaPlot Monitor v4.0 | GitHub + GAS Edition*  
*อัปเดต: 2025 | สำนักงานเกษตรจังหวัดกำแพงเพชร*
