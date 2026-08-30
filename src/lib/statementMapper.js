import { TRANSFER_CATEGORIES, TRANSFER_METODE, formatDate } from './constants'

const TRANSFER_KEYWORDS = [
  { keywords: ['tarik cash', 'tarik tunai'], kategori: 'Tarik Cash' },
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

/**
 * Ubah keteranganRaw multi-baris dari statement jadi satu baris yang lebih berguna:
 *
 * - Pembayaran QR:
 *     "Pembayaran QR\nke ALGO SIDOARJO - QRIS"  →  "QR - ALGO SIDOARJO - QRIS"
 * - Transfer masuk (format "Transfer .../DARI <pengirim>\n<baris berikutnya>"):
 *     "Transfer antar Mandiri\nDARI PERKEBUNAN NUSANTARA IV\nGaji Juli 2026 ...\nTransfer Fee ..."
 *       →  "PERKEBUNAN NUSANTARA IV Gaji Juli 2026 ..."
 *     "Transfer BI Fast\nDari BRI\nDERRIK JATMIKO ARDI ..."
 *       →  "BRI DERRIK JATMIKO ARDI ..."
 *   (baris pertama "Transfer ..." dan baris setelah baris-kedua diabaikan)
 *
 * Selain dua pola itu, fallback ke baris pertama seperti sebelumnya.
 */
function extractKeterangan(raw) {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return ''

  if (/pembayaran\s+qr/i.test(lines[0])) {
    const keLine = lines.find(l => /^ke\s+/i.test(l))
    if (keLine) return `QR - ${keLine.replace(/^ke\s+/i, '').trim()}`
  }

  const dariIdx = lines.findIndex(l => /^dari\s+/i.test(l))
  if (dariIdx !== -1) {
    const afterDari = lines[dariIdx].replace(/^dari\s+/i, '').trim()
    const nextLine = lines[dariIdx + 1] || ''
    return [afterDari, nextLine].filter(Boolean).join(' ')
  }

  return firstLine(raw)
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
    // Pemasukan tidak punya sub-kategori
    subKategori: kategori === 'Pemasukan' ? null : 'Lain-lain',
    tipe,
    nominal,
    _raw: row,
  }
}

export function mapStatementRows(rows) {
  return rows.map(mapRowToTransaction)
}
