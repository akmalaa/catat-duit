// ================================================================
//  CatatDuit — Google Apps Script Web App
// ================================================================
//
//  SETUP spreadsheetId (pilih salah satu):
//  A) Apps Script → Project Settings → Script Properties → tambah:
//       Key: spreadsheetId  |  Value: <id dari URL spreadsheet>
//  B) Atau isi SETTINGS.spreadsheetIdFallback di bawah
//
//  CARA DEPLOY:
//  1. Buka spreadsheet → Extensions → Apps Script
//  2. Paste seluruh isi file ini, ganti kode yang ada
//  3. Deploy → New deployment → Type: Web App
//  4. Execute as: Me | Who has access: Anyone
//  5. Copy URL-nya, paste ke Pengaturan di CatatDuit PWA
// ================================================================

// ── Settings backend (bukan menu Pengaturan di PWA) ───────────
var SETTINGS = {
  // Key di Script Properties — disarankan untuk production
  propKeySpreadsheetId: 'spreadsheetId',
  // Fallback cepat saat development (kosongkan placeholder kalau pakai Script Properties)
  spreadsheetIdFallback: 'YOUR_SPREADSHEET_ID_HERE',
};

// Harus persis sama dengan nama tab di spreadsheet (lihat docs/SPREADSHEET-CONTEXT.md)
var MONTH_NAMES = [
  'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
];

// ── Kolom Tabel Master (1-indexed, A=1) ─────────────────────
//    F=Tanggal, G=Keterangan, H=Kategori, I=Metode,
//    J=Sub-Kategori, K=Pemasukan, L=Pengeluaran, M=Saldo(formula)
var COL_F  = 6;   // Tanggal
var COL_G  = 7;   // Keterangan
var COL_H  = 8;   // Kategori
var COL_I  = 9;   // Metode (router)
var COL_J  = 10;  // Sub-Kategori
var COL_K  = 11;  // Pemasukan
var COL_L  = 12;  // Pengeluaran
var MASTER_START = 4;
var MASTER_END   = 124;
var SUB_END      = 117;

// ── Sub-tabel: Tarik Cash (W4:AB117) ────────────────────────
//    W=Tanggal, X=Keterangan, Y=Tipe('Tarik Cash'), AA=Nominal
var COL_W  = 23;  // Tanggal
var COL_X  = 24;  // Keterangan
var COL_Y  = 25;  // Tipe — filter key
var COL_AA = 27;  // Nominal — value key

// ── Sub-tabel: Topup Gopay (AD4:AI117) ──────────────────────
//    AD=Tanggal, AE=Keterangan, AF=Tipe('Topup Gopay'), AH=Nominal
var COL_AD = 30;
var COL_AE = 31;
var COL_AF = 32;
var COL_AH = 34;

// ── Sub-tabel: Topup Shopeepay (AK4:AP117) ──────────────────
//    AK=Tanggal, AL=Keterangan, AM=Tipe('Topup Shopeepay'), AO=Nominal
var COL_AK = 37;
var COL_AL = 38;
var COL_AM = 39;
var COL_AO = 41;

var SUB_START = 4;

// ── Tabel Budget per bulan (A63 = sub-kategori, B63 = nominal) ──
var BUDGET_START = 63;
var BUDGET_ROWS  = 20;
var COL_BUDGET_CAT = 1;
var COL_BUDGET_VAL = 2;

// Metode kolom I untuk kategori transfer — harus sama dengan TRANSFER_METODE di constants.js
var TRANSFER_METODE = {
  'Topup Gopay':     'Gopay',
  'Topup Shopeepay': 'Shopeepay',
  'Tarik Cash':      'Cash',
};

// ================================================================
//  Helpers
// ================================================================

