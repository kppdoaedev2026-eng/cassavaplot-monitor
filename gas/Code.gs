/**********************************************************************
 * CassavaPlot Monitor v3.0 — GAS Backend (All-in-One)
 * ระบบติดตามแปลงส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค
 * สำนักงานเกษตรจังหวัดกำแพงเพชร
 *
 * v3: GAS serve HTML ได้เลย ไม่ต้องใช้ Netlify
 *   - doGet()  → serve Index.html
 *   - callAPI() → รับ call จาก google.script.run
 *   - รหัสแปลง/โครงการ สร้างอัตโนมัติทั้งหมด
 **********************************************************************/

/* ===================== 00_Config ===================== */

var APP = {
  NAME: 'ระบบติดตามแปลงส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค',
  SHORT: 'CassavaPlot Monitor',
  VERSION: '3.0',
  DEFAULT_PROVINCE: 'กำแพงเพชร',
  TZ: 'Asia/Bangkok',
  TOKEN_SECRET_KEY: 'CASSAVA_TOKEN_SECRET',
  TOKEN_EXPIRE_HOURS: 168  /* 7 วัน */
};

var OPTIONS = {
  ROLES: ['admin', 'จังหวัด', 'อำเภอ', 'เกษตรกร'],
  PLOT_STATUS: ['กำลังปลูก', 'เจริญเติบโต', 'เก็บเกี่ยวแล้ว', 'ยกเลิก'],
  VARIETY_TYPE: ['พันธุ์ต้านทานโรค', 'พันธุ์ทั่วไป'],
  DISEASES: ['โรคใบด่างมันสำปะหลัง (CMD/SLCMV)', 'โรคพุ่มแจ้', 'โรคแอนแทรคโนส', 'อื่น ๆ'],
  SEVERITY: ['1 - น้อยมาก', '2 - น้อย', '3 - ปานกลาง', '4 - มาก', '5 - รุนแรง'],
  COST_TYPE: ['ท่อนพันธุ์', 'ปุ๋ย', 'สารป้องกันกำจัดศัตรูพืช', 'ค่าแรงงาน', 'ค่าน้ำมัน/เครื่องจักร', 'ค่าน้ำ', 'อื่น ๆ'],
  PROJECT_STATUS: ['วางแผน', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'],
  APPROVAL_STATUS: ['รออนุมัติ', 'อนุมัติแล้ว', 'ไม่อนุมัติ'],
  ASSESSMENT_ROUND: [
    'ครั้งที่ 1 (มันสำปะหลังอายุ 2–4 เดือน)',
    'ครั้งที่ 2 (มันสำปะหลังอายุ 4–6 เดือน)',
    'ครั้งที่ 3 (ก่อนเก็บเกี่ยว 1 เดือน)'
  ],
  STEM_DIAMETER: ['น้อยกว่า 2 เซนติเมตร', '2 เซนติเมตรขึ้นไป'],
  STEM_LENGTH: ['น้อยกว่า 80 เซนติเมตร', '80 เซนติเมตรขึ้นไป'],
  AREA_TYPE: ['พื้นที่สีเขียว (ห่างจากพื้นที่ระบาด > 10 กม.)', 'พื้นที่สีเหลือง (ห่างจากพื้นที่ระบาด 3–10 กม.)'],
  DISEASE_PATTERN: ['เป็นหย่อม', 'กระจายทั่วแปลง'],
  PEST_OTHERS: ['ไม่พบศัตรูพืช', 'พบเพลี้ยแป้ง', 'พบไรแดง', 'พบโรคพุ่มแจ้', 'อื่น ๆ'],
  ASSESSMENT_RESULT: ['ผ่าน', 'ไม่ผ่าน'],
  PROPAGATION_PURPOSE: [
    'ขยายพื้นที่ปลูกภายในครัวเรือน',
    'แจกจ่ายให้เกษตรกรในกลุ่ม',
    'จำหน่ายเชิงการค้า',
    'ส่งต่อตามโครงการ',
    'อื่น ๆ'
  ]
};

var IDP = {
  PROJECT: 'PJ', FARMER: 'FM', PLOT: 'PL', GROWTH: 'GR',
  DISEASE: 'DS', YIELD: 'YD', COST: 'CT', APPROVAL: 'AP',
  ASSESSMENT: 'AS', PROPAGATION: 'PR'
};

var SHEETS = {
  PROJECTS: {
    name: 'โครงการ',
    headers: ['รหัสโครงการ','ชื่อโครงการ','ปีงบประมาณ','งบประมาณ(บาท)','แหล่งงบประมาณ',
              'วันเริ่มโครงการ','วันสิ้นสุดโครงการ','ผู้รับผิดชอบ','สถานะ','หมายเหตุ',
              'วันที่บันทึก','ผู้บันทึก']
  },
  FARMERS: {
    name: 'เกษตรกร',
    headers: ['รหัสเกษตรกร','ชื่อ-สกุล','เลขบัตรประชาชน','โทรศัพท์','บ้านเลขที่/หมู่',
              'ตำบล','อำเภอ','จังหวัด','หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  },
  PLOTS: {
    name: 'แปลง',
    headers: ['รหัสแปลง','ปีงบประมาณ','ชื่อโครงการ','ชื่อกิจกรรม','ชื่อเจ้าของแปลง',
              'ที่อยู่','เบอร์โทรศัพท์','พันธุ์มันสำปะหลัง','ประเภทพันธุ์','พื้นที่(ไร่)',
              'จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)','ละติจูด','ลองจิจูด',
              'ตำบล','อำเภอ','จังหวัด','วันที่ปลูก','คาดว่าเก็บเกี่ยววันที่',
              'สถานะแปลง','ลิงก์โฟลเดอร์ภาพ','ภาพปกแปลง','หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  },
  GROWTH: {
    name: 'การเจริญเติบโต',
    headers: ['รหัสบันทึก','รหัสแปลง','วันที่ติดตาม','อายุพืช(วัน)','ความสูงเฉลี่ย(ซม.)',
              'จำนวนต้นต่อไร่','ความสมบูรณ์(1-5)','การให้น้ำ/ปุ๋ย','ผู้ติดตาม',
              'ลิงก์รูปภาพ','หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  },
  DISEASE: {
    name: 'การเกิดโรค',
    headers: ['รหัสบันทึก','รหัสแปลง','วันที่สำรวจ','ชนิดโรค','ระดับความรุนแรง',
              'เปอร์เซ็นต์การระบาด','จำนวนต้นที่พบ','การจัดการ/ควบคุม',
              'ละติจูดจุดพบ','ลองจิจูดจุดพบ','ผู้สำรวจ','ลิงก์รูปภาพ','หมายเหตุ',
              'วันที่บันทึก','ผู้บันทึก']
  },
  YIELD: {
    name: 'ผลผลิต',
    headers: ['รหัสบันทึก','รหัสแปลง','วันที่เก็บเกี่ยว','ผลผลิตรวม(ตัน)','ผลผลิตต่อไร่(ตัน/ไร่)',
              'เปอร์เซ็นต์เชื้อแป้ง','ราคาขาย(บาท/ตัน)','รายได้รวม(บาท)','ผู้รับซื้อ',
              'หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  },
  COST: {
    name: 'ต้นทุนการผลิต',
    headers: ['รหัสบันทึก','รหัสแปลง','ประเภทต้นทุน','รายการ','จำนวนเงิน(บาท)',
              'วันที่','หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  },
  USERS: {
    name: 'ผู้ใช้งาน',
    headers: ['อีเมล','ชื่อ-สกุล','บทบาท','อำเภอที่รับผิดชอบ','สถานะ','เบอร์โทร','PIN','วันที่บันทึก']
  },
  AUDIT: {
    name: 'บันทึกการใช้งาน',
    headers: ['เวลา','ผู้ใช้','การกระทำ','ตาราง','รหัสอ้างอิง','รายละเอียด']
  },
  AREAS: {
    name: 'พื้นที่อ้างอิง',
    headers: ['จังหวัด','อำเภอ','ตำบล']
  },
  APPROVALS: {
    name: 'คำขออนุมัติ',
    headers: ['รหัสคำขอ','ประเภท','ตาราง','ชื่อตาราง','รหัสอ้างอิง','รายละเอียดย่อ',
              'ข้อมูล(JSON)','ผู้ขอ','บทบาทผู้ขอ','วันที่ขอ','สถานะ',
              'ผู้พิจารณา','วันที่พิจารณา','เหตุผล']
  },
  ASSESSMENTS: {
    name: 'การประเมินแปลง',
    headers: ['รหัสการประเมิน','รหัสแปลง','ครั้งที่ประเมิน','วันที่ประเมิน',
              'อายุต้นพันธุ์(เดือน)','อายุต้นพันธุ์(วัน)',
              'ขนาดเส้นผ่านศูนย์กลางท่อนพันธุ์','ความยาวท่อนพันธุ์(ลำ)',
              'ประเภทพื้นที่','พบโรคใบด่าง','อัตราร้อยละโรคใบด่าง',
              'ลักษณะการระบาด','รายการศัตรูพืชอื่น','ผลการประเมิน','หมายเหตุ',
              'ลิงก์รูปที่1','ลิงก์รูปที่2','ลิงก์รูปที่3','ลิงก์รูปที่4','ลิงก์รูปที่5',
              'วันที่บันทึก','ผู้บันทึก']
  },
  PROPAGATIONS: {
    name: 'การขยายผลท่อนพันธุ์',
    headers: ['รหัสการขยายผล','รหัสแปลงต้นทาง','วันที่แจกจ่าย',
              'จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)','ชื่อผู้รับท่อนพันธุ์','เบอร์โทรผู้รับ',
              'ที่อยู่ผู้รับ','ตำบล','อำเภอ','จังหวัด',
              'พันธุ์มันสำปะหลัง','วัตถุประสงค์','หมายเหตุ','วันที่บันทึก','ผู้บันทึก']
  }
};

function CFG_get(key, def) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return (v === null || v === undefined) ? (def || '') : v;
}
function CFG_set(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, String(val));
}
function CFG_spreadsheetId() { return CFG_get('SPREADSHEET_ID', ''); }
function CFG_rootFolderId()  { return CFG_get('ROOT_FOLDER_ID', ''); }
function CFG_geminiKey()     { return CFG_get('GEMINI_API_KEY', ''); }
function CFG_tokenSecret()   {
  var s = CFG_get(APP.TOKEN_SECRET_KEY, '');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    CFG_set(APP.TOKEN_SECRET_KEY, s);
  }
  return s;
}


/* ===================== 01_Database ===================== */

var __DB_CACHE = {};
function DB_cacheClear(key) { if (key) { delete __DB_CACHE[key]; } else { __DB_CACHE = {}; } }

function DB_ss() {
  var id = CFG_spreadsheetId();
  if (!id) throw new Error('ยังไม่ได้ตั้งค่าระบบ กรุณาเรียก setupSystem() ก่อน');
  return SpreadsheetApp.openById(id);
}
function DB_sheet(key) {
  var def = SHEETS[key];
  if (!def) throw new Error('ไม่พบนิยามตาราง: ' + key);
  var sh = DB_ss().getSheetByName(def.name);
  if (!sh) throw new Error('ไม่พบชีต "' + def.name + '" — โปรดเรียก setupSystem()');
  return sh;
}
function DB_headerMap(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol === 0) return {};
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < head.length; i++) {
    var k = String(head[i]).trim();
    if (k) map[k] = i;
  }
  return map;
}
function DB_normalize(v) {
  if (v instanceof Date) return Utilities.formatDate(v, APP.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  return v;
}
function DB_readAll(key) {
  if (__DB_CACHE[key]) return __DB_CACHE[key];
  var sh = DB_sheet(key);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol === 0) { __DB_CACHE[key] = []; return []; }
  var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var blank = row.every(function(c) { return c === '' || c === null; });
    if (blank) continue;
    var obj = { _row: r + 2 };
    for (var c = 0; c < head.length; c++) {
      var h = String(head[c]).trim();
      if (h) obj[h] = DB_normalize(row[c]);
    }
    out.push(obj);
  }
  __DB_CACHE[key] = out;
  return out;
}
function DB_findBy(key, header, value) {
  var rows = DB_readAll(key);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][header]).toLowerCase() === String(value).toLowerCase()) return rows[i];
  }
  return null;
}
function DB_insert(key, obj) {
  var sh = DB_sheet(key);
  var map = DB_headerMap(sh);
  var lastCol = sh.getLastColumn();
  var rowArr = new Array(lastCol).fill('');
  Object.keys(obj).forEach(function(h) {
    if (map.hasOwnProperty(h)) rowArr[map[h]] = obj[h];
  });
  sh.appendRow(rowArr);
  DB_cacheClear(key);
  return sh.getLastRow();
}
function DB_updateById(key, idHeader, idValue, patch) {
  var sh = DB_sheet(key);
  var map = DB_headerMap(sh);
  var idCol = map[idHeader];
  if (idCol === undefined) throw new Error('ไม่พบคอลัมน์รหัส: ' + idHeader);
  var lastRow = sh.getLastRow();
  var ids = sh.getRange(2, idCol + 1, Math.max(lastRow - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).toLowerCase() === String(idValue).toLowerCase()) {
      var rowNum = i + 2;
      Object.keys(patch).forEach(function(h) {
        if (map.hasOwnProperty(h)) sh.getRange(rowNum, map[h] + 1).setValue(patch[h]);
      });
      DB_cacheClear(key);
      return rowNum;
    }
  }
  throw new Error('ไม่พบข้อมูลรหัส: ' + idValue);
}
function DB_deleteById(key, idHeader, idValue) {
  var sh = DB_sheet(key);
  var map = DB_headerMap(sh);
  var idCol = map[idHeader];
  if (idCol === undefined) throw new Error('ไม่พบคอลัมน์รหัส: ' + idHeader);
  var lastRow = sh.getLastRow();
  var ids = sh.getRange(2, idCol + 1, Math.max(lastRow - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).toLowerCase() === String(idValue).toLowerCase()) {
      sh.deleteRow(i + 2);
      DB_cacheClear(key);
      return true;
    }
  }
  return false;
}
function DB_nextId(prefix, key, idHeader, opt) {
  opt = opt || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    DB_cacheClear(key);
    var rows = DB_readAll(key);
    var max = 0;
    if (opt.middle) {
      var pfx = prefix + '-' + opt.middle + '-';
      rows.forEach(function(r) {
        var id = String(r[idHeader] || '');
        if (id.indexOf(pfx) === 0) {
          var n = parseInt(id.slice(pfx.length), 10);
          if (!isNaN(n) && n > max) max = n;
        }
      });
    } else {
      var re = new RegExp('(\\d+)$');
      rows.forEach(function(r) {
        var id = String(r[idHeader] || '');
        var m = id.match(re);
        if (m) { var n = parseInt(m[1], 10); if (n > max) max = n; }
      });
    }
    var num = String(max + 1).padStart(opt.pad || 4, '0');
    if (opt.middle) return prefix + '-' + opt.middle + '-' + num;
    return prefix + '-' + num;
  } finally {
    lock.releaseLock();
  }
}
function DB_audit(action, tableKey, refId, detail, whoOverride) {
  try {
    var sh = DB_sheet('AUDIT');
    var name = (SHEETS[tableKey] && SHEETS[tableKey].name) || tableKey;
    var who = whoOverride || __CURRENT_USER_ID || 'ระบบ';
    sh.appendRow([
      Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss'),
      who, action, name, refId || '', detail || ''
    ]);
  } catch (e) {}
}
function DB_now() {
  return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd HH:mm:ss');
}


/* ===================== 02_Auth — Token-based ===================== */

var __CURRENT_USER = null;
var __CURRENT_USER_ID = '';

