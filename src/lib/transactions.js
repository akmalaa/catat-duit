const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des']

export function parseTanggal(str) {
  if (!str) return null
  const parts = String(str).split('/')
  if (parts.length !== 3) return null
  const d = Number(parts[0])
  const m = Number(parts[1])
  const y = Number(parts[2])
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

export function getExpenseAmount(tx) {
  if (tx.tipe === 'pemasukan' || Number(tx.pemasukan) > 0) return 0
  return Number(tx.pengeluaran || tx.nominal || 0)
}

export function isExpense(tx) {
  return getExpenseAmount(tx) > 0
}

export function formatDayLabel(dateObj) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateObj)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Hari Ini'
  if (diff === 1) return 'Kemarin'
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function groupTransactionsByDay(txns) {
  const groups = new Map()
  for (const tx of txns) {
    const key = tx.tanggal || 'Tanpa tanggal'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(tx)
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const da = parseTanggal(a[0])
      const db = parseTanggal(b[0])
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return db - da
    })
    .map(([dateKey, items]) => {
      const parsed = parseTanggal(dateKey)
      return {
        dateKey,
        label: parsed ? formatDayLabel(parsed) : dateKey,
        items,
      }
    })
}

export function getTopExpenses(txns, { limit = 20, metode = 'All', subKategori = 'All' } = {}) {
  return txns
    .filter(isExpense)
    .filter(t => metode === 'All' || t.metode === metode)
    .filter(t => subKategori === 'All' || t.subKategori === subKategori)
    .sort((a, b) => getExpenseAmount(b) - getExpenseAmount(a))
    .slice(0, limit)
}

export function getWeekOfMonth(date) {
  return Math.min(Math.ceil(date.getDate() / 7), 5)
}

function weekRangeLabel(week, daysInMonth) {
  const start = (week - 1) * 7 + 1
  const end = Math.min(week * 7, daysInMonth)
  return `${start}–${end}`
}

export function getWeeklyExpenses(txns, monthIndex, year = new Date().getFullYear(), metode = 'All') {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const weeks = Array.from({ length: 5 }, (_, i) => {
    const week = i + 1
    return {
      week,
      label: `M${week}`,
      range: weekRangeLabel(week, daysInMonth),
      amount: 0,
    }
  })

  for (const tx of txns) {
    if (!isExpense(tx)) continue
    if (metode !== 'All' && tx.metode !== metode) continue
    const d = parseTanggal(tx.tanggal)
    if (!d || d.getMonth() !== monthIndex || d.getFullYear() !== year) continue
    weeks[getWeekOfMonth(d) - 1].amount += getExpenseAmount(tx)
  }

  const total = weeks.reduce((sum, w) => sum + w.amount, 0)
  const max = Math.max(...weeks.map(w => w.amount), 1)

  return {
    weeks: weeks.map(w => ({
      ...w,
      pct: total > 0 ? (w.amount / total) * 100 : 0,
      barPct: (w.amount / max) * 100,
    })),
    total,
    max,
  }
}

export function getAllSubSpending(txns, monthIndex, year = new Date().getFullYear()) {
  const map = {}
  for (const tx of txns) {
    if (!isExpense(tx)) continue
    const d = parseTanggal(tx.tanggal)
    if (!d || d.getMonth() !== monthIndex || d.getFullYear() !== year) continue
    const sub = tx.subKategori || 'Lain-lain'
    map[sub] = (map[sub] || 0) + getExpenseAmount(tx)
  }
  return map
}

function dayStart(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Senin awal minggu kalender (ISO-style, Senin = hari pertama) */
function getWeekStartMonday(date) {
  const d = dayStart(date)
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d
}

function getWeekEndSunday(weekStartMonday) {
  const d = new Date(weekStartMonday)
  d.setDate(d.getDate() + 6)
  return d
}

function formatWeekRange(start, end) {
  const sDay = start.getDate()
  const eDay = end.getDate()
  const sMon = MONTH_SHORT[start.getMonth()]
  const eMon = MONTH_SHORT[end.getMonth()]
  if (start.getMonth() === end.getMonth()) {
    return `${sDay}–${eDay} ${sMon}`
  }
  return `${sDay} ${sMon} – ${eDay} ${eMon}`
}

export function getRollingWeekComparison(txns, metode = 'All', refDate = new Date()) {
  const thisWeekStart = getWeekStartMonday(refDate)
  const thisWeekEnd = getWeekEndSunday(thisWeekStart)

  const prevWeekStart = new Date(thisWeekStart)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekEnd = getWeekEndSunday(prevWeekStart)

  let recentTotal = 0
  let prevTotal = 0

  for (const tx of txns) {
    if (!isExpense(tx)) continue
    if (metode !== 'All' && tx.metode !== metode) continue
    const d = parseTanggal(tx.tanggal)
    if (!d) continue
    const day = dayStart(d)
    const amt = getExpenseAmount(tx)

    if (day >= thisWeekStart && day <= thisWeekEnd) recentTotal += amt
    else if (day >= prevWeekStart && day <= prevWeekEnd) prevTotal += amt
  }

  let changePct = null
  if (prevTotal > 0) {
    changePct = ((recentTotal - prevTotal) / prevTotal) * 100
  } else if (recentTotal > 0) {
    changePct = 100
  }

  let direction = 'flat'
  if (recentTotal > prevTotal) direction = 'up'
  else if (recentTotal < prevTotal) direction = 'down'

  return {
    recentTotal,
    prevTotal,
    changePct,
    direction,
    recentLabel: 'Minggu ini',
    prevLabel: 'Minggu kemarin',
    recentRange: formatWeekRange(thisWeekStart, thisWeekEnd),
    prevRange: formatWeekRange(prevWeekStart, prevWeekEnd),
  }
}

export function getBudgetProgressItems(spending, budgets) {
  return Object.entries(budgets)
    .filter(([, limit]) => Number(limit) > 0)
    .map(([sub, limit]) => {
      const limitNum = Number(limit)
      const spent = spending[sub] || 0
      const pct = limitNum > 0 ? (spent / limitNum) * 100 : 0
      return { sub, spent, limit: limitNum, pct, over: spent > limitNum }
    })
    .sort((a, b) => b.pct - a.pct)
}
