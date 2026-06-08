// Kategori Pengeluaran (Kolom H)
export const CATEGORIES = [
  { label: 'Pengeluaran', sheetLabel: 'Pengeluaran', tipe: 'pengeluaran', emoji: '💸', color: '#f87171' },
  // Spreadsheet pakai typo "Pemasukkan" di validasi kolom H
  { label: 'Pemasukan', sheetLabel: 'Pemasukkan', tipe: 'pemasukan', emoji: '💰', color: '#34d399' },
  { label: 'Hutang (Masuk)', sheetLabel: 'Hutang (Masuk)', tipe: 'pemasukan', emoji: '🤝', color: '#34d399' },
  { label: 'Hutang (Keluar)', sheetLabel: 'Hutang (Keluar)', tipe: 'pengeluaran', emoji: '🫱', color: '#f87171' },
  { label: 'Investasi/Nabung', sheetLabel: 'Investasi/Nabung', tipe: 'pengeluaran', emoji: '📈', color: '#a78bfa' },
  { label: 'Topup Gopay', sheetLabel: 'Topup Gopay', tipe: 'pengeluaran', emoji: '🟢', color: '#06b6d4', isTransfer: true },
  { label: 'Topup Shopeepay', sheetLabel: 'Topup Shopeepay', tipe: 'pengeluaran', emoji: '🟠', color: '#f97316', isTransfer: true },
  { label: 'Tarik Cash', sheetLabel: 'Tarik Cash', tipe: 'pengeluaran', emoji: '🏧', color: '#f59e0b', isTransfer: true },
]

export function toSheetCategory(label) {
  const cat = CATEGORIES.find(c => c.label === label)
  return cat?.sheetLabel || label
}

// Sub-Kategori (Kolom J)
export const SUB_CATEGORIES = [
  'Kebutuhan', 'Admin', 'Cangkruk', 'Nge-date', 'Jajan',
  'Fitness', 'Mobil', 'Motor', 'Gojek/dsb', 'Sakit', 'Impulsive', 'Investasi/Nabung', 'Lain-lain',
]

// Metode Payment (Kolom I)
export const METODE_LIST = ['Cash', 'Mandiri', 'Gopay', 'Shopeepay']

export const METODE_CONFIG = {
  Cash: { emoji: '💵', color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', bg: 'rgba(245,158,11,0.12)' },
  Mandiri: { emoji: '🏦', color: '#3b82f6', gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', bg: 'rgba(59,130,246,0.12)' },
  Gopay: { emoji: '🛵', color: '#06b6d4', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', bg: 'rgba(6,182,212,0.12)' },
  Shopeepay: { emoji: '🛍️', color: '#f97316', gradient: 'linear-gradient(135deg,#f97316,#ea580c)', bg: 'rgba(249,115,22,0.12)' },
}

// Nama tab sheet di spreadsheet (harus sama dengan MONTH_NAMES di Code.gs)
export const MONTH_SHEET_NAMES = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER',
]

export const MONTH_LABELS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function getMonthLabel(monthIndex, year = new Date().getFullYear()) {
  const idx = Math.max(0, Math.min(11, monthIndex))
  return `${MONTH_LABELS_ID[idx]} ${year}`
}

// Transfer internal — metode di master mengikuti dompet tujuan
export const TRANSFER_CATEGORIES = ['Topup Gopay', 'Topup Shopeepay', 'Tarik Cash']
export const TRANSFER_METODE = {
  'Topup Gopay': 'Gopay',
  'Topup Shopeepay': 'Shopeepay',
  'Tarik Cash': 'Cash',
}

export function getMetodeForCategory(categoryLabel, selectedMetode) {
  return TRANSFER_METODE[categoryLabel] || selectedMetode
}

export const formatRupiah = (num) => {
  const n = Number(num)
  if (!n && n !== 0) return 'Rp 0'
  return 'Rp\u00A0' + n.toLocaleString('id-ID')
}

export const formatDate = (d) => {
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${mon}/${d.getFullYear()}`
}

export const getDayLabel = () => {
  const now = new Date()
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
}
