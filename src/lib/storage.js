// Offline queue & local caching using localStorage
// (Simple & dependency-free; suitable for personal use with ~100 txns/month)

const KEYS = {
  local:   'cd_local_txns',
  queue:   'cd_queue',
  summary: 'cd_summary_cache',
  remote:  'cd_remote_txns_cache',
  month:   'cd_selected_month',
  budgets: 'cd_sub_budgets',
}

function monthKey(base, monthIndex) {
  return `${base}_${monthIndex ?? new Date().getMonth()}`
}

export const DATA_CACHE_TTL = 5 * 60 * 1000 // 5 menit

function readCache(key, allowStale = false) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, at } = JSON.parse(raw)
    if (!allowStale && Date.now() - at > DATA_CACHE_TTL) return null
    return data
  } catch { return null }
}

function writeCache(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }))
}

// ── Local Transactions (history for offline view) ─────────
export function saveLocalTransaction(tx) {
  const list    = getLocalTransactions()
  const updated = [{ ...tx, _at: Date.now() }, ...list].slice(0, 150)
  localStorage.setItem(KEYS.local, JSON.stringify(updated))
}

export function getLocalTransactions() {
  try { return JSON.parse(localStorage.getItem(KEYS.local) || '[]') } catch { return [] }
}

// ── Offline Queue ─────────────────────────────────────────
export function enqueue(tx) {
  const q = getQueue()
  q.push({ ...tx, _id: Date.now(), _queued: Date.now() })
  localStorage.setItem(KEYS.queue, JSON.stringify(q))
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(KEYS.queue) || '[]') } catch { return [] }
}

export function dequeue(id) {
  const q = getQueue().filter(i => i._id !== id)
  localStorage.setItem(KEYS.queue, JSON.stringify(q))
}

export function clearQueue() {
  localStorage.removeItem(KEYS.queue)
}

// ── Selected month (0–11) ─────────────────────────────────
export function getSelectedMonth() {
  try {
    const v = localStorage.getItem(KEYS.month)
    if (v === null) return new Date().getMonth()
    const n = parseInt(v, 10)
    return Number.isNaN(n) || n < 0 || n > 11 ? new Date().getMonth() : n
  } catch {
    return new Date().getMonth()
  }
}

export function saveSelectedMonth(monthIndex) {
  localStorage.setItem(KEYS.month, String(monthIndex))
}

// ── Summary cache ─────────────────────────────────────────
export function cacheSummary(data, monthIndex) {
  writeCache(monthKey(KEYS.summary, monthIndex), data)
}

export function getCachedSummary({ allowStale = false, monthIndex } = {}) {
  return readCache(monthKey(KEYS.summary, monthIndex), allowStale)
}

export function isSummaryCacheFresh(monthIndex) {
  return getCachedSummary({ monthIndex }) !== null
}

// ── Remote transactions cache (dari Apps Script) ──────────
export function cacheRemoteTransactions(txns, monthIndex) {
  writeCache(monthKey(KEYS.remote, monthIndex), txns)
}

export function getCachedRemoteTransactions({ allowStale = false, monthIndex } = {}) {
  return readCache(monthKey(KEYS.remote, monthIndex), allowStale)
}

export function isRemoteTransactionsCacheFresh(monthIndex) {
  return getCachedRemoteTransactions({ monthIndex }) !== null
}

// ── Sub-kategori budgets per bulan (cache lokal) ────────────
export function cacheSubBudgets(budgets, monthIndex) {
  writeCache(monthKey(KEYS.budgets, monthIndex), budgets)
}

export function getCachedSubBudgets({ allowStale = false, monthIndex } = {}) {
  const cached = readCache(monthKey(KEYS.budgets, monthIndex), allowStale)
  if (cached) return cached
  // migrasi cache global lama (format: { Jajan: 500000 })
  try {
    const raw = localStorage.getItem(KEYS.budgets)
    if (!raw) return null
    const legacy = JSON.parse(raw)
    if (legacy?.data !== undefined && legacy?.at !== undefined) return null
    if (legacy && typeof legacy === 'object') return legacy
  } catch { /* ignore */ }
  return null
}

export function getSubBudgets(monthIndex = new Date().getMonth()) {
  return getCachedSubBudgets({ allowStale: true, monthIndex }) || {}
}

export function saveSubBudgets(budgets, monthIndex) {
  cacheSubBudgets(budgets, monthIndex)
}