function AUTH_normalizePhone(phone) {
  if (!phone) return '';
  var p = String(phone).replace(/[\s\-\.]/g, '');
  if (p.startsWith('+66')) p = '0' + p.slice(3);
  else if (p.startsWith('0066')) p = '0' + p.slice(4);
  else if (p.startsWith('66') && p.length === 11) p = '0' + p.slice(2);
  p = p.replace(/\D/g, '');
  // กรณี Sheets แปลงเบอร์โทรเป็นตัวเลข ทำให้ 0 นำหน้าหายไป (8-9 หลัก → เติม 0)
  if (p.length === 9 || p.length === 8) p = '0' + p;
  return p;
}

function AUTH_createToken(payload) {
  payload.exp = Date.now() + APP.TOKEN_EXPIRE_HOURS * 3600 * 1000;
  var data = Utilities.base64Encode(JSON.stringify(payload));
  var secret = CFG_tokenSecret();
  var sig = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(data, secret)
  );
  return data + '.' + sig;
}

function AUTH_verifyToken(token) {
  if (!token) return null;
  try {
    var parts = String(token).split('.');
    if (parts.length !== 2) return null;
    var data = parts[0];
    var sig = parts[1];
    var secret = CFG_tokenSecret();
    var expected = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(data, secret)
    );
    if (sig !== expected) return null;
    var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(data)).getDataAsString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function api_loginStaff(params) {
  var phone = AUTH_normalizePhone(params.phone);
  var pin   = String(params.pin || '').trim();
  if (!phone) return { ok: false, error: 'กรุณากรอกเบอร์โทรศัพท์' };
  var users = DB_readAll('USERS');
  var me = null; var pendingMe = null;
  for (var i = 0; i < users.length; i++) {
    if (AUTH_normalizePhone(users[i]['เบอร์โทร']) === phone) {
      var st = String(users[i]['สถานะ'] || '');
      if (st === 'ปิดใช้งาน') continue;
      if (st === 'รออนุมัติ') { pendingMe = users[i]; continue; }
      me = users[i]; break;
    }
  }
  if (!me && pendingMe) return { ok: false, error: 'บัญชีของท่านอยู่ระหว่างการพิจารณา กรุณารอการอนุมัติจาก Admin' };
  if (!me) return { ok: false, error: 'ไม่พบเบอร์โทรนี้ในระบบ กรุณาติดต่อเจ้าหน้าที่ผู้ดูแล' };
  var storedPin = String(me['PIN'] || '').trim();
  if (storedPin && pin !== storedPin) return { ok: false, error: 'PIN ไม่ถูกต้อง' };
  var payload = {
    id: me['อีเมล'] || phone, name: me['ชื่อ-สกุล'] || phone,
    role: me['บทบาท'] || 'อำเภอ', district: me['อำเภอที่รับผิดชอบ'] || '',
    phone: phone, type: 'staff'
  };
  var token = AUTH_createToken(payload);
  DB_audit('เข้าสู่ระบบ', 'USERS', phone, 'staff login', phone);
  return { ok: true, token: token, user: payload, webAppUrl: SRV_webAppUrl() };
}

function api_loginFarmer(params) {
  var phone = AUTH_normalizePhone(params.phone);
  if (!phone) return { ok: false, error: 'กรุณากรอกเบอร์โทรศัพท์' };
  var plots = DB_readAll('PLOTS');
  var myPlots = []; var ownerName = '';
  for (var i = 0; i < plots.length; i++) {
    if (AUTH_normalizePhone(plots[i]['เบอร์โทรศัพท์']) === phone) {
      myPlots.push(plots[i]['รหัสแปลง']);
      if (!ownerName) ownerName = plots[i]['ชื่อเจ้าของแปลง'] || '';
    }
  }
  if (myPlots.length === 0) return { ok: false, error: 'ไม่พบเบอร์โทรนี้ในข้อมูลแปลง กรุณาติดต่อเจ้าหน้าที่' };
  var payload = {
    id: 'farmer_' + phone, name: ownerName || ('เกษตรกร ' + phone),
    role: 'เกษตรกร', district: '', phone: phone, plotIds: myPlots, type: 'farmer'
  };
  var token = AUTH_createToken(payload);
  DB_audit('เข้าสู่ระบบ', 'PLOTS', phone, 'farmer login', phone);
  return { ok: true, token: token, user: payload, webAppUrl: SRV_webAppUrl() };
}

function AUTH_setCurrentUser(token) {
  __CURRENT_USER = null; __CURRENT_USER_ID = '';
  if (!token) return;
  var payload = AUTH_verifyToken(token);
  if (!payload) return;
  __CURRENT_USER = payload;
  __CURRENT_USER_ID = payload.id || payload.phone || '';
}

function AUTH_current() {
  if (__CURRENT_USER) return __CURRENT_USER;
  return { id: '', name: 'ผู้เยี่ยมชม', role: 'public', district: '', phone: '', type: 'public' };
}

function AUTH_isAdmin(u)    { return (u || AUTH_current()).role === 'admin'; }
function AUTH_canEdit(u)    { var r = (u || AUTH_current()).role; return r === 'admin' || r === 'จังหวัด' || r === 'อำเภอ'; }
function AUTH_canDelete(u)  { return AUTH_isAdmin(u); }
function AUTH_canApprove(u) { var r = (u || AUTH_current()).role; return r === 'admin' || r === 'จังหวัด'; }

function AUTH_needsApproval(u, action, tableKey) {
  u = u || AUTH_current();
  if (u.role === 'admin' || u.role === 'จังหวัด') return false;
  // อำเภอ: ต้องอนุมัติเฉพาะการแก้ไขข้อมูลหลักของแปลง (PLOT master edit)
  // การเพิ่มบันทึกย่อย (growth/disease/yield/cost/assessment/propagation) ทำได้ทันที
  if (u.role === 'อำเภอ') return action === 'แก้ไข' && tableKey === 'PLOTS';
  // เกษตรกร: บันทึกข้อมูลแปลงตัวเองได้โดยตรงทุกระยะ ไม่ต้องรออนุมัติ
  return false;
}

function AUTH_requireEdit()    { if (!AUTH_canEdit())    throw new Error('สิทธิ์ไม่เพียงพอ: ต้องเป็นเจ้าหน้าที่ขึ้นไป'); }
function AUTH_requireDelete()  { if (!AUTH_canDelete())  throw new Error('สิทธิ์ไม่เพียงพอ: เฉพาะผู้ดูแลระบบ'); }
function AUTH_requireAdmin()   { if (!AUTH_isAdmin())    throw new Error('สิทธิ์ไม่เพียงพอ: เฉพาะผู้ดูแลระบบ'); }
function AUTH_requireApprove() { if (!AUTH_canApprove()) throw new Error('สิทธิ์ไม่เพียงพอ: เฉพาะผู้อนุมัติ'); }

function AUTH_scopePlots(plots, u) {
  u = u || AUTH_current();
  if (u.role === 'admin' || u.role === 'จังหวัด') return plots;
  if (u.role === 'อำเภอ') return plots.filter(function(p) { return String(p['อำเภอ']) === String(u.district); });
  if (u.role === 'เกษตรกร') {
    var ids = u.plotIds || [];
    if (ids.length === 0) {
      var phone = AUTH_normalizePhone(u.phone);
      return plots.filter(function(p) { return AUTH_normalizePhone(p['เบอร์โทรศัพท์']) === phone; });
    }
    return plots.filter(function(p) { return ids.indexOf(p['รหัสแปลง']) !== -1; });
  }
  return [];
}


/* ===================== 03_Setup ===================== */

