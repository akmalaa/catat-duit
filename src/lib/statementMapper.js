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
    keterangan: firstLine(row.keteranganRaw) || kategori,
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