function loadSettings() {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty(SETTINGS.propKeySpreadsheetId)
    || props.getProperty('SPREADSHEET_ID'); // legacy key

  if (!spreadsheetId && SETTINGS.spreadsheetIdFallback !== 'YOUR_SPREADSHEET_ID_HERE') {
    spreadsheetId = SETTINGS.spreadsheetIdFallback;
  }

  if (!spreadsheetId) {
    throw new Error(
      'Settings spreadsheetId belum diset. Tambah Script Property "' +
      SETTINGS.propKeySpreadsheetId + '" di Project Settings, ' +
      'atau isi SETTINGS.spreadsheetIdFallback di Code.gs.'
    );
  }

  return { spreadsheetId: spreadsheetId };
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(loadSettings().spreadsheetId);
}

function getActiveSheet() {
  return getSheetForMonth(new Date().getMonth());
}

function getSheetForMonth(monthIndex) {
  var ss  = getSpreadsheet();
  var idx = (monthIndex !== undefined && monthIndex !== null && monthIndex !== '')
    ? parseInt(monthIndex, 10)
    : new Date().getMonth();
  if (isNaN(idx) || idx < 0 || idx > 11) idx = new Date().getMonth();
  var month = MONTH_NAMES[idx];
  var sheet = ss.getSheetByName(month);
  if (!sheet) throw new Error('Sheet "' + month + '" tidak ditemukan.');
  return sheet;
}

function findNextEmptyRow(sheet, startRow, col) {
  var lastRow = Math.max(sheet.getLastRow(), startRow - 1);
  for (var r = startRow; r <= lastRow + 1; r++) {
    var val = sheet.getRange(r, col).getValue();
    if (val === '' || val === null || val === undefined) return r;
    if (r > 600) break; // safety cap
  }
  return lastRow + 1;
}

function capLastRow(lastRow, maxRow) {
  return Math.min(Math.max(lastRow, 0), maxRow);
}

function sumSubTable(sheet, startRow, endRow, dateCol, nominalCol) {
  var lastRow = capLastRow(sheet.getLastRow(), endRow);
  if (lastRow < startRow) return 0;
  var dates = sheet.getRange(startRow, dateCol, lastRow, dateCol).getValues();
  var vals  = sheet.getRange(startRow, nominalCol, lastRow, nominalCol).getValues();
  var total = 0;
  for (var i = 0; i < dates.length; i++) {
    if (!dates[i][0]) continue;
    total += parseFloat(vals[i][0]) || 0;
  }
  return total;
}

function emptySummary() {
  return {
    Cash:      { pemasukan: 0, pengeluaran: 0 },
    Mandiri:   { pemasukan: 0, pengeluaran: 0 },
    Gopay:     { pemasukan: 0, pengeluaran: 0 },
    Shopeepay: { pemasukan: 0, pengeluaran: 0 },
  };
}

function cloneSummaryPart(part) {
  var out = {};
  var keys = Object.keys(part);
  for (var i = 0; i < keys.length; i++) {
    var m = keys[i];
    out[m] = { pemasukan: part[m].pemasukan, pengeluaran: part[m].pengeluaran };
  }
  return out;
}

function applySaldo(summary) {
  var keys = Object.keys(summary);
  for (var k = 0; k < keys.length; k++) {
    var m = keys[k];
    summary[m].saldo = summary[m].pemasukan - summary[m].pengeluaran;
  }
  return summary;
}

function logSummaryCalc(sheetName, lastRow, masterPart, transferPart, masterTotals, summary) {
  Logger.log('──────── getSummary ────────');
  Logger.log('Sheet: %s | lastRow: %s', sheetName, lastRow);
  Logger.log('[1] Tabel master — total: masuk %s | keluar %s', masterTotals.pemasukan, masterTotals.pengeluaran);
  var mKeys = Object.keys(masterPart);
  for (var i = 0; i < mKeys.length; i++) {
    var met = mKeys[i];
    var mp = masterPart[met];
    if (mp.pemasukan === 0 && mp.pengeluaran === 0) continue;
    Logger.log('  %s → masuk: %s | keluar: %s', met, mp.pemasukan, mp.pengeluaran);
  }
  Logger.log('[2] Sub-tabel transfer (pemasukan di tujuan)');
  Logger.log('  Tarik Cash → Cash +%s', transferPart.tarikCash);
  Logger.log('  Topup Gopay → Gopay +%s', transferPart.topupGopay);
  Logger.log('  Topup Shopeepay → Shopeepay +%s', transferPart.topupShopeepay);
  Logger.log('[3] Saldo akhir per metode');
  var keys = Object.keys(summary);
  for (var j = 0; j < keys.length; j++) {
    var m = keys[j];
    Logger.log('  %s → masuk: %s | keluar: %s | saldo: %s', m, summary[m].pemasukan, summary[m].pengeluaran, summary[m].saldo);
  }
  Logger.log('────────────────────────────');
}

