import { TRANSFER_CATEGORIES, TRANSFER_METODE, hasSubKategori, formatDate } from './constants'

const TRANSFER_KEYWORDS = [
  // Livin menulis tarik tunai sebagai "Penarikan tunai tanpa kartu"
  { keywords: ['tarik cash', 'tarik tunai', 'penarikan tunai'], kategori: 'Tarik Cash' },
  { keywords: ['topup gopay', 'top-up gopay', 'top up gopay'], kategori: 'Topup Gopay' },
  { keywords: ['topup shopeepay', 'top-up shopeepay', 'top up shopeepay', 'topup shopee pay'], kategori: 'Topup Shopeepay' },
]

function detectTransferCategory(keteranganRaw) {
  const lower = keteranganRaw.toLowerCase()
  const hit = TRANSFER_KEYWORDS.find(t => t.keywords.some(k => lower.includes(k)))
  return hit && TRANSFER_CATEGORIES.includes(hit.kategori) ? hit.kategori : null
}

function firstLine(text) {
  return text.split(/\r?\n/)[0].trim()
}

// Nama bank tujuan transfer keluar — inline ("Transfer ke BANK MANDIRI")
// atau di baris tersendiri ("Ke BANK JAGO")
const TF_KE_INLINE = /^transfer\s+ke\s+(.+)$/i
const TF_KE_LINE = /^ke\s+(.+)$/i

// Nama bank asal transfer masuk — inline ("Transfer dari BANK MANDIRI")
// atau di baris tersendiri ("Dari BRI")
const TF_DARI_INLINE = /^transfer\s+dari\s+(.+)$/i
const TF_DARI_LINE = /^dari\s+(.+)$/i

// "NADA SEPTIANDI 1230013095965" → nama + no. rekening
const NAMA_NOREK = /^(.*?)\s+(\d{6,})$/

// "Transfer antar Mandiri" strukturnya beda: baris setelah pengirim berisi
// keterangan/no. referensi, bukan nama+norek — pakai format lama (pengirim + keterangan)
const TF_ANTAR_MANDIRI = /^transfer\s+antar\s+mandiri/i

/** Susun transfer masuk jadi "TF MASUK DARI <nama> <bank> <norek>" */
function formatTransferMasuk(bank, detail) {
  const b = bank.trim()
  const d = (detail || '').trim()
  // "Bank lain" tidak menyebut bank asli — nama banknya ada di baris detail
  if (/^bank\s+lain$/i.test(b)) return `TF MASUK DARI ${d}`
  const m = d.match(NAMA_NOREK)
  if (m) return `TF MASUK DARI ${m[1]} ${b} ${m[2]}`
  return `TF MASUK DARI ${d} ${b}`.trim()
}

// Baris "Biaya transaksi bank" (dan biaya bank lainnya) = potongan admin,
// bukan belanja — sub-kategorinya Admin, bukan Lain-lain.
const ADMIN_FEE = /^biaya\b/i

function isAdminFee(raw) {
  return ADMIN_FEE.test(firstLine(raw))
}

/**
 * Ubah keteranganRaw multi-baris dari statement jadi satu baris yang lebih berguna:
 *
 * - Biaya transaksi bank (admin):
 *     "Biaya transaksi bank\nPembayaran Shopee Indonesia\n896081803276947"
 *       →  "Admin - Shopee Indonesia 896081803276947"  (sub-kategori: Admin)
 * - Pembayaran QR:
 *     "Pembayaran QR\nke ALGO SIDOARJO - QRIS"  →  "QR - ALGO SIDOARJO - QRIS"
 * - Pembayaran merchant / e-wallet (kata "Pembayaran" dibuang):
 *     "Pembayaran Shopee Indonesia\n896081803276947"  →  "Shopee Indonesia 896081803276947"
 *     "Pembayaran ShopeePay\n893081803276947"         →  "ShopeePay 893081803276947"
 * - Transfer keluar (nama bank di baris "Transfer ke ..." atau di baris "Ke ..."):
 *     "Transfer ke BANK MANDIRI\nFLIPTECH LENTERA INS 1570006217393"
 *       →  "TF BANK MANDIRI - FLIPTECH LENTERA INS 1570006217393"
 *     "Transfer BI Fast\nKe BANK JAGO\nAKMAL ALIFFANDHI ANW 109708128511"
 *       →  "TF BANK JAGO - AKMAL ALIFFANDHI ANW 109708128511"
 *   (jenis transfer — "BI Fast", "antar Mandiri", dst — dibuang)
 * - Transfer masuk — disusun jadi "TF MASUK DARI <nama> <bank> <norek>":
 *     "Transfer dari BANK MANDIRI\nNADA SEPTIANDI 1230013095965"
 *       →  "TF MASUK DARI NADA SEPTIANDI BANK MANDIRI 1230013095965"
 *     "Transfer BI Fast\nDari BRI\nDERRIK JATMIKO ARDI 344301001309507"
 *       →  "TF MASUK DARI DERRIK JATMIKO ARDI BRI 344301001309507"
 *   Kecuali "Transfer antar Mandiri" (gaji) — baris ketiganya keterangan, bukan
 *   nama+norek, jadi tetap "<pengirim> <keterangan>":
 *     "Transfer antar Mandiri\nDARI PERKEBUNAN NUSANTARA IV\nGaji Juli 2026 ...\nTransfer Fee ..."
 *       →  "PERKEBUNAN NUSANTARA IV Gaji Juli 2026 ..."
 * - Pengkreditan otomatis (gaji magang) — baris pertama dibuang:
 *     "Pengkreditan otomatis\nPEMAGANGAN BATCH 2 BULAN 6"  →  "PEMAGANGAN BATCH 2 BULAN 6"
 * - Pengembalian dana e-money — no. kartu ikut dibawa:
 *     "Pengembalian Dana e-money\n6032982898019300"  →  "Pengembalian Dana e-money 6032982898019300"
 *
 * Selain pola-pola itu, fallback ke baris pertama (mis. "Top-up e-money",
 * "Biaya administrasi rekening", "Penarikan tunai tanpa kartu").
 */