function setupSystem() {
  var props = PropertiesService.getScriptProperties();
  var ssId = CFG_spreadsheetId();
  var ss;
  if (ssId) {
    ss = SpreadsheetApp.openById(ssId);
  } else {
    ss = SpreadsheetApp.create(APP.NAME + ' — ฐานข้อมูล');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  Object.keys(SHEETS).forEach(function(key) {
    var def = SHEETS[key];
    var sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    var firstRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var empty = firstRow.every(function(c) { return c === '' || c === null; });
    if (empty) {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
    } else {
      var existingHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
      def.headers.forEach(function(h) {
        if (existingHeaders.indexOf(h) === -1) {
          var col = sh.getLastColumn() + 1;
          sh.getRange(1, col).setValue(h);
          sh.getRange(1, col).setFontWeight('bold').setBackground('#1b5e20').setFontColor('#ffffff');
          existingHeaders.push(h);
        }
      });
    }
    var hr = sh.getRange(1, 1, 1, sh.getLastColumn());
    hr.setFontWeight('bold').setBackground('#1b5e20').setFontColor('#ffffff')
      .setVerticalAlignment('middle').setWrap(true);
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 40);
  });
  ['Sheet1', 'ชีต1'].forEach(function(n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  var rootId = CFG_rootFolderId();
  if (!rootId) {
    var root = DriveApp.createFolder(APP.NAME + ' — คลังภาพ/เอกสาร');
    props.setProperty('ROOT_FOLDER_ID', root.getId());
  }
  CFG_tokenSecret();
  if (DB_readAll('AREAS').length === 0) SETUP_seedAreas();
  SETUP_seedAdmin();
  SETUP_setTextColumns(ss);
  var url = ss.getUrl();
  Logger.log('ติดตั้งระบบ v' + APP.VERSION + ' สำเร็จ\nSpreadsheet: ' + url);
  return { ok: true, spreadsheetUrl: url, spreadsheetId: ss.getId(), version: APP.VERSION };
}

function SETUP_seedAreas() {
  var rows = [
    ['กำแพงเพชร','เมืองกำแพงเพชร','นาบ่อคำ'],
    ['กำแพงเพชร','เมืองกำแพงเพชร','นครชุม'],
    ['กำแพงเพชร','เมืองกำแพงเพชร','ท่าขุนราม'],
    ['กำแพงเพชร','คลองลาน','คลองน้ำไหล'],
    ['กำแพงเพชร','คลองลาน','โป่งน้ำร้อน'],
    ['กำแพงเพชร','คลองลาน','สักงาม'],
    ['กำแพงเพชร','คลองขลุง','คลองสมบูรณ์'],
    ['กำแพงเพชร','คลองขลุง','วังไทร'],
    ['กำแพงเพชร','ขาณุวรลักษบุรี','วังชะพลู'],
    ['กำแพงเพชร','ขาณุวรลักษบุรี','บ่อถ้ำ'],
    ['กำแพงเพชร','ไทรงาม','ไทรงาม'],
    ['กำแพงเพชร','พรานกระต่าย','พรานกระต่าย'],
    ['กำแพงเพชร','ลานกระบือ','ลานกระบือ'],
    ['กำแพงเพชร','ทรายทองวัฒนา','ทุ่งทราย'],
    ['กำแพงเพชร','บึงสามัคคี','วังชะโอน'],
    ['กำแพงเพชร','ปางศิลาทอง','ปางตาไว'],
    ['กำแพงเพชร','โกสัมพีนคร','โกสัมพี']
  ];
  var sh = DB_sheet('AREAS');
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  DB_cacheClear('AREAS');
}

function SETUP_seedAdmin() {
  var adminPhone = '0805165313';
  var adminPin   = '123651';
  DB_cacheClear('USERS');
  var users = DB_readAll('USERS');
  var existing = null;
  for (var i = 0; i < users.length; i++) {
    if (AUTH_normalizePhone(users[i]['เบอร์โทร']) === adminPhone) { existing = users[i]; break; }
  }
  if (!existing) {
    DB_insert('USERS', {
      'อีเมล': adminPhone, 'ชื่อ-สกุล': 'ผู้ดูแลระบบ', 'บทบาท': 'admin',
      'อำเภอที่รับผิดชอบ': '', 'สถานะ': 'ใช้งาน',
      'เบอร์โทร': adminPhone, 'PIN': adminPin, 'วันที่บันทึก': DB_now()
    });
  } else if (String(existing['บทบาท'] || '') !== 'admin') {
    DB_updateById('USERS', 'อีเมล', existing['อีเมล'] || adminPhone,
      { 'บทบาท': 'admin', 'PIN': adminPin, 'สถานะ': 'ใช้งาน' });
  }
  DB_cacheClear('USERS');
}

function SETUP_setTextColumns(ss) {
  if (!ss) ss = DB_ss();
  var phoneHeaders = ['โทรศัพท์','เบอร์โทรศัพท์','เบอร์โทร','เบอร์โทรผู้รับ','อีเมล'];
  ss.getSheets().forEach(function(sh) {
    var lastCol = sh.getLastColumn();
    if (!lastCol) return;
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    headers.forEach(function(h, i) {
      if (phoneHeaders.indexOf(String(h).trim()) !== -1) {
        sh.getRange(2, i + 1, 5000, 1).setNumberFormat('@');
      }
    });
  });
}


/* ===================== 04_Server — doGet / doPost / callAPI ===================== */

/* doGet: serve Index.html */
function doGet(e) {
  var html = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ระบบติดตามแปลงส่งเสริมมันสำปะหลัง — กำแพงเพชร')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

/* doPost: fallback สำหรับ API call แบบเดิม (ไว้รองรับ external tools) */
function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var fn   = body.fn || '';
    var args = body.args || body.params || {};
    var token = body.token || '';
    AUTH_setCurrentUser(token);
    var publicFns = ['api_loginStaff', 'api_loginFarmer', 'api_getPublicPlot', 'setupSystem', 'api_registerStaff'];
    if (publicFns.indexOf(fn) === -1 && !__CURRENT_USER) {
      result = { ok: false, error: 'กรุณาเข้าสู่ระบบก่อน', code: 401 };
    } else {
      result = _dispatch(fn, args);
    }
  } catch (err) {
    result = { ok: false, error: err.message || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * callAPI: จุดเข้าหลักจาก google.script.run (frontend เรียก)
 * @param {string} fnName  ชื่อ function เช่น 'api_listPlots'
 * @param {string} argsJson JSON.stringify ของ arguments
 * @param {string} token   JWT token
 * @returns {string} JSON.stringify ของ result
 */
function callAPI(fnName, argsJson, token) {
  try {
    var args = {};
    try { args = argsJson ? JSON.parse(argsJson) : {}; } catch(e) { args = {}; }
    AUTH_setCurrentUser(token || '');
    var publicFns = ['api_loginStaff', 'api_loginFarmer', 'api_getPublicPlot', 'setupSystem', 'api_registerStaff'];
    if (publicFns.indexOf(fnName) === -1 && !__CURRENT_USER) {
      return JSON.stringify({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน', code: 401 });
    }
    return JSON.stringify(_dispatch(fnName, args));
  } catch(err) {
    return JSON.stringify({ ok: false, error: err.message || String(err) });
  }
}

function _dispatch(fn, args) {
  switch (fn) {
    case 'api_loginStaff':       return api_loginStaff(args);
    case 'api_loginFarmer':      return api_loginFarmer(args);
    case 'api_refreshToken':     return api_refreshToken(args);
    case 'api_boot':             return api_boot(args);
    case 'api_listProjects':     return api_listProjects();
    case 'api_saveProject':      return api_saveProject(args);
    case 'api_deleteProject':    return api_deleteProject(args.id);
    case 'api_listFarmers':      return api_listFarmers();
    case 'api_saveFarmer':       return api_saveFarmer(args);
    case 'api_deleteFarmer':     return api_deleteFarmer(args.id);
    case 'api_listPlots':        return api_listPlots(args);
    case 'api_savePlot':         return api_savePlot(args);
    case 'api_deletePlot':       return api_deletePlot(args.id);
    case 'api_plotDetail':       return api_plotDetail(args.plotId || args.id);
    case 'api_getPublicPlot':    return api_getPublicPlot_v3(args);
    case 'api_addGrowth':        return api_addGrowth_v3(args);
    case 'api_addDisease':       return api_addDisease_v3(args);
    case 'api_addYield':         return api_addYield_v3(args);
    case 'api_addCost':          return api_addCost_v3(args);
    case 'api_deleteSub':        return api_deleteSub(args.key, args.id);
    case 'api_updateSub':        return api_updateSub(args.key, args.id, args.patch);
    case 'api_addAssessment':    return api_addAssessment(args);
    case 'api_addAssessment_v3': return api_addAssessment_v3(args);
    case 'api_deleteAssessment': return api_deleteAssessment(args.id);
    case 'api_addPropagation':   return api_addPropagation_v3(args);
    case 'api_deletePropagation':return api_deletePropagation(args.id);
    case 'api_uploadPhoto':      return api_uploadPhoto(args);
    case 'api_dashboard':        return api_dashboard(args);
    case 'api_listUsers':        return api_listUsers();
    case 'api_saveUser':         return api_saveUser(args);
    case 'api_deleteUser':       return api_deleteUser(args.id || args.email);
    case 'api_setPin':           return api_setPin(args);
    case 'api_listAreas':        return api_listAreas();
    case 'api_addArea':          return api_addArea(args.province, args.district, args.subdistrict);
    case 'api_auditLog':         return api_auditLog(args.limit);
    case 'api_listTable':        return api_listTable(args.key);
    case 'api_listApprovals':    return api_listApprovals(args.status);
    case 'api_pendingCount':     return api_pendingCount();
    case 'api_approveChange':    return api_approveChange(args.id);
    case 'api_rejectChange':     return api_rejectChange(args.id, args.reason);
    case 'api_aiAnalyzePlot':    return api_aiAnalyzePlot(args.plotId);
    case 'api_aiGemini':         return api_aiGemini(args.prompt);
    case 'api_aiFullAnalysis':   return api_aiFullAnalysis(args);
    case 'api_aiGenerateReport': return api_aiGenerateReport(args);
    case 'setupSystem':          return setupSystem();
    // ── v3 bridge (frontend API names) ──
    case 'api_verifyToken':         return api_verifyToken_v3(args);
    case 'api_getDashboard':        return api_getDashboard_v3(args);
    case 'api_getPlots':            return api_getPlots_v3(args);
    case 'api_searchPlots':         return api_searchPlots_v3(args);
    case 'api_getPlotDetail':       return api_getPlotDetail_v3(args);
    case 'api_addPlot':             return api_addPlot_v3(args);
    case 'api_updatePlot':          return api_updatePlot_v3(args);
    case 'api_getProjects':         return api_getProjects_v3(args);
    case 'api_addProject':          return api_addProject_v3(args);
    case 'api_updateProject':       return api_updateProject_v3(args);
    case 'api_getAreas':            return api_getAreas_v3(args);
    case 'api_getUsers':            return api_getUsers_v3(args);
    case 'api_addUser':             return api_addUser_v3(args);
    case 'api_resetPin':            return api_resetPin_v3(args);
    case 'api_changePin':           return api_changePin_v3(args);
    case 'api_getPendingApprovals': return api_getPendingApprovals_v3(args);
    case 'api_approveRequest':      return api_approveRequest_v3(args);
    case 'api_registerStaff':       return api_registerStaff(args);
    case 'api_approveUser':         return api_approveUser(args);
    case 'api_getPendingUsers':     return api_getPendingUsers();
    case 'api_getLineConfig':       return api_getLineConfig();
    case 'api_saveLineConfig':      return api_saveLineConfig(args);
    case 'api_testLineNotify':      return api_testLineNotify();
    case 'api_getReportData':       return api_getReportData(args);
    case 'api_fetchAllSoilData':    return api_fetchAllSoilData(args);
    default:
      return { ok: false, error: 'ไม่พบฟังก์ชัน: ' + fn };
  }
}

function SRV_webAppUrl() {
  try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; }
}
function SRV_ensurePlotFolder(plot) {
  var root = DriveApp.getFolderById(CFG_rootFolderId());
  var year = String(plot['ปีงบประมาณ'] || 'ไม่ระบุปี');
  var dist = String(plot['อำเภอ'] || 'ไม่ระบุอำเภอ');
  var f1 = SRV_subFolder(root, 'ปีงบประมาณ ' + year);
  var f2 = SRV_subFolder(f1, 'อำเภอ' + dist);
  var f3 = SRV_subFolder(f2, plot['รหัสแปลง'] + ' - ' + (plot['ชื่อเจ้าของแปลง'] || ''));
  return f3;
}
function SRV_subFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}


/* ===================== 05_Api ===================== */

function api_refreshToken() {
  var u = AUTH_current();
  if (u.role === 'public') return { ok: false, error: 'ไม่ได้เข้าสู่ระบบ' };
  var token = AUTH_createToken({
    id: u.id, name: u.name, role: u.role, district: u.district,
    phone: u.phone, plotIds: u.plotIds, type: u.type
  });
  return { ok: true, token: token };
}

function api_boot(params) {
  params = params || {};
  var u        = AUTH_current();
  var areas    = DB_readAll('AREAS');
  var allPlots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  var projects = DB_readAll('PROJECTS');
  var pending  = AUTH_canApprove(u)
    ? DB_readAll('APPROVALS').filter(function(r) { return r['สถานะ'] === 'รออนุมัติ'; }).length
    : 0;
  var plots = params.year
    ? allPlots.filter(function(p) { return String(p['ปีงบประมาณ'] || '') === String(params.year); })
    : allPlots;
  var yearsSet = {};
  allPlots.forEach(function(p) { var y = String(p['ปีงบประมาณ'] || ''); if (y) yearsSet[y] = true; });
  return {
    ok: true,
    configured: !!CFG_spreadsheetId(),
    app: { name: APP.NAME, short: APP.SHORT, version: APP.VERSION, province: APP.DEFAULT_PROVINCE },
    user: u,
    perms: {
      isAdmin: AUTH_isAdmin(u), canEdit: AUTH_canEdit(u),
      canDelete: AUTH_canDelete(u), canApprove: AUTH_canApprove(u),
      canField: AUTH_canEdit(u) || u.role === 'เกษตรกร'
    },
    pendingCount: pending, options: OPTIONS, areas: areas,
    webAppUrl: SRV_webAppUrl(), geminiEnabled: !!CFG_geminiKey(),
    plots: plots, projects: projects,
    dashboard: api_dashboard(params),
    filters: { years: Object.keys(yearsSet).sort() }
  };
}

/* โครงการ */
function api_listProjects() { return DB_readAll('PROJECTS'); }
function api_saveProject(data) {
  AUTH_requireEdit();
  if (data['รหัสโครงการ']) {
    DB_updateById('PROJECTS', 'รหัสโครงการ', data['รหัสโครงการ'], data);
    DB_audit('แก้ไข', 'PROJECTS', data['รหัสโครงการ'], data['ชื่อโครงการ'] || '');
    return { ok: true, id: data['รหัสโครงการ'] };
  }
  var id = DB_nextId(IDP.PROJECT, 'PROJECTS', 'รหัสโครงการ', { middle: data['ปีงบประมาณ'] || '0000', pad: 3 });
  data['รหัสโครงการ'] = id;
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert('PROJECTS', data);
  DB_audit('เพิ่ม', 'PROJECTS', id, data['ชื่อโครงการ'] || '');
  return { ok: true, id: id };
}
function api_deleteProject(id) {
  AUTH_requireDelete();
  DB_deleteById('PROJECTS', 'รหัสโครงการ', id);
  DB_audit('ลบ', 'PROJECTS', id, '');
  return { ok: true };
}

/* เกษตรกร */
function api_listFarmers() { return DB_readAll('FARMERS'); }
function api_saveFarmer(data) {
  AUTH_requireEdit();
  if (data['รหัสเกษตรกร']) {
    DB_updateById('FARMERS', 'รหัสเกษตรกร', data['รหัสเกษตรกร'], data);
    DB_audit('แก้ไข', 'FARMERS', data['รหัสเกษตรกร'], data['ชื่อ-สกุล'] || '');
    return { ok: true, id: data['รหัสเกษตรกร'] };
  }
  var id = DB_nextId(IDP.FARMER, 'FARMERS', 'รหัสเกษตรกร', { pad: 4 });
  data['รหัสเกษตรกร'] = id;
  data['จังหวัด'] = data['จังหวัด'] || APP.DEFAULT_PROVINCE;
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert('FARMERS', data);
  DB_audit('เพิ่ม', 'FARMERS', id, data['ชื่อ-สกุล'] || '');
  return { ok: true, id: id };
}
function api_deleteFarmer(id) {
  AUTH_requireDelete();
  DB_deleteById('FARMERS', 'รหัสเกษตรกร', id);
  DB_audit('ลบ', 'FARMERS', id, '');
  return { ok: true };
}

/* แปลง */
function api_listPlots(params) {
  params = params || {};
  var u = AUTH_current();
  var plots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  if (params.year)     plots = plots.filter(function(p) { return String(p['ปีงบประมาณ'] || '') === String(params.year); });
  if (params.district) plots = plots.filter(function(p) { return p['อำเภอ'] === params.district; });
  return plots;
}

function api_savePlot(data) {
  var u = AUTH_current();
  AUTH_requireEdit();
  if (data['รหัสแปลง']) {
    if (AUTH_needsApproval(u, 'แก้ไข', 'PLOTS')) {
      return APPR_create('แก้ไข', 'PLOTS', data['รหัสแปลง'], data,
        'แก้ไขแปลง ' + (data['ชื่อเจ้าของแปลง'] || data['รหัสแปลง']), u);
    }
    return _applyPlotUpdate(data);
  }
  var id = DB_nextId(IDP.PLOT, 'PLOTS', 'รหัสแปลง', { pad: 4 });
  data['รหัสแปลง'] = id;
  data['จังหวัด'] = data['จังหวัด'] || APP.DEFAULT_PROVINCE;
  if (!data['คาดว่าเก็บเกี่ยววันที่'] && data['วันที่ปลูก']) {
    try {
      var harvest = new Date(data['วันที่ปลูก']);
      harvest.setDate(harvest.getDate() + 300);
      data['คาดว่าเก็บเกี่ยววันที่'] = Utilities.formatDate(harvest, APP.TZ, 'yyyy-MM-dd');
    } catch (e) {}
  }
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert('PLOTS', data);
  DB_audit('เพิ่ม', 'PLOTS', id, data['ชื่อเจ้าของแปลง'] || '');
  try { LINE_newPlot(id, data['ชื่อเจ้าของแปลง']||'', data['อำเภอ']||'', data['พื้นที่(ไร่)']||''); } catch(e) {}
  try {
    var folder = SRV_ensurePlotFolder(data);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    DB_updateById('PLOTS', 'รหัสแปลง', id, { 'ลิงก์โฟลเดอร์ภาพ': folder.getUrl() });
  } catch (e) {}
  return { ok: true, id: id };
}
function _applyPlotUpdate(data) {
  DB_updateById('PLOTS', 'รหัสแปลง', data['รหัสแปลง'], data);
  DB_audit('แก้ไข', 'PLOTS', data['รหัสแปลง'], data['ชื่อเจ้าของแปลง'] || '');
  return { ok: true, id: data['รหัสแปลง'] };
}
function api_deletePlot(id) {
  AUTH_requireDelete();
  var _plotInfo = DB_findBy('PLOTS', 'รหัสแปลง', id);
  DB_deleteById('PLOTS', 'รหัสแปลง', id);
  DB_audit('ลบ', 'PLOTS', id, '');
  try { LINE_plotDeleted(id, (_plotInfo && _plotInfo['ชื่อเจ้าของแปลง']) || '', __CURRENT_USER_ID); } catch(e) {}
  return { ok: true };
}

function api_getPublicPlot(plotId) {
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบแปลง' };
  return { ok: true, plot: {
    'รหัสแปลง': plot['รหัสแปลง'], 'ชื่อเจ้าของแปลง': plot['ชื่อเจ้าของแปลง'],
    'พันธุ์มันสำปะหลัง': plot['พันธุ์มันสำปะหลัง'], 'ประเภทพันธุ์': plot['ประเภทพันธุ์'],
    'พื้นที่(ไร่)': plot['พื้นที่(ไร่)'], 'ตำบล': plot['ตำบล'],
    'อำเภอ': plot['อำเภอ'], 'จังหวัด': plot['จังหวัด'],
    'วันที่ปลูก': plot['วันที่ปลูก'], 'สถานะแปลง': plot['สถานะแปลง'],
    'ละติจูด': plot['ละติจูด'], 'ลองจิจูด': plot['ลองจิจูด']
  }};
}

function api_plotDetail(plotId) {
  var u = AUTH_current();
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบแปลงรหัส ' + plotId };
  if (u.role === 'เกษตรกร') {
    var myIds = u.plotIds || [];
    if (myIds.length > 0 && myIds.indexOf(plotId) === -1) return { ok: false, error: 'ไม่มีสิทธิ์ดูแปลงนี้' };
  }
  var growth       = DB_readAll('GROWTH').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var disease      = DB_readAll('DISEASE').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var yield_       = DB_readAll('YIELD').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var cost         = DB_readAll('COST').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var assessments  = DB_readAll('ASSESSMENTS').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var propagations = DB_readAll('PROPAGATIONS').filter(function(r) { return r['รหัสแปลงต้นทาง'] === plotId; });
  var totalCost    = cost.reduce(function(s, c) { return s + (parseFloat(c['จำนวนเงิน(บาท)']) || 0); }, 0);
  var totalYield   = yield_.reduce(function(s, y) { return s + (parseFloat(y['ผลผลิตรวม(ตัน)']) || 0); }, 0);
  var totalIncome  = yield_.reduce(function(s, y) { return s + (parseFloat(y['รายได้รวม(บาท)']) || 0); }, 0);
  var totalStemOut = propagations.reduce(function(s, p) { return s + (parseFloat(p['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)']) || 0); }, 0);
  var assessMap = {};
  assessments.forEach(function(a) { assessMap[a['ครั้งที่ประเมิน']] = a; });
  return {
    ok: true, plot: plot,
    growth: growth, disease: disease, yield: yield_, cost: cost,
    assessments: assessments, assessMap: assessMap, propagations: propagations,
    summary: {
      totalCost: totalCost, totalYield: totalYield, totalIncome: totalIncome,
      profit: totalIncome - totalCost, diseaseCount: disease.length,
      totalStemOut: totalStemOut, propagationCount: propagations.length,
      plotUrl: SRV_webAppUrl() + '?id=' + encodeURIComponent(plotId)
    }
  };
}

/* บันทึกย่อย */
function api_addGrowth(d)  { return _addSub('GROWTH',  IDP.GROWTH,  d, 'การเจริญเติบโต'); }
function api_addDisease(d) { return _addSub('DISEASE', IDP.DISEASE, d, 'การเกิดโรค'); }
function api_addYield(d)   { return _addSub('YIELD',   IDP.YIELD,   d, 'ผลผลิต'); }
function api_addCost(d)    { return _addSub('COST',    IDP.COST,    d, 'ต้นทุน'); }

function _addSub(key, prefix, data, label) {
  var u = AUTH_current();
  var subKeys = ['GROWTH','DISEASE','YIELD','COST','ASSESSMENTS','PROPAGATIONS'];
  var isSub = subKeys.indexOf(key) !== -1;
  // เกษตรกรบันทึกข้อมูลแปลงตัวเองได้ทุกประเภท
  if (u.role === 'เกษตรกร' && isSub) {
    var plotId = data['รหัสแปลง'] || data['รหัสแปลงต้นทาง'] || '';
    var myIds = u.plotIds || [];
    var myPhone = AUTH_normalizePhone(u.phone || '');
    if (plotId && myIds.length > 0 && myIds.indexOf(plotId) === -1) throw new Error('สิทธิ์ไม่เพียงพอ: ไม่ใช่แปลงของท่าน');
    if (plotId && myIds.length === 0 && myPhone) {
      var pl = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
      if (pl && AUTH_normalizePhone(pl['เบอร์โทรศัพท์'] || '') !== myPhone) throw new Error('สิทธิ์ไม่เพียงพอ: ไม่ใช่แปลงของท่าน');
    }
    return _applySubAdd(key, prefix, data, label);
  }
  if (!AUTH_canEdit(u)) throw new Error('สิทธิ์ไม่เพียงพอ');
  return _applySubAdd(key, prefix, data, label);
}
function _applySubAdd(key, prefix, data, label) {
  var id = DB_nextId(prefix, key, 'รหัสบันทึก', { pad: 5 });
  data['รหัสบันทึก'] = id;
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert(key, data);
  DB_audit('เพิ่ม', key, data['รหัสแปลง'] || id, label);
  if (key === 'DISEASE') {
    try {
      var _dp = DB_findBy('PLOTS', 'รหัสแปลง', data['รหัสแปลง'] || '');
      LINE_diseaseAlert(
        data['รหัสแปลง'] || '', (_dp && _dp['ชื่อเจ้าของแปลง']) || '',
        data['ชนิดโรค'] || '', data['ระดับความรุนแรง'] || ''
      );
    } catch(e) {}
  }
  return { ok: true, id: id };
}
function api_deleteSub(key, id) {
  AUTH_requireDelete();
  if (!SHEETS[key]) throw new Error('ตารางไม่ถูกต้อง');
  DB_deleteById(key, 'รหัสบันทึก', id);
  DB_audit('ลบ', key, id, '');
  return { ok: true };
}
function api_updateSub(key, id, patch) {
  AUTH_requireEdit();
  if (!SHEETS[key]) throw new Error('ตารางไม่ถูกต้อง');
  DB_updateById(key, 'รหัสบันทึก', id, patch);
  DB_audit('แก้ไข', key, id, '');
  return { ok: true };
}

/* การประเมินแปลง */
function api_addAssessment(data) {
  var u = AUTH_current();
  if (!AUTH_canEdit(u) && u.role !== 'เกษตรกร') throw new Error('สิทธิ์ไม่เพียงพอ');
  // เกษตรกร: ตรวจสอบว่าเป็นแปลงตัวเอง
  if (u.role === 'เกษตรกร') {
    var plotId = data['รหัสแปลง'] || '';
    var myIds  = u.plotIds || [];
    if (plotId && myIds.length > 0 && myIds.indexOf(plotId) === -1) throw new Error('สิทธิ์ไม่เพียงพอ: ไม่ใช่แปลงของท่าน');
  }
  var id = DB_nextId(IDP.ASSESSMENT, 'ASSESSMENTS', 'รหัสการประเมิน', { pad: 5 });
  data['รหัสการประเมิน'] = id;
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert('ASSESSMENTS', data);
  DB_audit('เพิ่ม', 'ASSESSMENTS', data['รหัสแปลง'] || id, 'ประเมินแปลง');
  return { ok: true, id: id };
}
function api_deleteAssessment(id) {
  AUTH_requireDelete();
  DB_deleteById('ASSESSMENTS', 'รหัสการประเมิน', id);
  DB_audit('ลบ', 'ASSESSMENTS', id, '');
  return { ok: true };
}

/* ขยายผลท่อนพันธุ์ */
function api_addPropagation(data) {
  AUTH_requireEdit();
  var id = DB_nextId(IDP.PROPAGATION, 'PROPAGATIONS', 'รหัสการขยายผล', { pad: 5 });
  data['รหัสการขยายผล'] = id;
  data['วันที่บันทึก'] = DB_now();
  data['ผู้บันทึก'] = __CURRENT_USER_ID;
  DB_insert('PROPAGATIONS', data);
  DB_audit('เพิ่ม', 'PROPAGATIONS', data['รหัสแปลงต้นทาง'] || id, 'ขยายผลท่อนพันธุ์');
  return { ok: true, id: id };
}
function api_deletePropagation(id) {
  AUTH_requireDelete();
  DB_deleteById('PROPAGATIONS', 'รหัสการขยายผล', id);
  DB_audit('ลบ', 'PROPAGATIONS', id, '');
  return { ok: true };
}

/* อัปโหลดรูปภาพ */
function api_uploadPhoto(params) {
  AUTH_requireEdit();
  var plotId   = params.plotId  || '';
  var subKey   = params.subKey  || '';
  var subId    = params.subId   || '';
  var slotNo   = params.slotNo  || 1;
  var base64   = params.base64  || '';
  var mimeType = params.mimeType|| 'image/jpeg';
  var ext      = mimeType === 'image/png' ? '.png' : '.jpg';
  if (!base64) return { ok: false, error: 'ไม่มีข้อมูลรูปภาพ' };
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบแปลง ' + plotId };
  var folder = SRV_ensurePlotFolder(plot);
  var subFolder = SRV_subFolder(folder, subKey || 'ภาพทั่วไป');
  var rawData = Utilities.base64Decode(base64.replace(/^data:[^;]+;base64,/, ''));
  var blob = Utilities.newBlob(rawData, mimeType,
    plotId + '_' + (subKey||'') + '_' + (subId||'') + '_' + slotNo + ext);
  var file = subFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url = 'https://drive.google.com/uc?id=' + file.getId();
  if (subId && subKey) {
    var field = slotNo > 1 ? 'ลิงก์รูปที่' + slotNo : 'ลิงก์รูปภาพ';
    if (subKey === 'ASSESSMENTS') field = 'ลิงก์รูปที่' + slotNo;
    try {
      DB_updateById(subKey, 'รหัสบันทึก', subId, { [field]: url });
    } catch (ex) {
      try { DB_updateById(subKey, 'รหัสการประเมิน', subId, { [field]: url }); } catch (ex2) {}
    }
  }
  DB_audit('อัปโหลดรูป', subKey || 'PLOTS', plotId, 'slot' + slotNo);
  return { ok: true, url: url, fileId: file.getId() };
}

/* แดชบอร์ด */
function api_dashboard(params) {
  params = params || {};
  var u = AUTH_current();
  var allPlots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  var plots = params.year
    ? allPlots.filter(function(p) { return String(p['ปีงบประมาณ'] || '') === String(params.year); })
    : allPlots;
  var disease = DB_readAll('DISEASE');
  var yield_  = DB_readAll('YIELD');
  var cost    = DB_readAll('COST');
  var assess  = DB_readAll('ASSESSMENTS');
  var plotIds = {};
  plots.forEach(function(p) { plotIds[p['รหัสแปลง']] = true; });
  function inScope(r) { return plotIds[r['รหัสแปลง']]; }
  var totalArea = plots.reduce(function(s, p) { return s + (parseFloat(p['พื้นที่(ไร่)']) || 0); }, 0);
  var byDistrict = {}, byVariety = {}, byStatus = {}, diseaseByType = {};
  plots.forEach(function(p) {
    var d = p['อำเภอ'] || 'ไม่ระบุ'; byDistrict[d] = (byDistrict[d] || 0) + 1;
    var v = p['ประเภทพันธุ์'] || 'ไม่ระบุ'; byVariety[v] = (byVariety[v] || 0) + 1;
    var st = p['สถานะแปลง'] || 'ไม่ระบุ'; byStatus[st] = (byStatus[st] || 0) + 1;
  });
  var scopedDisease = disease.filter(inScope);
  scopedDisease.forEach(function(r) {
    var t = r['ชนิดโรค'] || 'อื่น ๆ';
    diseaseByType[t] = (diseaseByType[t] || 0) + 1;
  });
  var scopedYield = yield_.filter(inScope);
  var scopedCost  = cost.filter(inScope);
  var sumYield  = scopedYield.reduce(function(s, y) { return s + (parseFloat(y['ผลผลิตรวม(ตัน)']) || 0); }, 0);
  var sumIncome = scopedYield.reduce(function(s, y) { return s + (parseFloat(y['รายได้รวม(บาท)']) || 0); }, 0);
  var sumCost   = scopedCost.reduce(function(s, c) { return s + (parseFloat(c['จำนวนเงิน(บาท)']) || 0); }, 0);
  var infected  = {};
  scopedDisease.forEach(function(r) { infected[r['รหัสแปลง']] = true; });
  var scopedAssess = assess.filter(function(a) { return plotIds[a['รหัสแปลง']]; });
  var passCount = scopedAssess.filter(function(a) { return a['ผลการประเมิน'] === 'ผ่าน'; }).length;
  return {
    cards: {
      plots: plots.length, area: Math.round(totalArea * 100) / 100,
      infectedPlots: Object.keys(infected).length, diseaseRecords: scopedDisease.length,
      yield: Math.round(sumYield * 100) / 100, income: sumIncome,
      cost: sumCost, profit: sumIncome - sumCost,
      assessPass: passCount, assessTotal: scopedAssess.length
    },
    byDistrict: byDistrict, byVariety: byVariety, byStatus: byStatus, diseaseByType: diseaseByType,
    mapPoints: plots.filter(function(p) { return p['ละติจูด'] && p['ลองจิจูด']; })
      .map(function(p) {
        return {
          id: p['รหัสแปลง'], name: p['ชื่อเจ้าของแปลง'],
          lat: parseFloat(p['ละติจูด']), lng: parseFloat(p['ลองจิจูด']),
          district: p['อำเภอ'], variety: p['ประเภทพันธุ์'],
          status: p['สถานะแปลง'], infected: !!infected[p['รหัสแปลง']]
        };
      })
  };
}

/* ผู้ใช้งาน */
function api_listUsers() {
  AUTH_requireAdmin();
  return DB_readAll('USERS').map(function(u) { var s = Object.assign({}, u); delete s['PIN']; return s; });
}
function api_saveUser(data) {
  AUTH_requireAdmin();
  var existing = DB_findBy('USERS', 'อีเมล', data['อีเมล'] || '') ||
                 (data['เบอร์โทร'] ? _findUserByPhone(data['เบอร์โทร']) : null);
  if (existing) {
    var patch = Object.assign({}, data);
    if (!patch['PIN'] && existing['PIN']) delete patch['PIN'];
    DB_updateById('USERS', 'อีเมล', existing['อีเมล'] || data['อีเมล'], patch);
  } else {
    data['สถานะ'] = data['สถานะ'] || 'ใช้งาน';
    data['วันที่บันทึก'] = DB_now();
    DB_insert('USERS', data);
  }
  DB_audit('บันทึกผู้ใช้', 'USERS', data['อีเมล'] || data['เบอร์โทร'], data['บทบาท'] || '');
  return { ok: true };
}
function _findUserByPhone(phone) {
  var norm = AUTH_normalizePhone(phone);
  var users = DB_readAll('USERS');
  for (var i = 0; i < users.length; i++) {
    if (AUTH_normalizePhone(users[i]['เบอร์โทร']) === norm) return users[i];
  }
  return null;
}
function api_deleteUser(id) {
  AUTH_requireAdmin();
  var ok = DB_deleteById('USERS', 'อีเมล', id) || DB_deleteById('USERS', 'เบอร์โทร', id);
  DB_audit('ลบผู้ใช้', 'USERS', id, '');
  return { ok: ok };
}
function api_setPin(params) {
  var u = AUTH_current();
  var phone = u.phone || '';
  var pin   = String(params.pin || '').trim();
  if (!phone) return { ok: false, error: 'ไม่ได้เข้าสู่ระบบ' };
  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' };
  var me = _findUserByPhone(phone);
  if (!me) return { ok: false, error: 'ไม่พบผู้ใช้' };
  DB_updateById('USERS', 'อีเมล', me['อีเมล'] || phone, { 'PIN': pin });
  return { ok: true };
}

function api_registerStaff(params) {
  var name     = String(params.name     || '').trim();
  var phone    = AUTH_normalizePhone(params.phone || '');
  var role     = String(params.role     || 'อำเภอ');
  var district = String(params.district || '').trim();
  var pin      = String(params.pin      || '').trim();
  if (!name)  return { ok: false, error: 'กรุณากรอกชื่อ-สกุล' };
  if (!phone) return { ok: false, error: 'กรุณากรอกเบอร์โทรศัพท์' };
  if (pin && !/^\d{4,6}$/.test(pin)) return { ok: false, error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' };
  if (['จังหวัด','อำเภอ'].indexOf(role) === -1) role = 'อำเภอ';
  var existing = _findUserByPhone(phone);
  if (existing) {
    var ste = String(existing['สถานะ'] || '');
    if (ste === 'รออนุมัติ') return { ok: false, error: 'เบอร์นี้มีคำขอสมัครรออนุมัติอยู่แล้ว' };
    return { ok: false, error: 'เบอร์โทรนี้มีในระบบแล้ว หากลืม PIN กรุณาติดต่อ Admin' };
  }
  DB_insert('USERS', {
    'อีเมล': phone, 'ชื่อ-สกุล': name, 'บทบาท': role,
    'อำเภอที่รับผิดชอบ': district, 'สถานะ': 'ใช้งาน',
    'เบอร์โทร': phone, 'PIN': pin, 'วันที่บันทึก': DB_now()
  });
  DB_cacheClear('USERS');
  DB_audit('ลงทะเบียน', 'USERS', phone, name + ' / ' + role);
  try { LINE_newStaff(name, phone, role, district); } catch(e) {}
  var payload = { id: phone, name: name, role: role, district: district, phone: phone, type: 'staff' };
  var token = AUTH_createToken(payload);
  return { ok: true, token: token, user: payload, message: 'ลงทะเบียนสำเร็จ! ยินดีต้อนรับ', webAppUrl: SRV_webAppUrl() };
}

function api_approveUser(params) {
  AUTH_requireAdmin();
  var userId = params.userId || '';
  if (!userId) return { ok: false, error: 'ไม่พบรหัสผู้ใช้' };
  var user = DB_findBy('USERS', 'อีเมล', userId) || _findUserByPhone(userId);
  if (!user) return { ok: false, error: 'ไม่พบผู้ใช้' };
  DB_updateById('USERS', 'อีเมล', user['อีเมล'] || userId, { 'สถานะ': 'ใช้งาน' });
  DB_cacheClear('USERS');
  DB_audit('อนุมัติเจ้าหน้าที่', 'USERS', userId, user['ชื่อ-สกุล'] || '');
  try { LINE_userApproved(user['ชื่อ-สกุล'] || '', user['เบอร์โทร'] || userId, user['บทบาท'] || ''); } catch(e) {}
  return { ok: true };
}

function api_getPendingUsers() {
  AUTH_requireAdmin();
  return {
    ok: true,
    data: DB_readAll('USERS')
      .filter(function(u) { return String(u['สถานะ'] || '') === 'รออนุมัติ'; })
      .map(function(u) {
        return {
          userId:      u['อีเมล']             || u['เบอร์โทร'] || '',
          name:        u['ชื่อ-สกุล']         || '',
          phone:       u['เบอร์โทร']          || '',
          role:        u['บทบาท']             || '',
          district:    u['อำเภอที่รับผิดชอบ'] || '',
          requestDate: String(u['วันที่บันทึก'] || '').slice(0, 10)
        };
      })
  };
}

/* พื้นที่ */
function api_listAreas() { return DB_readAll('AREAS'); }
function api_addArea(p, d, t) {
  AUTH_requireEdit();
  DB_insert('AREAS', { 'จังหวัด': p, 'อำเภอ': d, 'ตำบล': t });
  return { ok: true };
}

/* audit */
function api_auditLog(limit) {
  AUTH_requireAdmin();
  var rows = DB_readAll('AUDIT');
  rows.sort(function(a, b) { return String(b['เวลา']).localeCompare(String(a['เวลา'])); });
  return rows.slice(0, limit || 200);
}
function api_listTable(key) {
  AUTH_requireAdmin();
  if (!SHEETS[key]) throw new Error('ตารางไม่ถูกต้อง');
  return { name: SHEETS[key].name, headers: SHEETS[key].headers, rows: DB_readAll(key) };
}

/* ระบบอนุมัติ */
var APPR_PREFIX = { GROWTH: IDP.GROWTH, DISEASE: IDP.DISEASE, YIELD: IDP.YIELD, COST: IDP.COST, ASSESSMENTS: IDP.ASSESSMENT };

function APPR_create(type, tableKey, refId, data, brief, u) {
  u = u || AUTH_current();
  var id = DB_nextId(IDP.APPROVAL, 'APPROVALS', 'รหัสคำขอ', { pad: 5 });
  DB_insert('APPROVALS', {
    'รหัสคำขอ': id, 'ประเภท': type,
    'ตาราง': tableKey, 'ชื่อตาราง': (SHEETS[tableKey] && SHEETS[tableKey].name) || tableKey,
    'รหัสอ้างอิง': refId || '', 'รายละเอียดย่อ': brief,
    'ข้อมูล(JSON)': JSON.stringify(data),
    'ผู้ขอ': u.id || u.phone || '', 'บทบาทผู้ขอ': u.role || '',
    'วันที่ขอ': DB_now(), 'สถานะ': 'รออนุมัติ', 'เหตุผล': ''
  });
  DB_audit('ส่งคำขออนุมัติ', tableKey, refId || id, brief);
  try { LINE_approvalRequest(tableKey, brief, u.name || u.id || ''); } catch(e) {}
  return { ok: true, pending: true, approvalId: id, message: 'ส่งคำขออนุมัติเรียบร้อยแล้ว รอการพิจารณา' };
}
function api_listApprovals(status) {
  AUTH_requireApprove();
  var rows = DB_readAll('APPROVALS');
  if (status) rows = rows.filter(function(r) { return r['สถานะ'] === status; });
  rows.sort(function(a, b) { return String(b['วันที่ขอ']).localeCompare(String(a['วันที่ขอ'])); });
  return rows;
}
function api_pendingCount() {
  var u = AUTH_current();
  if (!AUTH_canApprove(u)) return { count: 0 };
  var count = DB_readAll('APPROVALS').filter(function(r) { return r['สถานะ'] === 'รออนุมัติ'; }).length;
  return { count: count };
}
function api_approveChange(id) {
  AUTH_requireApprove();
  var req = DB_findBy('APPROVALS', 'รหัสคำขอ', id);
  if (!req) throw new Error('ไม่พบคำขอ: ' + id);
  if (req['สถานะ'] !== 'รออนุมัติ') throw new Error('คำขอนี้ได้รับการพิจารณาแล้ว');
  var data = JSON.parse(req['ข้อมูล(JSON)'] || '{}');
  var tableKey = req['ตาราง']; var type = req['ประเภท'];
  if (type === 'แก้ไข' && tableKey === 'PLOTS') {
    _applyPlotUpdate(data);
  } else if (type === 'เพิ่ม' && APPR_PREFIX[tableKey]) {
    _applySubAdd(tableKey, APPR_PREFIX[tableKey], data, SHEETS[tableKey] ? SHEETS[tableKey].name : tableKey);
  } else if (type === 'แก้ไข' && SHEETS[tableKey]) {
    DB_updateById(tableKey, 'รหัสบันทึก', req['รหัสอ้างอิง'], data);
    DB_audit('แก้ไข (อนุมัติ)', tableKey, req['รหัสอ้างอิง'], '');
  } else {
    throw new Error('ไม่รองรับประเภทคำขอ: ' + type + '/' + tableKey);
  }
  DB_updateById('APPROVALS', 'รหัสคำขอ', id, {
    'สถานะ': 'อนุมัติแล้ว', 'ผู้พิจารณา': __CURRENT_USER_ID, 'วันที่พิจารณา': DB_now()
  });
  DB_audit('อนุมัติ', 'APPROVALS', id, req['รายละเอียดย่อ'] || '');
  try { LINE_approvalDone(true, req['รายละเอียดย่อ'] || '', __CURRENT_USER_ID); } catch(e) {}
  return { ok: true };
}
function api_rejectChange(id, reason) {
  AUTH_requireApprove();
  var req = DB_findBy('APPROVALS', 'รหัสคำขอ', id);
  if (!req) throw new Error('ไม่พบคำขอ: ' + id);
  DB_updateById('APPROVALS', 'รหัสคำขอ', id, {
    'สถานะ': 'ไม่อนุมัติ', 'ผู้พิจารณา': __CURRENT_USER_ID,
    'วันที่พิจารณา': DB_now(), 'เหตุผล': reason || ''
  });
  DB_audit('ไม่อนุมัติ', 'APPROVALS', id, reason || '');
  try { LINE_approvalDone(false, req['รายละเอียดย่อ'] || reason || '', __CURRENT_USER_ID); } catch(e) {}
  return { ok: true };
}


/* ===================== 06_AI ===================== */

function api_aiAnalyzePlot(plotId) {
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบแปลง' };
  var growth  = DB_readAll('GROWTH').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var disease = DB_readAll('DISEASE').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var yield_  = DB_readAll('YIELD').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var analysis = []; var status = 'ปกติ';
  if (growth.length >= 2) {
    growth.sort(function(a, b) { return String(a['วันที่ติดตาม']).localeCompare(String(b['วันที่ติดตาม'])); });
    var last = growth[growth.length - 1]; var prev = growth[growth.length - 2];
    var daysDiff = 1, heightDiff = 0;
    try {
      var d1 = new Date(String(prev['วันที่ติดตาม']).replace('T', ' '));
      var d2 = new Date(String(last['วันที่ติดตาม']).replace('T', ' '));
      daysDiff = Math.max(1, (d2 - d1) / 86400000);
      heightDiff = parseFloat(last['ความสูงเฉลี่ย(ซม.)']) - parseFloat(prev['ความสูงเฉลี่ย(ซม.)']);
    } catch (e) {}
    var slope = heightDiff / daysDiff;
    if (slope < 0.5 && slope >= 0) analysis.push('⚠️ อัตราการเจริญเติบโตช้า (' + slope.toFixed(2) + ' ซม./วัน) — ควรตรวจสอบปุ๋ยและน้ำ');
    if (slope < 0) { analysis.push('🚨 ความสูงลดลง อาจเป็นสัญญาณโรคหรือความเครียด'); status = 'เฝ้าระวัง'; }
  }
  var cmdFound = disease.some(function(d) {
    return String(d['ชนิดโรค']).includes('CMD') || String(d['ชนิดโรค']).includes('SLCMV') || String(d['ชนิดโรค']).includes('ใบด่าง');
  });
  if (cmdFound) { analysis.push('🚨 พบโรคใบด่างมันสำปะหลัง (CMD/SLCMV) — ถอนทำลาย ห้ามใช้ท่อนพันธุ์จากแปลงนี้'); status = 'วิกฤต'; }
  if (yield_.length > 0) {
    yield_.forEach(function(y) {
      var ypa = parseFloat(y['ผลผลิตต่อไร่(ตัน/ไร่)']);
      if (!isNaN(ypa) && ypa < 3.5) analysis.push('⚠️ ผลผลิตต่ำกว่าเกณฑ์ (' + ypa + ' ตัน/ไร่) — เกณฑ์แนะนำ ≥ 3.5 ตัน/ไร่');
    });
  }
  if (analysis.length === 0) analysis.push('✅ ไม่พบความผิดปกติ — แปลงอยู่ในสภาพปกติ');
  return { ok: true, status: status, analysis: analysis, growthCount: growth.length, diseaseCount: disease.length };
}

function api_aiGemini(prompt) {
  var key = CFG_geminiKey();
  if (!key) return { ok: false, error: 'ไม่ได้ตั้งค่า GEMINI_API_KEY' };
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key;
    var payload = { contents: [{ parts: [{ text: prompt }] }] };
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var json = JSON.parse(resp.getContentText());
    var text = json.candidates && json.candidates[0] && json.candidates[0].content
      ? json.candidates[0].content.parts[0].text : '';
    return { ok: true, text: text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ── Gemini: วิเคราะห์แปลงแบบครบวงจร ── */
function api_aiFullAnalysis(params) {
  params = params || {};
  var plotId = params.plotId || '';
  if (!plotId) return { ok: false, error: 'ระบุ plotId' };
  var key = CFG_geminiKey();
  if (!key) {
    // fallback: rule-based only
    return api_aiAnalyzePlot(plotId);
  }
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบแปลง' };
  var growth      = DB_readAll('GROWTH').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var disease     = DB_readAll('DISEASE').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var yield_      = DB_readAll('YIELD').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var cost        = DB_readAll('COST').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var assessments = DB_readAll('ASSESSMENTS').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  // เรียงล่าสุดขึ้นบน
  growth.sort(function(a,b) { return String(b['วันที่ติดตาม']||b['วันที่บันทึก']||'').localeCompare(String(a['วันที่ติดตาม']||a['วันที่บันทึก']||'')); });
  disease.sort(function(a,b) { return String(b['วันที่สำรวจ']||b['วันที่บันทึก']||'').localeCompare(String(a['วันที่สำรวจ']||a['วันที่บันทึก']||'')); });
  var totalCost   = cost.reduce(function(s,c) { return s+(parseFloat(c['จำนวนเงิน(บาท)'])||0); }, 0);
  var totalIncome = yield_.reduce(function(s,y) { return s+(parseFloat(y['รายได้รวม(บาท)'])||0); }, 0);
  var totalYield  = yield_.reduce(function(s,y) { return s+(parseFloat(y['ผลผลิตรวม(ตัน)'])||0); }, 0);
  var latestAssess = assessments.sort(function(a,b) {
    return String(b['วันที่ประเมิน']||'').localeCompare(String(a['วันที่ประเมิน']||''));
  })[0] || {};
  // soil data จาก params (frontend ส่งมา)
  var soilInfo = '';
  if (params.soilSeries) soilInfo += 'ชุดดิน: ' + params.soilSeries + '\n';
  if (params.soilSuit)   soilInfo += 'ความเหมาะสมมันสำปะหลัง: ' + params.soilSuit + '\n';
  if (params.soilPh)     soilInfo += 'ค่า pH ดิน: ' + params.soilPh + '\n';
  var growthSummary = growth.slice(0,5).map(function(r) {
    return 'วันที่ '+String(r['วันที่ติดตาม']||r['วันที่บันทึก']||'').slice(0,10)+
      ' อายุ '+(r['อายุพืช(วัน)']||'—')+' วัน สูง '+(r['ความสูงเฉลี่ย(ซม.)']||'—')+' ซม.'+
      ' ความสมบูรณ์ '+(r['ความสมบูรณ์(1-5)']||'—')+'/5';
  }).join('\n');
  var diseaseSummary = disease.slice(0,5).map(function(r) {
    return 'วันที่ '+String(r['วันที่สำรวจ']||'').slice(0,10)+' โรค: '+(r['ชนิดโรค']||'—')+
      ' ระดับ '+(r['ระดับความรุนแรง']||'—')+' ระบาด '+(r['เปอร์เซ็นต์การระบาด']||'0')+'%';
  }).join('\n');
  var prompt =
    'คุณเป็นผู้เชี่ยวชาญด้านการเกษตรมันสำปะหลัง ช่วยวิเคราะห์ข้อมูลแปลงมันสำปะหลังต่อไปนี้เป็นภาษาไทย\n\n' +
    '## ข้อมูลแปลง\n' +
    'รหัสแปลง: ' + plotId + '\n' +
    'เกษตรกร: ' + (plot['ชื่อเจ้าของแปลง']||'—') + '\n' +
    'พันธุ์: ' + (plot['พันธุ์มันสำปะหลัง']||'—') + ' (' + (plot['ประเภทพันธุ์']||'—') + ')\n' +
    'พื้นที่: ' + (plot['พื้นที่(ไร่)']||'—') + ' ไร่\n' +
    'วันที่ปลูก: ' + String(plot['วันที่ปลูก']||'—').slice(0,10) + '\n' +
    'อำเภอ: ' + (plot['อำเภอ']||'—') + '\n\n' +
    (soilInfo ? '## ข้อมูลดิน (Agri-Map)\n' + soilInfo + '\n' : '') +
    (growthSummary ? '## ประวัติการเจริญเติบโต (ล่าสุด 5 ครั้ง)\n' + growthSummary + '\n\n' : '') +
    (diseaseSummary ? '## ประวัติโรค (ล่าสุด 5 ครั้ง)\n' + diseaseSummary + '\n\n' : '') +
    (yield_.length ? '## ผลผลิต\nรวม: '+totalYield.toFixed(2)+' ตัน  รายได้: '+Math.round(totalIncome).toLocaleString()+' บาท\n\n' : '') +
    (totalCost ? '## ต้นทุนรวม\n'+Math.round(totalCost).toLocaleString()+' บาท  กำไร/ขาดทุน: '+Math.round(totalIncome-totalCost).toLocaleString()+' บาท\n\n' : '') +
    (latestAssess['ผลการประเมิน'] ? '## ผลการประเมินล่าสุด\n'+latestAssess['ผลการประเมิน']+' ('+String(latestAssess['วันที่ประเมิน']||'').slice(0,10)+')\n\n' : '') +
    '## คำถาม\nโปรดวิเคราะห์และให้คำแนะนำใน 4 หัวข้อนี้:\n' +
    '1. **สถานะแปลงและแนวโน้ม** — ประเมินสุขภาพแปลงจากข้อมูลที่มี\n' +
    '2. **ความเสี่ยงและข้อควรระวัง** — ประเด็นที่ต้องติดตาม\n' +
    '3. **คำแนะนำการจัดการ** — สิ่งที่ควรทำในช่วงนี้\n' +
    '4. **ข้อมูลดินและพันธุ์** — ความเหมาะสมและการปรับปรุง\n' +
    'ตอบกระชับ หัวข้อละ 2-3 ประโยค';
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key;
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      muteHttpExceptions: true
    });
    var json = JSON.parse(resp.getContentText());
    var text = json.candidates && json.candidates[0] && json.candidates[0].content
      ? json.candidates[0].content.parts[0].text : '';
    if (!text) throw new Error('Gemini ไม่ตอบสนอง');
    return { ok: true, text: text, source: 'gemini' };
  } catch (e) {
    // fallback rule-based
    var rb = api_aiAnalyzePlot(plotId);
    rb.fallback = true;
    return rb;
  }
}

/* ── Gemini: สร้างรายงานสรุปผลการดำเนินงาน ── */
function api_aiGenerateReport(params) {
  params = params || {};
  var key = CFG_geminiKey();
  if (!key) return { ok: false, error: 'ไม่ได้ตั้งค่า GEMINI_API_KEY' };
  var year     = params.year     ? String(params.year)     : '';
  var district = params.district ? String(params.district) : '';
  // ดึงข้อมูลสรุป
  var u = AUTH_current();
  var allPlots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  if (year)     allPlots = allPlots.filter(function(p) { return String(p['ปีงบประมาณ']||'') === year; });
  if (district) allPlots = allPlots.filter(function(p) { return p['อำเภอ'] === district; });
  var plotIds = {};
  allPlots.forEach(function(p) { plotIds[p['รหัสแปลง']] = true; });
  var yields   = DB_readAll('YIELD').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var disease  = DB_readAll('DISEASE').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var assess   = DB_readAll('ASSESSMENTS').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var propag   = DB_readAll('PROPAGATIONS').filter(function(r) { return plotIds[r['รหัสแปลงต้นทาง']]; });
  var totalArea    = allPlots.reduce(function(s,p) { return s+(parseFloat(p['พื้นที่(ไร่)'])||0); }, 0);
  var totalYield   = yields.reduce(function(s,y) { return s+(parseFloat(y['ผลผลิตรวม(ตัน)'])||0); }, 0);
  var totalIncome  = yields.reduce(function(s,y) { return s+(parseFloat(y['รายได้รวม(บาท)'])||0); }, 0);
  var totalStemOut = propag.reduce(function(s,p) { return s+(parseFloat(p['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)'])||0); }, 0);
  var infectSet    = {};
  disease.forEach(function(d) { infectSet[d['รหัสแปลง']] = true; });
  var passCount = assess.filter(function(a) { return a['ผลการประเมิน'] === 'ผ่าน'; }).length;
  var byDistrict = {};
  allPlots.forEach(function(p) { var d=p['อำเภอ']||'—'; byDistrict[d]=(byDistrict[d]||0)+1; });
  var distSummary = Object.keys(byDistrict).map(function(d) { return d+': '+byDistrict[d]+' แปลง'; }).join(', ');
  var prompt =
    'คุณเป็นนักวิชาการส่งเสริมการเกษตร ช่วยสร้างรายงานสรุปผลการดำเนินงาน\n' +
    'โครงการส่งเสริมมันสำปะหลังพันธุ์ต้านทานโรค จังหวัดกำแพงเพชร\n' +
    (year ? 'ปีงบประมาณ: ' + year + '\n' : '') +
    (district ? 'อำเภอ: ' + district + '\n' : '') + '\n' +
    '## ข้อมูลสรุป\n' +
    'จำนวนแปลง: ' + allPlots.length + ' แปลง\n' +
    'พื้นที่รวม: ' + totalArea.toFixed(2) + ' ไร่\n' +
    'กระจายตามอำเภอ: ' + distSummary + '\n' +
    'ผลผลิตรวม: ' + totalYield.toFixed(2) + ' ตัน\n' +
    'รายได้รวม: ' + Math.round(totalIncome).toLocaleString() + ' บาท\n' +
    'แปลงพบโรค: ' + Object.keys(infectSet).length + ' แปลง\n' +
    'ท่อนพันธุ์แจกจ่าย: ' + Math.round(totalStemOut).toLocaleString() + ' ลำ\n' +
    'ผลประเมินท่อนพันธุ์ผ่าน: ' + passCount + '/' + assess.length + ' การประเมิน\n\n' +
    'โปรดสร้างรายงานสรุปเป็นภาษาราชการไทย ประกอบด้วย:\n' +
    '1. บทสรุปผู้บริหาร (3-5 ประโยค)\n' +
    '2. ผลการดำเนินงาน (แสดงตัวเลขสำคัญ)\n' +
    '3. ปัญหาและอุปสรรค\n' +
    '4. ข้อเสนอแนะ\n' +
    'ความยาวรวมไม่เกิน 500 คำ';
  try {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key;
    var resp = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      muteHttpExceptions: true
    });
    var json = JSON.parse(resp.getContentText());
    var text = json.candidates && json.candidates[0] && json.candidates[0].content
      ? json.candidates[0].content.parts[0].text : '';
    return { ok: true, text: text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}


/* ===================== 07_V3_Bridge — Frontend API Adapters ===================== */
/* แปลง data จาก Thai header ↔ camelCase เพื่อให้ frontend v3 ทำงานได้ */

function _mapStatus(s) {
  var m = {
    'กำลังปลูก':'normal','เจริญเติบโต':'normal','เก็บเกี่ยวแล้ว':'normal',
    'ยกเลิก':'damage','เฝ้าระวัง':'watch','เสียหาย':'damage',
    'normal':'normal','watch':'watch','damage':'damage'
  };
  return m[String(s||'')] || 'normal';
}

function _mapPlot(p) {
  if (!p) return null;
  return {
    plotId:        p['รหัสแปลง']                                    || '',
    plotCode:      p['รหัสแปลง']                                    || '',
    projectCode:   p['ชื่อโครงการ']                                  || '',
    projectId:     p['ชื่อโครงการ']                                  || '',
    activity:      p['ชื่อกิจกรรม']                                  || '',
    farmerName:    p['ชื่อเจ้าของแปลง']                             || '',
    address:       p['ที่อยู่']                                      || '',
    phone:         p['เบอร์โทรศัพท์']                                || '',
    district:      p['อำเภอ']                                       || '',
    subdistrict:   p['ตำบล']                                        || '',
    village:       p['บ้านเลขที่/หมู่']                              || '',
    variety:       p['พันธุ์มันสำปะหลัง']                           || '',
    varietyType:   p['ประเภทพันธุ์']                                 || '',
    stemSupport:   p['จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)']     || '',
    areaRai:       p['พื้นที่(ไร่)']                                 || '',
    plantDate:     String(p['วันที่ปลูก']||'').slice(0,10),
    harvestDate:   String(p['คาดว่าเก็บเกี่ยววันที่']||'').slice(0,10),
    status:        _mapStatus(p['สถานะแปลง']),
    lat:           p['ละติจูด']                                     || '',
    lng:           p['ลองจิจูด']                                    || '',
    note:          p['หมายเหตุ']                                    || '',
    year:          p['ปีงบประมาณ']                                  || '',
    folderUrl:     p['ลิงก์โฟลเดอร์ภาพ']                           || '',
    coverPhoto:    p['ภาพปกแปลง']                                 || ''
  };
}

function _unMapPlot(d) {
  var statusRev = { normal:'กำลังปลูก', watch:'เฝ้าระวัง', damage:'เสียหาย' };
  return {
    'รหัสแปลง':                                   d.plotId      || '',
    'ปีงบประมาณ':                                 d.year        || new Date().getFullYear(),
    'ชื่อโครงการ':                                 d.projectId   || d.projectCode || '',
    'ชื่อกิจกรรม':                                 d.activity    || '',
    'ชื่อเจ้าของแปลง':                             d.farmerName  || '',
    'ที่อยู่':                                     d.address     || '',
    'เบอร์โทรศัพท์':                               d.phone       || '',
    'พันธุ์มันสำปะหลัง':                           d.variety     || '',
    'ประเภทพันธุ์':                                d.varietyType || '',
    'จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)':    d.stemSupport || '',
    'พื้นที่(ไร่)':                                d.areaRai     || '',
    'ละติจูด':                                    d.lat         || '',
    'ลองจิจูด':                                   d.lng         || '',
    'ตำบล':                                       d.subdistrict || '',
    'อำเภอ':                                      d.districtId  || d.district || '',
    'บ้านเลขที่/หมู่':                             d.village     || '',
    'วันที่ปลูก':                                 d.plantDate   || '',
    'สถานะแปลง':                                 statusRev[d.status] || d.status || 'กำลังปลูก',
    'ภาพปกแปลง':                                 d.coverPhoto  || '',
    'หมายเหตุ':                                   d.note        || ''
  };
}

/* ── Auth ── */
function api_verifyToken_v3() {
  var u = AUTH_current();
  if (!u || u.role === 'public') return { ok: false, error: 'token ไม่ถูกต้อง' };
  return { ok: true, user: { id: u.id, name: u.name, role: u.role, district: u.district, phone: u.phone, type: u.type }, webAppUrl: SRV_webAppUrl() };
}

/* ── Dashboard ── */
function api_getDashboard_v3(params) {
  params = params || {};
  var u = AUTH_current();
  var allPlots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  var year     = params.year     ? String(params.year)     : '';
  var district = params.district ? String(params.district) : '';
  var plots = year ? allPlots.filter(function(p) { return String(p['ปีงบประมาณ']||'') === year; }) : allPlots;
  if (district) plots = plots.filter(function(p) { return p['อำเภอ'] === district; });
  var projects = DB_readAll('PROJECTS');
  var pendingCount = 0;
  if (AUTH_canApprove(u)) {
    pendingCount = DB_readAll('APPROVALS').filter(function(r) { return r['สถานะ'] === 'รออนุมัติ'; }).length;
  }
  var farmerSet = {}, totalArea = 0, byDistrict = {}, varietyMap = {};
  var statusN = 0, statusW = 0, statusD = 0;
  var totalStemIn = 0;
  var plotIds = {};
  plots.forEach(function(p) {
    var ph = p['เบอร์โทรศัพท์']; if (ph) farmerSet[ph] = true;
    var area = parseFloat(p['พื้นที่(ไร่)'])||0;
    totalArea += area;
    totalStemIn += parseFloat(p['จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)'])||0;
    var dist = p['อำเภอ']||'ไม่ระบุ'; byDistrict[dist] = (byDistrict[dist]||0) + 1;
    var v = p['พันธุ์มันสำปะหลัง']||'ไม่ระบุ';
    if (!varietyMap[v]) varietyMap[v] = {area:0,count:0};
    varietyMap[v].area += area; varietyMap[v].count++;
    var s = _mapStatus(p['สถานะแปลง']);
    if (s === 'watch') statusW++; else if (s === 'damage') statusD++; else statusN++;
    plotIds[p['รหัสแปลง']] = true;
  });
  var totalStemOut = 0;
  try {
    DB_readAll('PROPAGATIONS').forEach(function(p) {
      if (plotIds[p['รหัสแปลงต้นทาง']]) totalStemOut += parseFloat(p['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)'])||0;
    });
  } catch(e) {}
  var yields  = DB_readAll('YIELD');
  var costs   = DB_readAll('COST');
  var disease = DB_readAll('DISEASE');
  var assess  = DB_readAll('ASSESSMENTS');
  var monthMap = {}, totalYield = 0, totalIncome = 0, totalCost = 0;
  yields.forEach(function(y) {
    if (!plotIds[y['รหัสแปลง']]) return;
    totalYield  += parseFloat(y['ผลผลิตรวม(ตัน)'])||0;
    totalIncome += parseFloat(y['รายได้รวม(บาท)'])||0;
    var d = String(y['วันที่เก็บเกี่ยว']||y['วันที่บันทึก']||'').slice(0,7);
    if (d) monthMap[d] = (monthMap[d]||0) + (parseFloat(y['ผลผลิตรวม(ตัน)'])||0);
  });
  costs.forEach(function(c) {
    if (plotIds[c['รหัสแปลง']]) totalCost += parseFloat(c['จำนวนเงิน(บาท)'])||0;
  });
  var infectedSet = {};
  disease.forEach(function(d) { if (plotIds[d['รหัสแปลง']]) infectedSet[d['รหัสแปลง']] = true; });
  var scopedAssess = assess.filter(function(a) { return plotIds[a['รหัสแปลง']]; });
  var assessPass = scopedAssess.filter(function(a) { return a['ผลการประเมิน'] === 'ผ่าน'; }).length;
  var months = Object.keys(monthMap).sort().slice(-8);
  // All district names in scope for filter dropdown
  var allDistrictSet = {};
  allPlots.forEach(function(p) { var d = p['อำเภอ']; if (d) allDistrictSet[d] = true; });
  var audit = [];
  try { audit = DB_readAll('AUDIT'); } catch(e) {}
  audit.sort(function(a,b) { return String(b['เวลา']).localeCompare(String(a['เวลา'])); });
  var recent = audit.slice(0,8).map(function(r) {
    return { icon:'📝', title:(r['การกระทำ']||'')+(r['รายละเอียด']?' — '+r['รายละเอียด']:''), sub:r['ผู้ใช้']||'', time:String(r['เวลา']||'').slice(0,16) };
  });
  return {
    ok: true,
    data: {
      plotCount:    plots.length,
      farmerCount:  Object.keys(farmerSet).length,
      projectCount: projects.length,
      pendingCount: pendingCount,
      totalArea:    Math.round(totalArea*100)/100,
      totalYield:   Math.round(totalYield*100)/100,
      totalIncome:  Math.round(totalIncome),
      totalCost:    Math.round(totalCost),
      profit:       Math.round(totalIncome - totalCost),
      infectedCount:Object.keys(infectedSet).length,
      assessPass:   assessPass,
      assessTotal:  scopedAssess.length,
      yieldMonths:  { labels: months, data: months.map(function(m) { return Math.round((monthMap[m]||0)*100)/100; }) },
      statusCounts:  [statusN, statusW, statusD],
      byDistrict:    byDistrict,
      byVariety:     varietyMap,
      totalStemIn:   Math.round(totalStemIn),
      totalStemOut:  Math.round(totalStemOut),
      districtList:  Object.keys(allDistrictSet).sort(),
      recent:        recent
    }
  };
}

/* ── Report Data ── */
function api_getReportData(params) {
  params = params || {};
  var u = AUTH_current();
  var allPlots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  if (params.year)     allPlots = allPlots.filter(function(p) { return String(p['ปีงบประมาณ']||'') === String(params.year); });
  if (params.district) allPlots = allPlots.filter(function(p) { return p['อำเภอ'] === params.district; });
  if (params.project)  allPlots = allPlots.filter(function(p) { return p['ชื่อโครงการ'] === params.project; });
  if (params.status)   allPlots = allPlots.filter(function(p) { return p['สถานะแปลง'] === params.status; });
  if (params.plotId)   allPlots = allPlots.filter(function(p) { return p['รหัสแปลง'] === params.plotId; });
  var plotIds = {};
  allPlots.forEach(function(p) { plotIds[p['รหัสแปลง']] = true; });
  var yields   = DB_readAll('YIELD').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var costs    = DB_readAll('COST').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var disease  = DB_readAll('DISEASE').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var assess   = DB_readAll('ASSESSMENTS').filter(function(r) { return plotIds[r['รหัสแปลง']]; });
  var propag   = DB_readAll('PROPAGATIONS').filter(function(r) { return plotIds[r['รหัสแปลงต้นทาง']]; });
  var yieldMap = {}, costMap = {}, diseaseMap = {}, assessMap = {}, propMap = {};
  yields.forEach(function(y) {
    var pid = y['รหัสแปลง'];
    if (!yieldMap[pid]) yieldMap[pid] = {total:0,income:0,perRai:0,count:0};
    yieldMap[pid].total   += parseFloat(y['ผลผลิตรวม(ตัน)'])||0;
    yieldMap[pid].income  += parseFloat(y['รายได้รวม(บาท)'])||0;
    yieldMap[pid].perRai  += parseFloat(y['ผลผลิตต่อไร่(ตัน/ไร่)'])||0;
    yieldMap[pid].count++;
  });
  costs.forEach(function(c) { var pid=c['รหัสแปลง']; costMap[pid]=(costMap[pid]||0)+(parseFloat(c['จำนวนเงิน(บาท)'])||0); });
  disease.forEach(function(d) {
    var pid=d['รหัสแปลง'];
    if (!diseaseMap[pid]) diseaseMap[pid]={count:0,hasCMD:false};
    diseaseMap[pid].count++;
    if (/CMD|SLCMV|ใบด่าง/.test(String(d['ชนิดโรค']||''))) diseaseMap[pid].hasCMD=true;
  });
  assess.forEach(function(a) {
    var pid=a['รหัสแปลง'], d=String(a['วันที่ประเมิน']||'');
    if (!assessMap[pid]||d>assessMap[pid].date) assessMap[pid]={result:a['ผลการประเมิน'],date:d};
  });
  propag.forEach(function(p) { var pid=p['รหัสแปลงต้นทาง']; propMap[pid]=(propMap[pid]||0)+(parseFloat(p['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)'])||0); });
  var rows = allPlots.map(function(p) {
    var pid=p['รหัสแปลง']; var yd=yieldMap[pid]||{total:0,income:0,perRai:0,count:0};
    var tc=costMap[pid]||0; var ti=yd.income; var dm=diseaseMap[pid]||{count:0,hasCMD:false}; var am=assessMap[pid]||{};
    return {
      plotId:p['รหัสแปลง']||'', farmerName:p['ชื่อเจ้าของแปลง']||'', phone:p['เบอร์โทรศัพท์']||'',
      district:p['อำเภอ']||'', subdistrict:p['ตำบล']||'', project:p['ชื่อโครงการ']||'', year:p['ปีงบประมาณ']||'',
      variety:p['พันธุ์มันสำปะหลัง']||'', areaRai:parseFloat(p['พื้นที่(ไร่)'])||0,
      plantDate:String(p['วันที่ปลูก']||'').slice(0,10), status:p['สถานะแปลง']||'',
      stemIn:parseFloat(p['จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)'])||0, stemOut:propMap[pid]||0,
      yieldTotal:Math.round(yd.total*100)/100, yieldPerRai:yd.count?Math.round((yd.perRai/yd.count)*100)/100:0,
      income:Math.round(ti), cost:Math.round(tc), profit:Math.round(ti-tc),
      diseaseCount:dm.count, hasCMD:dm.hasCMD, assessResult:am.result||''
    };
  });
  var sum = {
    plotCount:    rows.length,
    totalArea:    Math.round(rows.reduce(function(s,r){return s+r.areaRai;},0)*100)/100,
    totalYield:   Math.round(rows.reduce(function(s,r){return s+r.yieldTotal;},0)*100)/100,
    totalIncome:  Math.round(rows.reduce(function(s,r){return s+r.income;},0)),
    totalCost:    Math.round(rows.reduce(function(s,r){return s+r.cost;},0)),
    totalProfit:  Math.round(rows.reduce(function(s,r){return s+r.profit;},0)),
    diseasePlots: rows.filter(function(r){return r.diseaseCount>0;}).length,
    cmdPlots:     rows.filter(function(r){return r.hasCMD;}).length,
    assessPass:   rows.filter(function(r){return r.assessResult==='ผ่าน';}).length,
    totalStemIn:  Math.round(rows.reduce(function(s,r){return s+r.stemIn;},0)),
    totalStemOut: Math.round(rows.reduce(function(s,r){return s+r.stemOut;},0)),
    districtCount: 0
  };
  // ── byDistrict aggregation ──
  var districtMap = {};
  rows.forEach(function(r) {
    var d = r.district || 'ไม่ระบุ';
    if (!districtMap[d]) districtMap[d] = {
      district:d, plotCount:0, totalArea:0, stemIn:0, stemOut:0,
      yieldTotal:0, yieldAreaSum:0, income:0, cost:0, profit:0,
      diseaseCount:0, cmdCount:0, assessPass:0, assessFail:0, assessNone:0
    };
    var m = districtMap[d];
    m.plotCount++; m.totalArea+=r.areaRai; m.stemIn+=r.stemIn; m.stemOut+=r.stemOut;
    m.yieldTotal+=r.yieldTotal; m.income+=r.income; m.cost+=r.cost; m.profit+=r.profit;
    if (r.yieldTotal>0) m.yieldAreaSum+=r.areaRai;
    if (r.diseaseCount>0) m.diseaseCount++;
    if (r.hasCMD) m.cmdCount++;
    if (r.assessResult==='ผ่าน') m.assessPass++;
    else if (r.assessResult==='ไม่ผ่าน') m.assessFail++;
    else m.assessNone++;
  });
  var byDistrict = Object.keys(districtMap).map(function(k) {
    var m = districtMap[k];
    m.avgYieldPerRai = m.yieldAreaSum>0 ? Math.round(m.yieldTotal/m.yieldAreaSum*100)/100 : 0;
    m.totalArea  = Math.round(m.totalArea*100)/100;
    m.yieldTotal = Math.round(m.yieldTotal*100)/100;
    m.income  = Math.round(m.income);
    m.cost    = Math.round(m.cost);
    m.profit  = Math.round(m.profit);
    return m;
  }).sort(function(a,b){return b.totalArea-a.totalArea;});
  sum.districtCount = byDistrict.length;
  // ── byVariety aggregation ──
  var varietyMap = {};
  rows.forEach(function(r) {
    var v = r.variety || 'ไม่ระบุ';
    if (!varietyMap[v]) varietyMap[v] = {variety:v, plotCount:0, totalArea:0, yieldTotal:0, yieldAreaSum:0, assessPass:0};
    varietyMap[v].plotCount++; varietyMap[v].totalArea+=r.areaRai;
    varietyMap[v].yieldTotal+=r.yieldTotal;
    if (r.yieldTotal>0) varietyMap[v].yieldAreaSum+=r.areaRai;
    if (r.assessResult==='ผ่าน') varietyMap[v].assessPass++;
  });
  var byVariety = Object.keys(varietyMap).map(function(k) {
    var v = varietyMap[k];
    v.avgYieldPerRai = v.yieldAreaSum>0 ? Math.round(v.yieldTotal/v.yieldAreaSum*100)/100 : 0;
    v.totalArea  = Math.round(v.totalArea*100)/100;
    v.yieldTotal = Math.round(v.yieldTotal*100)/100;
    return v;
  }).sort(function(a,b){return b.totalArea-a.totalArea;});
  // ── diseaseByType aggregation ──
  var dtMap = {};
  disease.forEach(function(d) {
    var t = String(d['ชนิดโรค']||'อื่นๆ');
    if (!dtMap[t]) dtMap[t] = {type:t, records:0, plotsSet:{}, sevSum:0, spreadSum:0};
    dtMap[t].records++; dtMap[t].plotsSet[d['รหัสแปลง']]=true;
    dtMap[t].sevSum    += parseFloat(d['ระดับความรุนแรง'])||0;
    dtMap[t].spreadSum += parseFloat(d['เปอร์เซ็นต์การระบาด'])||0;
  });
  var diseaseByType = Object.keys(dtMap).map(function(k) {
    var d=dtMap[k];
    return {type:d.type, records:d.records, plotsAffected:Object.keys(d.plotsSet).length,
      avgSeverity:d.records?Math.round(d.sevSum/d.records*10)/10:0,
      avgSpread:d.records?Math.round(d.spreadSum/d.records*10)/10:0};
  }).sort(function(a,b){return b.plotsAffected-a.plotsAffected;});
  // ── propagation details ──
  var propagDetails = propag.map(function(pr) {
    var pid=pr['รหัสแปลงต้นทาง'];
    var pl=allPlots.filter(function(x){return x['รหัสแปลง']===pid;})[0]||{};
    return {
      sourceId:       pid,
      sourceFarmer:   pl['ชื่อเจ้าของแปลง']||'',
      sourceDistrict: pl['อำเภอ']||'',
      date:           String(pr['วันที่แจกจ่าย']||'').slice(0,10),
      quantity:       parseFloat(pr['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)'])||0,
      recipientName:  pr['ชื่อผู้รับท่อนพันธุ์']||'',
      recipientPhone: pr['เบอร์โทรผู้รับ']||'',
      recipientAddr:  pr['ที่อยู่ผู้รับ']||'',
      purpose:        pr['วัตถุประสงค์']||'',
      variety:        pr['พันธุ์มันสำปะหลัง']||''
    };
  }).sort(function(a,b){return b.date.localeCompare(a.date);});
  // ── status counts ──
  var statusMap = {};
  rows.forEach(function(r){var s=r.status||'ไม่ระบุ'; statusMap[s]=(statusMap[s]||0)+1;});
  var statusCounts = Object.keys(statusMap).map(function(k){return {status:k,count:statusMap[k]};});
  return {
    ok: true, rows: rows, summary: sum,
    byDistrict: byDistrict, byVariety: byVariety,
    diseaseByType: diseaseByType, propagDetails: propagDetails,
    statusCounts: statusCounts
  };
}

/* ── Plots ── */
function api_getPlots_v3(params) {
  params = params || {};
  var u = AUTH_current();
  var plots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  if (params.year) plots = plots.filter(function(p) { return String(p['ปีงบประมาณ']||'') === String(params.year); });
  return { ok: true, data: plots.map(_mapPlot) };
}

function api_searchPlots_v3(params) {
  params = params || {};
  var q = String(params.q||'').toLowerCase();
  var u = AUTH_current();
  var plots = AUTH_scopePlots(DB_readAll('PLOTS'), u);
  if (params.year) plots = plots.filter(function(p) { return String(p['ปีงบประมาณ']||'') === String(params.year); });
  if (q.length >= 2) {
    plots = plots.filter(function(p) {
      return String(p['ชื่อเจ้าของแปลง']||'').toLowerCase().indexOf(q) !== -1 ||
             String(p['รหัสแปลง']||'').toLowerCase().indexOf(q) !== -1 ||
             String(p['อำเภอ']||'').toLowerCase().indexOf(q) !== -1 ||
             String(p['เบอร์โทรศัพท์']||'').indexOf(q) !== -1;
    });
  }
  return { ok: true, data: plots.map(_mapPlot) };
}

function api_getPlotDetail_v3(params) {
  var plotId = params.plotId || params.id || '';
  var res = api_plotDetail(plotId);
  if (!res.ok) return res;
  var pl = res.plot || {};
  var mapped = _mapPlot(pl);
  // รวม timeline ทุกประเภท พร้อม type และ raw data (เรียงล่าสุดขึ้นบน)
  var records = [];
  (res.growth||[]).forEach(function(r) {
    records.push({
      type: 'growth', icon: '🌱',
      date: String(r['วันที่ติดตาม']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'เจริญเติบโต: สูง '+(r['ความสูงเฉลี่ย(ซม.)']||'—')+' ซม. | อายุ '+(r['อายุพืช(วัน)']||'—')+' วัน | ความสมบูรณ์ '+(r['ความสมบูรณ์(1-5)']||'—')+'/5',
      sub: r['ผู้ติดตาม'] ? '👤 '+r['ผู้ติดตาม'] : '',
      id: r['รหัสบันทึก'] || ''
    });
  });
  (res.disease||[]).forEach(function(r) {
    var isCMD = /CMD|SLCMV|ใบด่าง/.test(String(r['ชนิดโรค']||''));
    records.push({
      type: 'disease', icon: isCMD ? '🚨' : '⚠️',
      date: String(r['วันที่สำรวจ']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'โรค: '+(r['ชนิดโรค']||'—')+' | ระดับ '+(r['ระดับความรุนแรง']||'—')+' | ระบาด '+(r['เปอร์เซ็นต์การระบาด']||'0')+'%',
      sub: r['ผู้สำรวจ'] ? '👤 '+r['ผู้สำรวจ'] : '',
      id: r['รหัสบันทึก'] || '', alert: isCMD
    });
  });
  (res.yield||[]).forEach(function(r) {
    records.push({
      type: 'yield', icon: '🌾',
      date: String(r['วันที่เก็บเกี่ยว']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'ผลผลิต: '+(r['ผลผลิตรวม(ตัน)']||'—')+' ตัน ('+(r['ผลผลิตต่อไร่(ตัน/ไร่)']||'—')+' ตัน/ไร่) | รายได้ '+Number(r['รายได้รวม(บาท)']||0).toLocaleString()+' บาท',
      sub: r['ผู้รับซื้อ'] ? '🏪 '+r['ผู้รับซื้อ'] : '',
      id: r['รหัสบันทึก'] || ''
    });
  });
  (res.cost||[]).forEach(function(r) {
    records.push({
      type: 'cost', icon: '💰',
      date: String(r['วันที่']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'ต้นทุน: '+(r['ประเภทต้นทุน']||'—')+' — '+(r['รายการ']||'')+ ' '+Number(r['จำนวนเงิน(บาท)']||0).toLocaleString()+' บาท',
      id: r['รหัสบันทึก'] || ''
    });
  });
  (res.assessments||[]).forEach(function(r) {
    var pass = r['ผลการประเมิน'] === 'ผ่าน';
    records.push({
      type: 'assessment', icon: pass ? '✅' : '❌',
      date: String(r['วันที่ประเมิน']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'ประเมินแปลง '+(r['ครั้งที่ประเมิน']||'')+ ' | ผล: '+(r['ผลการประเมิน']||'—')+' | เส้นผ่าน '+(r['ขนาดเส้นผ่านศูนย์กลางท่อนพันธุ์']||'—'),
      id: r['รหัสการประเมิน'] || ''
    });
  });
  (res.propagations||[]).forEach(function(r) {
    records.push({
      type: 'propagation', icon: '🌿',
      date: String(r['วันที่แจกจ่าย']||r['วันที่บันทึก']||'').slice(0,10),
      text: 'แจกท่อนพันธุ์ '+Number(r['จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)']||0).toLocaleString()+' ลำ → '+(r['ชื่อผู้รับท่อนพันธุ์']||'—'),
      sub: r['วัตถุประสงค์'] ? '📌 '+r['วัตถุประสงค์'] : '',
      id: r['รหัสการขยายผล'] || ''
    });
  });
  // เรียงล่าสุดขึ้นบนสุด
  records.sort(function(a,b) { return b.date.localeCompare(a.date); });
  // rule-based AI สำหรับ quick status
  var aiText = null;
  try {
    var aiRes = api_aiAnalyzePlot(plotId);
    if (aiRes.ok && aiRes.analysis && aiRes.analysis.length) aiText = aiRes.analysis.join('\n');
  } catch(e) {}
  return {
    ok: true,
    data: {
      plot: mapped, records: records, aiAnalysis: aiText,
      summary: res.summary || {}
    }
  };
}

function api_addPlot_v3(data) {
  return api_savePlot(_unMapPlot(data));
}
function api_updatePlot_v3(data) {
  var row = _unMapPlot(data);
  if (!row['รหัสแปลง'] && data.plotId) row['รหัสแปลง'] = data.plotId;
  return api_savePlot(row);
}

/* ── Projects ── */
function api_getProjects_v3(params) {
  params = params || {};
  var projects = api_listProjects();
  if (params.year) projects = projects.filter(function(p) { return String(p['ปีงบประมาณ']||'') === String(params.year); });
  var plots = DB_readAll('PLOTS');
  var countMap = {};
  plots.forEach(function(p) { var n = p['ชื่อโครงการ']; if (n) countMap[n] = (countMap[n]||0)+1; });
  return {
    ok: true,
    data: projects.map(function(p) {
      return {
        projectId:    p['รหัสโครงการ']      || '',
        projectCode:  p['รหัสโครงการ']      || '',
        name:         p['ชื่อโครงการ']      || '',
        year:         p['ปีงบประมาณ']       || '',
        budget:       p['งบประมาณ(บาท)']   || 0,
        budgetSource: p['แหล่งงบประมาณ']   || '',
        startDate:    String(p['วันเริ่มโครงการ']||'').slice(0,10),
        endDate:      String(p['วันสิ้นสุดโครงการ']||'').slice(0,10),
        responsible:  p['ผู้รับผิดชอบ']     || '',
        projectStatus:p['สถานะ']           || '',
        desc:         p['หมายเหตุ']         || '',
        plotCount:    countMap[p['ชื่อโครงการ']]||0
      };
    })
  };
}
function api_addProject_v3(data) {
  return api_saveProject({
    'ชื่อโครงการ':      data.name          || '',
    'ปีงบประมาณ':       String(data.year   || ''),
    'งบประมาณ(บาท)':   data.budget        || '',
    'แหล่งงบประมาณ':   data.budgetSource  || '',
    'วันเริ่มโครงการ':  data.startDate     || '',
    'วันสิ้นสุดโครงการ':data.endDate       || '',
    'ผู้รับผิดชอบ':     data.responsible   || '',
    'สถานะ':           data.projectStatus || 'กำลังดำเนินการ',
    'หมายเหตุ':        data.desc          || ''
  });
}
function api_updateProject_v3(data) {
  return api_saveProject({
    'รหัสโครงการ':      data.projectId     || '',
    'ชื่อโครงการ':      data.name          || '',
    'ปีงบประมาณ':       String(data.year   || ''),
    'งบประมาณ(บาท)':   data.budget        || '',
    'แหล่งงบประมาณ':   data.budgetSource  || '',
    'วันเริ่มโครงการ':  data.startDate     || '',
    'วันสิ้นสุดโครงการ':data.endDate       || '',
    'ผู้รับผิดชอบ':     data.responsible   || '',
    'สถานะ':           data.projectStatus || '',
    'หมายเหตุ':        data.desc          || ''
  });
}

/* ── Areas ── */
function api_getAreas_v3() {
  var areas = api_listAreas();
  var distMap = {};
  areas.forEach(function(a) { var d = a['อำเภอ']||''; if (d) distMap[d] = true; });
  return { ok: true, data: Object.keys(distMap).map(function(d) { return { districtId: d, name: d }; }) };
}

/* ── Users ── */
function api_getUsers_v3() {
  var users = api_listUsers();
  return {
    ok: true,
    data: users
      .filter(function(u) { return String(u['สถานะ'] || '') !== 'รออนุมัติ'; })
      .map(function(u) {
        return {
          userId:   u['อีเมล']             || u['เบอร์โทร']||'',
          name:     u['ชื่อ-สกุล']         || '',
          phone:    u['เบอร์โทร']          || '',
          role:     u['บทบาท']             || '',
          district: u['อำเภอที่รับผิดชอบ'] || '',
          status:   u['สถานะ']             || 'ใช้งาน'
        };
      })
  };
}
function api_addUser_v3(data) {
  return api_saveUser({
    'ชื่อ-สกุล':         data.name     || '',
    'เบอร์โทร':          data.phone    || '',
    'บทบาท':            data.role     || 'อำเภอ',
    'อำเภอที่รับผิดชอบ': data.district || '',
    'สถานะ':            'ใช้งาน'
  });
}
function api_resetPin_v3(params) {
  AUTH_requireAdmin();
  var userId = params.userId || '';
  if (!userId) return { ok: false, error: 'ไม่พบรหัสผู้ใช้' };
  var user = DB_findBy('USERS','อีเมล',userId) || DB_findBy('USERS','เบอร์โทร',userId);
  if (!user) return { ok: false, error: 'ไม่พบผู้ใช้' };
  DB_updateById('USERS','อีเมล',user['อีเมล']||userId,{'PIN':''});
  return { ok: true };
}
function api_changePin_v3(params) {
  var newPin = String(params.newPin||'').trim();
  if (!/^\d{4,6}$/.test(newPin)) return { ok: false, error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' };
  return api_setPin({ pin: newPin });
}

/* ── Approvals ── */
function api_getPendingApprovals_v3() {
  var u = AUTH_current();
  if (!AUTH_canApprove(u)) return { ok: true, data: [] };
  var rows = api_listApprovals('รออนุมัติ');
  return {
    ok: true,
    data: rows.map(function(r) {
      return {
        approvalId:  r['รหัสคำขอ']     || '',
        plotCode:    r['รหัสอ้างอิง']  || '',
        description: r['รายละเอียดย่อ'] || '',
        requestBy:   r['ผู้ขอ']         || '',
        requestDate: String(r['วันที่ขอ']||'').slice(0,10)
      };
    })
  };
}
function api_approveRequest_v3(params) {
  var id = params.approvalId || '';
  if (!id) return { ok: false, error: 'ไม่พบรหัสคำขอ' };
  if (params.approve === false) return api_rejectChange(id, '');
  return api_approveChange(id);
}

/* ── Public plot (QR scan) — PDPA-safe, no personal data ── */
function api_getPublicPlot_v3(params) {
  var plotId = params.plotId || params.id || '';
  var plot = DB_findBy('PLOTS', 'รหัสแปลง', plotId);
  if (!plot) return { ok: false, error: 'ไม่พบข้อมูลแปลง' };

  // Latest assessment (result only, no personal evaluation details)
  var assessments = DB_readAll('ASSESSMENTS')
    .filter(function(r) { return r['รหัสแปลง'] === plotId; })
    .sort(function(a, b) {
      var da = a['วันที่ประเมิน'] || a['วันที่บันทึก'] || '';
      var db_ = b['วันที่ประเมิน'] || b['วันที่บันทึก'] || '';
      return db_ > da ? 1 : -1;
    });
  var la = assessments.length ? assessments[0] : null;

  // Disease aggregate status (no individual farmer data)
  var diseases = DB_readAll('DISEASE').filter(function(r) { return r['รหัสแปลง'] === plotId; });
  var hasCMD = diseases.some(function(r) {
    var t = String(r['ชนิดโรค'] || '').toUpperCase();
    return t.indexOf('CMD') >= 0 || t.indexOf('SLCMV') >= 0 || t.indexOf('ใบด่าง') >= 0;
  });
  var diseaseStatus = hasCMD ? 'พบ CMD/SLCMV — อยู่ระหว่างดำเนินการ'
    : diseases.length ? 'พบโรคอื่น (' + diseases.length + ' รายการ)'
    : 'ไม่พบ';

  return {
    ok: true,
    data: {
      plotCode:     plot['รหัสแปลง']                                        || '',
      variety:      plot['พันธุ์มันสำปะหลัง']                               || '',
      varietyType:  plot['ประเภทพันธุ์']                                     || '',
      areaRai:      plot['พื้นที่(ไร่)']                                     || '',
      stemSupport:  plot['จำนวนท่อนพันธุ์ที่ได้รับการสนับสนุน(ลำ)']        || '',
      project:      plot['ชื่อโครงการ']                                      || '',
      activity:     plot['ชื่อกิจกรรม']                                      || '',
      subdistrict:  plot['ตำบล']                                             || '',
      district:     plot['อำเภอ']                                            || '',
      province:     plot['จังหวัด']                                          || '',
      plantDate:    String(plot['วันที่ปลูก']||'').slice(0,10),
      harvestDate:  String(plot['คาดว่าเก็บเกี่ยววันที่']||'').slice(0,10),
      plotStatus:   plot['สถานะแปลง']                                        || '',
      year:         plot['ปีงบประมาณ']                                       || '',
      // Assessment result (aggregate, PDPA-safe)
      assessResult: la ? (la['ผลการประเมิน'] || '') : '',
      assessRound:  la ? (la['ครั้งที่ประเมิน'] || '') : '',
      assessDate:   la ? String(la['วันที่ประเมิน'] || la['วันที่บันทึก'] || '').slice(0,10) : '',
      assessCount:  assessments.length,
      // Disease aggregate
      diseaseStatus: diseaseStatus,
      hasCMD:       hasCMD
    }
  };
}

/* ── Sub-record adapters (camelCase → Thai headers) ── */
function api_addGrowth_v3(d) {
  return api_addGrowth({
    'รหัสแปลง':           d.plotId        || '',
    'วันที่ติดตาม':        d.date          || DB_now().slice(0,10),
    'อายุพืช(วัน)':        d.ageDays       || '',
    'ความสูงเฉลี่ย(ซม.)': d.height        || '',
    'จำนวนต้นต่อไร่':      d.stemCount     || '',
    'ความสมบูรณ์(1-5)':   d.growthScore   || '',
    'การให้น้ำ/ปุ๋ย':      d.irrigation    || '',
    'ผู้ติดตาม':           d.observer      || '',
    'หมายเหตุ':           d.note          || ''
  });
}
function api_addDisease_v3(d) {
  return api_addDisease({
    'รหัสแปลง':            d.plotId        || '',
    'วันที่สำรวจ':          d.date          || DB_now().slice(0,10),
    'ชนิดโรค':             d.diseaseType   || '',
    'ระดับความรุนแรง':     d.severity      || '',
    'เปอร์เซ็นต์การระบาด': d.affectedPct   || '',
    'จำนวนต้นที่พบ':        d.affectedCount || '',
    'การจัดการ/ควบคุม':    d.treatment     || '',
    'ละติจูดจุดพบ':         d.diseaseLat    || '',
    'ลองจิจูดจุดพบ':        d.diseaseLng    || '',
    'ผู้สำรวจ':             d.surveyor      || '',
    'หมายเหตุ':            d.note          || ''
  });
}
function api_addYield_v3(d) {
  var yTotal   = parseFloat(d.yieldTotal   || 0);
  var yPerRai  = parseFloat(d.yieldTon     || 0);
  var price    = parseFloat(d.pricePerTon  || 0);
  var income   = parseFloat(d.totalIncome  || 0);
  if (!income && yTotal && price) income = Math.round(yTotal * price);
  return api_addYield({
    'รหัสแปลง':             d.plotId              || '',
    'วันที่เก็บเกี่ยว':      d.harvestDate         || d.date || DB_now().slice(0,10),
    'ผลผลิตรวม(ตัน)':       yTotal                || '',
    'ผลผลิตต่อไร่(ตัน/ไร่)': yPerRai               || '',
    'เปอร์เซ็นต์เชื้อแป้ง':  d.starchPct           || '',
    'ราคาขาย(บาท/ตัน)':     price                 || '',
    'รายได้รวม(บาท)':       income                || '',
    'ผู้รับซื้อ':            d.buyer               || '',
    'หมายเหตุ':             d.note                || ''
  });
}
function api_addCost_v3(d) {
  return api_addCost({
    'รหัสแปลง':       d.plotId   || '',
    'ประเภทต้นทุน':   d.costType || '',
    'รายการ':         d.detail   || '',
    'จำนวนเงิน(บาท)': d.amount   || '',
    'วันที่':         d.date     || DB_now().slice(0,10),
    'หมายเหตุ':       d.note     || ''
  });
}
function api_addAssessment_v3(d) {
  return api_addAssessment({
    'รหัสแปลง':                   d.plotId          || '',
    'ครั้งที่ประเมิน':               d.assessRound     || '',
    'วันที่ประเมิน':                 d.date            || DB_now().slice(0,10),
    'อายุต้นพันธุ์(เดือน)':          d.ageMonths       || '',
    'อายุต้นพันธุ์(วัน)':            d.ageDaysAssess   || '',
    'ขนาดเส้นผ่านศูนย์กลางท่อนพันธุ์': d.stemDiameter || '',
    'ความยาวท่อนพันธุ์(ลำ)':         d.stemLength      || '',
    'ประเภทพื้นที่':                 d.areaType        || '',
    'พบโรคใบด่าง':                  d.foundDisease    || 'ไม่ใช่',
    'อัตราร้อยละโรคใบด่าง':          d.diseasePct      || '0',
    'ลักษณะการระบาด':               d.diseasePattern  || '',
    'รายการศัตรูพืชอื่น':            d.otherPests      || '',
    'ผลการประเมิน':                 d.assessResult    || '',
    'หมายเหตุ':                    d.note            || ''
  });
}
function api_addPropagation_v3(d) {
  return api_addPropagation({
    'รหัสแปลงต้นทาง':               d.plotId         || '',
    'วันที่แจกจ่าย':                 d.date           || DB_now().slice(0,10),
    'จำนวนท่อนพันธุ์ที่แจกจ่าย(ลำ)': d.stemQty        || '',
    'ชื่อผู้รับท่อนพันธุ์':           d.recipientName  || '',
    'เบอร์โทรผู้รับ':                d.recipientPhone || '',
    'ที่อยู่ผู้รับ':                  d.recipientAddr  || '',
    'ตำบล':                         d.recSubdistrict || '',
    'อำเภอ':                        d.recDistrict    || '',
    'จังหวัด':                      d.recProvince    || 'กำแพงเพชร',
    'พันธุ์มันสำปะหลัง':             d.variety        || '',
    'วัตถุประสงค์':                  d.purpose        || '',
    'หมายเหตุ':                     d.note           || ''
  });
}


/* ── WMS Proxy: แก้ปัญหา CORS สำหรับ GetFeatureInfo ── */
/* Browser ยิง GetFeatureInfo JSON ตรงไม่ได้ เพราะ LDD ไม่ส่ง CORS header
   ใช้ GAS เป็น proxy แทน — UrlFetchApp ไม่มีข้อจำกัด CORS */
function api_fetchAllSoilData(params) {
  var lat = parseFloat(params.lat);
  var lng = parseFloat(params.lng);
  if (isNaN(lat) || isNaN(lng)) return { ok: false, error: 'พิกัดไม่ถูกต้อง' };

  var base = 'https://agri-map-online.moac.go.th/geoserver/ldd/wms';
  var d = 0.0001;
  var bbox = [(lng-d),(lat-d),(lng+d),(lat+d)].join(',');
  var common = '&BBOX='+bbox+'&WIDTH=11&HEIGHT=11&X=5&Y=5'+
    '&SRS=EPSG:4326&FORMAT=image/png&INFO_FORMAT=application/json'+
    '&FEATURE_COUNT=1&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo';

  var layers = ['ldd:soil_series_50','ldd:suit_cassava','ldd:soil_ph','ldd:soil_om'];
  var requests = layers.map(function(layer) {
    return {
      url: base + '?LAYERS=' + encodeURIComponent(layer) +
           '&QUERY_LAYERS=' + encodeURIComponent(layer) + common,
      muteHttpExceptions: true
    };
  });

  try {
    var responses = UrlFetchApp.fetchAll(requests);
    var keys = ['soil_series_50','suit_cassava','soil_ph','soil_om'];
    var result = {};
    responses.forEach(function(resp, i) {
      try {
        result[keys[i]] = (resp.getResponseCode() === 200)
          ? JSON.parse(resp.getContentText()) : null;
      } catch(e) { result[keys[i]] = null; }
    });
    return { ok: true, data: result };
  } catch(e) {
    return { ok: false, error: 'WMS ไม่ตอบสนอง: ' + e.message };
  }
}


/* ===================== 08_LINE_Notify ===================== */
/* ส่งข้อความแจ้งเตือนผ่าน LINE Messaging API (Push Message)
   ตั้งค่าใน Script Properties:
     LINE_CHANNEL_TOKEN = Channel access token จาก LINE Developers
     LINE_GROUP_ID      = Group ID หรือ User ID ที่ต้องการรับแจ้งเตือน  */

function LINE_send(message) {
  var token   = CFG_get('LINE_CHANNEL_TOKEN', '');
  var groupId = CFG_get('LINE_GROUP_ID', '');
  if (!token || !groupId) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log('LINE error: ' + e.message); }
}

function LINE_newStaff(name, phone, role, district) {
  LINE_send(
    '🆕 คำขอสมัครเจ้าหน้าที่ใหม่\n' +
    '👤 ' + name + '\n' +
    '📞 ' + phone + '\n' +
    '🏷 ' + role + (district ? ' — ' + district : '')
  );
}

function LINE_newPlot(plotId, farmerName, district, areaRai) {
  LINE_send(
    '🌿 เพิ่มแปลงใหม่\n' +
    '🆔 ' + plotId + ' — ' + farmerName + '\n' +
    '📍 อ.' + (district || '—') + '  📐 ' + (areaRai || '—') + ' ไร่'
  );
}

function LINE_diseaseAlert(plotId, farmerName, diseaseType, severity) {
  var critical = /CMD|SLCMV|ใบด่าง/.test(String(diseaseType));
  LINE_send(
    (critical ? '🚨 พบโรคอันตราย!' : '⚠️ แจ้งเตือนโรคพืช') + '\n' +
    '🆔 ' + plotId + ' — ' + farmerName + '\n' +
    '🦠 ' + diseaseType + '  ระดับ ' + (severity || '—') +
    (critical ? '\n🔴 ต้องถอนทำลาย!' : '')
  );
}

function LINE_approvalRequest(tableKey, brief, requesterName) {
  var sheetName = (SHEETS[tableKey] && SHEETS[tableKey].name) ? SHEETS[tableKey].name : tableKey;
  LINE_send(
    '📋 คำขออนุมัติใหม่\n' +
    '📂 ' + sheetName + '\n' +
    '📝 ' + brief + '\n' +
    '👤 ' + (requesterName || '—')
  );
}

function LINE_approvalDone(approved, brief, approverName) {
  LINE_send(
    (approved ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธคำขอ') + '\n' +
    '📝 ' + brief + '\n' +
    '👤 ' + (approverName || '—')
  );
}

function LINE_plotDeleted(plotId, farmerName, deletedBy) {
  LINE_send(
    '🗑 ลบแปลงออกจากระบบ\n' +
    '🆔 ' + plotId + ' — ' + (farmerName || '—') + '\n' +
    '👤 โดย ' + (deletedBy || '—')
  );
}

function LINE_userApproved(name, phone, role) {
  LINE_send(
    '✅ อนุมัติเจ้าหน้าที่\n' +
    '👤 ' + name + '  📞 ' + phone + '\n' +
    '🏷 ' + role
  );
}

// ── LINE Config API (admin only) ──────────────────────────

function api_getLineConfig() {
  AUTH_requireAdmin();
  var token   = CFG_get('LINE_CHANNEL_TOKEN', '');
  var groupId = CFG_get('LINE_GROUP_ID', '');
  return {
    ok: true,
    hasToken:        !!token,
    hasGroupId:      !!groupId,
    tokenPreview:    token   ? token.slice(0, 8)   + '…' : '',
    groupIdPreview:  groupId ? groupId.slice(0, 6) + '…' : ''
  };
}

function api_saveLineConfig(params) {
  AUTH_requireAdmin();
  if (typeof params.token   !== 'undefined') CFG_set('LINE_CHANNEL_TOKEN', params.token);
  if (typeof params.groupId !== 'undefined') CFG_set('LINE_GROUP_ID',      params.groupId);
  return { ok: true };
}

function api_testLineNotify() {
  AUTH_requireAdmin();
  if (!CFG_get('LINE_CHANNEL_TOKEN','') || !CFG_get('LINE_GROUP_ID',''))
    return { ok: false, error: 'ยังไม่ได้ตั้งค่า LINE Token หรือ Group ID' };
  LINE_send('🌿 ทดสอบแจ้งเตือน CassavaPlot v3\nจังหวัดกำแพงเพชร\n' + DB_now());
  return { ok: true };
}