// Membungkus respons dengan JSONP callback jika ada parameter ?callback=
// Ini menghindari CORS karena browser mengeksekusi respons sebagai <script>
function respond(payload, callback) {
  var json = JSON.stringify(payload);
  if (callback) {
    // JSONP: callback({...})
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  // Fallback: plain JSON
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data, msg, callback) {
  return respond({ success: true, data: data || null, message: msg || '' }, callback);
}

function err(msg, callback) {
  return respond({ success: false, data: null, message: msg }, callback);
}

// ================================================================
//  Entry Point — doGet
//  Frontend sends GET: ?action=xxx&data={json}&limit=N
// ================================================================

function doGet(e) {
  // Ambil callback untuk JSONP (dikirim otomatis dari PWA)
  var cb = e.parameter.callback || null;
  try {
    var action = e.parameter.action || '';

    if (action === 'ping')            return ok(null, 'pong', cb);
    if (action === 'addTransaction')  return handleAdd(JSON.parse(e.parameter.data), cb);
    if (action === 'getSummary')      return handleSummary(cb, e.parameter.debug === '1', e.parameter.month);
    if (action === 'getTransactions') return handleTransactions(parseInt(e.parameter.limit) || 30, cb, e.parameter.month);
    if (action === 'getBudgets')      return handleGetBudgets(cb, e.parameter.month);
    if (action === 'saveBudgets')     return handleSaveBudgets(JSON.parse(e.parameter.data), cb, e.parameter.month);

    return err('Aksi tidak dikenal: ' + action, cb);
  } catch(ex) {
    return err('Error: ' + ex.message, cb);
  }
}

// ================================================================
//  Handler: Add Transaction
// ================================================================

function normalizeKategori(k) {
  // Spreadsheet validasi kolom H pakai "Pemasukkan" (double k)
  if (k === 'Pemasukan') return 'Pemasukkan';
  return k;
}

function normalizeMetode(kategori, metode) {
  return TRANSFER_METODE[kategori] || metode;
}

function handleAdd(data, cb) {
  Logger.log('========== HANDLE ADD START ==========');
  Logger.log('Payload: %s', JSON.stringify(data));

  try {
    data.kategori = normalizeKategori(data.kategori);
    var metodeAsli = data.metode;
    data.metode = normalizeMetode(data.kategori, data.metode);
    if (data.metode !== metodeAsli) {
      Logger.log('Metode disesuaikan: %s → %s (kategori %s)', metodeAsli, data.metode, data.kategori);
    }
    var sheet = getActiveSheet();

    Logger.log('Sheet aktif: %s', sheet.getName());

    // ── 1. Tulis ke Tabel Master ─────────────────────────────
    var row = findNextEmptyRow(sheet, MASTER_START, COL_F);

    Logger.log('Baris master ditemukan: %s', row);

    sheet.getRange(row, COL_F).setValue(data.tanggal);
    sheet.getRange(row, COL_G).setValue(data.keterangan || data.kategori);
    sheet.getRange(row, COL_H).setValue(data.kategori);
    sheet.getRange(row, COL_I).setValue(data.metode);
    sheet.getRange(row, COL_J).setValue(data.subKategori || 'Lain-lain');

    if (data.tipe === 'pemasukan') {
      sheet.getRange(row, COL_K).setValue(Number(data.nominal) || 0);
      sheet.getRange(row, COL_L).setValue('');
    } else {
      sheet.getRange(row, COL_K).setValue('');
      sheet.getRange(row, COL_L).setValue(Number(data.nominal) || 0);
    }

    Logger.log(
      'Master tersimpan | row=%s | kategori=%s | metode=%s | tipe=%s | nominal=%s',
      row,
      data.kategori,
      data.metode,
      data.tipe,
      data.nominal
    );

    Logger.log('========== HANDLE ADD SUCCESS ==========');

    return ok(null, 'Transaksi berhasil disimpan!', cb);

  } catch (e) {

    Logger.log('========== HANDLE ADD ERROR ==========');
    Logger.log('Message: %s', e.message);
    Logger.log('Stack: %s', e.stack);

    return err('handleAdd gagal: ' + e.message, cb);
  }
}

// ================================================================
//  Handler: Get Summary (saldo per metode)
//
//  LOGIKA (sesuai REKAP spreadsheet):
//  - Baca semua baris Tabel Master (F4:L124)
//  - amount per baris = K + L (hanya satu yang non-zero)
//  - Arah (pemasukan/pengeluaran) ditentukan oleh Kategori (col H):
//
//    Cash      → +saldo jika: Tarik Cash | Hutang (Masuk) | Pemasukan
//    Gopay     → +saldo jika: Topup Gopay | Hutang (Masuk) | Pemasukan
//    Shopeepay → +saldo jika: Topup Shopeepay | Hutang (Masuk) | Pemasukan
//    Mandiri   → +saldo jika: Pemasukan | Hutang (Masuk)
//
//  - masterTotals = SUM(K) dan SUM(L) seluruh master (untuk "Semua" row)
// ================================================================

function handleSummary(cb, includeDebug, monthIndex) {
  var sheet     = getSheetForMonth(monthIndex);
  var sheetName = sheet.getName();
  var lastRow   = capLastRow(sheet.getLastRow(), MASTER_END);
  var summary   = emptySummary();
  // Baca Saldo Awal Bulan dari C5:C29 (baris 5 - 29)
  // Index dalam array (0-based): C5=0, C11=6, C17=12, C23=18, C29=24
  var saldoAwalData = sheet.getRange(5, 3, 25, 1).getValues();
  var masterTotals = {
    pemasukan: 0,
    pengeluaran: 0,
    saldoAwal: parseFloat(saldoAwalData[0][0]) || 0
  };

  // set saldoAwal ke masing-masing objek
  summary.Mandiri.saldoAwal   = parseFloat(saldoAwalData[6][0])  || 0;
  summary.Cash.saldoAwal      = parseFloat(saldoAwalData[12][0]) || 0;
  summary.Gopay.saldoAwal     = parseFloat(saldoAwalData[18][0]) || 0;
  summary.Shopeepay.saldoAwal = parseFloat(saldoAwalData[24][0]) || 0;

  if (lastRow < MASTER_START) {
    applySaldo(summary);
    return ok({ summary: summary, masterTotals: masterTotals }, '', cb);
  }

  // ── Kategori yang menambah saldo untuk tiap metode ──────────────
  // Sumber: formula IF(OR(...)) di sub-tabel Aliran Dana spreadsheet
  // Note: spreadsheet pakai 'Pemasukkan' (double k) — kedua ejaan diterima
  var pemasukkanTrigger = {
    Cash:      { 'Tarik Cash': 1, 'Hutang (Masuk)': 1, 'Pemasukkan': 1, 'Pemasukan': 1 },
    Gopay:     { 'Topup Gopay': 1, 'Hutang (Masuk)': 1, 'Pemasukkan': 1, 'Pemasukan': 1 },
    Shopeepay: { 'Topup Shopeepay': 1, 'Hutang (Masuk)': 1, 'Pemasukkan': 1, 'Pemasukan': 1 },
    Mandiri:   { 'Pemasukkan': 1, 'Pemasukan': 1, 'Hutang (Masuk)': 1 },
  };

  // ── Baca F:L dari Tabel Master ──────────────────────────────────
  //    Indeks dalam array: F=0, G=1, H=2, I=3, J=4, K=5, L=6
  var data = sheet.getRange(MASTER_START, COL_F, lastRow, COL_L).getValues();

  for (var i = 0; i < data.length; i++) {
    var tanggal  = data[i][0];           // col F — pakai sebagai penjaga baris kosong
    if (!tanggal) continue;

    var kategori = data[i][2];           // col H
    var metode   = data[i][3];           // col I
    var colK     = parseFloat(data[i][5]) || 0;   // col K (Pemasukan)
    var colL     = parseFloat(data[i][6]) || 0;   // col L (Pengeluaran)

    // masterTotals: raw SUM(K) dan SUM(L) untuk angka "Semua" di REKAP
    masterTotals.pemasukan   += colK;
    masterTotals.pengeluaran += colL;

    if (!summary[metode]) continue;   // skip metode yang tidak dikenal

    var triggers  = pemasukkanTrigger[metode] || {};
    var inTrigger = !!(triggers[kategori]);

    // Pilihan kolom:
    //   Pemasukan-type → prefer K (salary/hutang masuk ada di K)
    //                    fallback ke L (Tarik Cash & Topup nilainya di L)
    //   Pengeluaran-type → selalu pakai L
    // Ini menghindari double-count pada baris yang punya nilai di KEDUA K dan L.
    var amount = inTrigger ? (colK || colL) : colL;
    if (!amount) continue;

    if (inTrigger) {
      summary[metode].pemasukan  += amount;
    } else {
      summary[metode].pengeluaran += amount;
    }
  }

  // ── Transfer internal → JUGA kurangi saldo Mandiri ─────────────
  // Sesuai formula di spreadsheet (baris "Total Top up E-Wallet & tarik cash"):
  //   =SUM( QUERY(W:AA tarik cash) + QUERY(AD:AH topup gopay) + QUERY(AK:AO topup shopeepay) )
  // Di sini kita derive langsung dari Tabel Master (bukan sub-tabel) sesuai permintaan.
  // Kategori ini tercatat dengan I = 'Cash'/'Gopay'/'Shopeepay' (bukan 'Mandiri'),
  // tapi secara ekonomi uangnya keluar dari Mandiri.
  var TRANSFER_CATS  = { 'Tarik Cash': 1, 'Topup Gopay': 1, 'Topup Shopeepay': 1 };
  var mandiriTransfer = 0;

  for (var j = 0; j < data.length; j++) {
    if (!data[j][0]) continue;                      // skip baris kosong
    var kat = data[j][2];                           // col H
    var met = data[j][3];                           // col I
    if (!TRANSFER_CATS[kat]) continue;              // bukan transfer internal
    if (met === 'Mandiri') continue;                // jangan double-count
    mandiriTransfer += (parseFloat(data[j][5]) || 0) + (parseFloat(data[j][6]) || 0);
  }

  summary.Mandiri.pengeluaran += mandiriTransfer;

  applySaldo(summary);

  // ── Debug log ───────────────────────────────────────────────────
  Logger.log('──────── getSummary (%s) ────────', sheetName);
  Logger.log('masterTotals → K=%s | L=%s', masterTotals.pemasukan, masterTotals.pengeluaran);
  Logger.log('mandiriTransfer (Tarik Cash + Topup) → +%s ke Mandiri pengeluaran', mandiriTransfer);
  var keys = Object.keys(summary);
  for (var k = 0; k < keys.length; k++) {
    var m = keys[k];
    Logger.log('  %s → masuk: %s | keluar: %s | saldo: %s',
      m, summary[m].pemasukan, summary[m].pengeluaran, summary[m].saldo);
  }
  Logger.log('────────────────────────────────');


  var payload = { summary: summary, masterTotals: masterTotals };
  if (includeDebug) {
    payload._debug = { sheet: sheetName, lastRow: lastRow, masterRows: data.length };
  }

  return ok(payload, '', cb);
}


// ================================================================
//  Handler: Get Recent Transactions
// ================================================================

function handleTransactions(limit, cb, monthIndex) {
  var sheet   = getSheetForMonth(monthIndex);
  var lastRow = sheet.getLastRow();
  if (lastRow < MASTER_START) return ok([], '', cb);

  var endRow = capLastRow(lastRow, MASTER_END);
  var raw = sheet.getRange(MASTER_START, COL_F, endRow, COL_L).getValues();

  var txns = [];
  for (var i = raw.length - 1; i >= 0 && txns.length < limit; i--) {
    var r = raw[i];
    if (!r[0]) continue;

    var tanggalRaw  = r[0];
    var keterangan  = r[1] || '';
    var kategori    = r[2] || '';
    var metode      = r[3] || '';
    var subKategori = r[4] || '';
    var pemasukan   = parseFloat(r[5]) || 0;
    var pengeluaran = parseFloat(r[6]) || 0;

    var tanggalStr = '';
    try {
      tanggalStr = Utilities.formatDate(new Date(tanggalRaw), 'Asia/Jakarta', 'dd/MM/yyyy');
    } catch(e) {
      tanggalStr = String(tanggalRaw);
    }

    txns.push({
      tanggal:     tanggalStr,
      keterangan:  keterangan,
      kategori:    kategori,
      metode:      metode,
      subKategori: subKategori,
      pemasukan:   pemasukan,
      pengeluaran: pengeluaran,
      tipe:        pemasukan > 0 ? 'pemasukan' : 'pengeluaran',
      nominal:     pemasukan > 0 ? pemasukan : pengeluaran,
    });
  }

  return ok(txns, '', cb);
}

// ================================================================
//  Handler: Budget per Sub-Kategori (A63:B)
// ================================================================

function readBudgetTable(sheet) {
  var endRow = BUDGET_START + BUDGET_ROWS - 1;
  return sheet.getRange(BUDGET_START, COL_BUDGET_CAT, endRow, COL_BUDGET_VAL).getValues();
}

function handleGetBudgets(cb, monthIndex) {
  var sheet = getSheetForMonth(monthIndex);
  var data  = readBudgetTable(sheet);
  var budgets = {};

  for (var i = 0; i < data.length; i++) {
    var cat = String(data[i][0] || '').trim();
    if (!cat) continue;
    var val = parseFloat(data[i][1]) || 0;
    if (val > 0) budgets[cat] = val;
  }

  Logger.log('getBudgets (%s) → %s kategori', sheet.getName(), Object.keys(budgets).length);
  return ok(budgets, '', cb);
}

function normalizeBudgetPayload(payload) {
  if (payload && payload.budgets) {
    return {
      budgets: payload.budgets || {},
      removed: payload.removed || [],
    };
  }
  return { budgets: payload || {}, removed: [] };
}

function handleSaveBudgets(payload, cb, monthIndex) {
  var parsed  = normalizeBudgetPayload(payload);
  var budgets = parsed.budgets;
  var removed = parsed.removed;
  var sheet   = getSheetForMonth(monthIndex);
  var data    = readBudgetTable(sheet);
  var catToRow = {};
  var hadBudget = [];
  var removedSet = {};
  var clearedSheetRows = [];

  for (var ri = 0; ri < removed.length; ri++) {
    removedSet[String(removed[ri] || '').trim()] = true;
  }

  for (var i = 0; i < data.length; i++) {
    var cat = String(data[i][0] || '').trim();
    if (cat) catToRow[cat] = i;
    hadBudget[i] = parseFloat(data[i][1]) || 0;
  }

  // Tulis / update nilai budget
  var keys = Object.keys(budgets || {});
  for (var k = 0; k < keys.length; k++) {
    var sub = keys[k];
    var val = parseFloat(budgets[sub]) || 0;
    if (val <= 0) continue;

    if (catToRow.hasOwnProperty(sub)) {
      data[catToRow[sub]][1] = val;
    } else {
      for (var j = 0; j < data.length; j++) {
        if (!String(data[j][0] || '').trim()) {
          data[j][0] = sub;
          data[j][1] = val;
          catToRow[sub] = j;
          break;
        }
      }
    }
  }

  // Budget dihapus dari app → clear kolom A dan B sekaligus
  for (var r = 0; r < data.length; r++) {
    var rowCat = String(data[r][0] || '').trim();
    if (!rowCat) continue;
    var saved = parseFloat((budgets || {})[rowCat]) || 0;
    var isRemoved = !!removedSet[rowCat];

    if (isRemoved || (saved <= 0 && hadBudget[r] > 0)) {
      data[r][0] = '';
      data[r][1] = '';
      clearedSheetRows.push(BUDGET_START + r);
    } else if (saved <= 0) {
      data[r][1] = '';
    }
  }

  var endRow = BUDGET_START + BUDGET_ROWS - 1;
  sheet.getRange(BUDGET_START, COL_BUDGET_CAT, endRow, COL_BUDGET_VAL).setValues(data);

  for (var c = 0; c < clearedSheetRows.length; c++) {
    sheet.getRange(clearedSheetRows[c], COL_BUDGET_CAT, clearedSheetRows[c], COL_BUDGET_VAL).clearContent();
  }

  Logger.log('saveBudgets (%s) → %s aktif, %s dihapus', sheet.getName(), keys.length, removed.length);
  return ok(budgets, 'Budget tersimpan ke spreadsheet!', cb);
}

// ================================================================
//  DIAGNOSTIC — Jalankan dari Apps Script Editor (bukan URL)
//  Cara: pilih fungsi ini di dropdown → klik ▶ Run
// ================================================================

function testWrite() {
  try {
    var sheet = getActiveSheet();
    Logger.log('✅ Sheet ditemukan: ' + sheet.getName());

    // Tulis data dummy ke baris berikutnya
    var today = new Date();
    var dateStr = Utilities.formatDate(today, 'Asia/Jakarta', 'dd/MM/yyyy');
    var row = findNextEmptyRow(sheet, MASTER_START, COL_F);

    Logger.log('📍 Akan menulis ke baris: ' + row);

    sheet.getRange(row, COL_F).setValue(dateStr);
    sheet.getRange(row, COL_G).setValue('TEST dari Apps Script');
    sheet.getRange(row, COL_H).setValue('Pengeluaran');
    sheet.getRange(row, COL_I).setValue('Cash');
    sheet.getRange(row, COL_J).setValue('Lain-lain');
    sheet.getRange(row, COL_K).setValue('');
    sheet.getRange(row, COL_L).setValue(999);

    Logger.log('✅ Berhasil nulis ke baris ' + row + '! Cek spreadsheet sekarang.');
    Logger.log('Jika berhasil, Apps Script sudah terhubung ke spreadsheet dengan benar.');
    Logger.log('Hapus baris test ini dari spreadsheet setelah dicek.');
  } catch(e) {
    Logger.log('❌ ERROR: ' + e.message);
  }
}

function testPing() {
  Logger.log('✅ Apps Script berjalan normal.');
  Logger.log('Sheet bulan ini: ' + MONTH_NAMES[new Date().getMonth()]);
  try {
    var sheet = getActiveSheet();
    Logger.log('✅ Sheet ditemukan: ' + sheet.getName() + ' (' + sheet.getLastRow() + ' baris)');
  } catch(e) {
    Logger.log('❌ Sheet error: ' + e.message);
    Logger.log('Pastikan nama sheet sesuai: JANUARI, FEBRUARI, dst.');
  }
}

function testSummaryLog() {
  handleSummary(null, true);
}

function testAddLog(){
  handleAdd()
}