function extractKeterangan(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return ''

  if (ADMIN_FEE.test(lines[0])) {
    const detail = lines.slice(1).join(' ').replace(/^pembayaran\s+/i, '').trim()
    return detail ? `Admin - ${detail}` : lines[0]
  }

  if (/pembayaran\s+qr/i.test(lines[0])) {
    const keLine = lines.find(l => /^ke\s+/i.test(l))
    if (keLine) return `QR - ${keLine.replace(/^ke\s+/i, '').trim()}`
  }

  if (/^pembayaran\s+/i.test(lines[0])) {
    return lines.join(' ').replace(/^pembayaran\s+/i, '').trim()
  }

  if (/^transfer\b/i.test(lines[0])) {
    const inline = lines[0].match(TF_KE_INLINE)
    const keIdx = inline ? 0 : lines.findIndex(l => TF_KE_LINE.test(l))
    if (keIdx !== -1) {
      const bank = (inline ? inline[1] : lines[keIdx].match(TF_KE_LINE)[1]).trim()
      const detail = lines[keIdx + 1] || ''
      return detail ? `TF ${bank} - ${detail}` : `TF ${bank}`
    }
  }

  const dariInline = lines[0].match(TF_DARI_INLINE)
  const dariIdx = dariInline ? 0 : lines.findIndex(l => TF_DARI_LINE.test(l))
  if (dariIdx !== -1) {
    const bank = (dariInline ? dariInline[1] : lines[dariIdx].match(TF_DARI_LINE)[1]).trim()
    const detail = lines[dariIdx + 1] || ''
    return TF_ANTAR_MANDIRI.test(lines[0])
      ? [bank, detail].filter(Boolean).join(' ')
      : formatTransferMasuk(bank, detail)
  }

  if (/^pengkreditan\s+otomatis/i.test(lines[0]) && lines[1]) {
    return lines[1]
  }

  if (/^pengembalian\s+dana\s+e-money/i.test(lines[0]) && lines[1]) {
    return `${lines[0]} ${lines[1]}`
  }

  return firstLine(raw)
}

/** "16:38:20 WIB" → "16:38" (detik & zona dibuang, cukup jam-menit di UI) */
function formatJam(raw) {
  const m = String(raw || '').match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''
}

/** @returns transaksi siap kirim, se-struktur payload submitTransaction */
export function mapRowToTransaction(row) {
  const tipe = row.danaMasuk > 0 ? 'pemasukan' : 'pengeluaran'
  const nominal = row.danaMasuk > 0 ? row.danaMasuk : row.danaKeluar

  const transferKategori = detectTransferCategory(row.keteranganRaw)
  const kategori = transferKategori || (tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')
  const metode = TRANSFER_METODE[kategori] || 'Mandiri'

  const tanggalDate = new Date(row.tanggalRaw)
  const tanggal = isNaN(tanggalDate.getTime()) ? row.tanggalRaw : formatDate(tanggalDate)

  return {
    tanggal,
    keterangan: extractKeterangan(row.keteranganRaw) || kategori,
    kategori,
    metode,
    // Pemasukan & transfer internal tidak punya sub-kategori;
    // biaya admin bank ditandai sub-kategori Admin
    subKategori: hasSubKategori(kategori)
      ? (isAdminFee(row.keteranganRaw) ? 'Admin' : 'Lain-lain')
      : null,
    tipe,
    nominal,
    // Jam transaksi — tampilan review saja, tidak ikut dikirim ke spreadsheet.
    // Dipisah dari _raw supaya tetap ada setelah draft di-restore (lihat stripRaw).
    _jam: formatJam(row.jam),
    _raw: row,
  }
}

export function mapStatementRows(rows) {
  return rows.map(mapRowToTransaction)
}
