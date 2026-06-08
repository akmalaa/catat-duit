const SETTINGS_KEY = 'cd_settings'

export const AUTH_WALL_ERROR =
  'Web App butuh login Google (setting "Only myself" atau "Anyone with Google account"). ' +
  'CatatDuit tidak bisa kirim sesi login lewat request ini. ' +
  'Ubah Who has access → "Anyone" — URL panjang itu sudah seperti password rahasia; Execute as tetap "Me".'

export function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
}
export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function getScriptUrl() {
  const fromSettings = getSettings().scriptUrl?.trim()
  if (fromSettings) return fromSettings
  // Hanya dev lokal — production/hosting: isi URL di Pengaturan app
  if (import.meta.env.DEV && import.meta.env.VITE_DEFAULT_SCRIPT_URL) {
    return import.meta.env.VITE_DEFAULT_SCRIPT_URL
  }
  return ''
}

const LOAD_ERROR =
  'Gagal load script. Penyebab umum: (1) Who has access = "Only myself" — ubah ke "Anyone", ' +
  '(2) URL salah, (3) tidak ada internet. Execute as tetap boleh "Me".'

const DEPLOY_CHECK_MS = 10 * 60 * 1000
let deploymentOkUntil = 0
const inflight = new Map()

async function assertPublicDeployment(url) {
  if (Date.now() < deploymentOkUntil) return
  try {
    const res = await fetch(`${url}?action=ping`, { method: 'GET', redirect: 'manual' })
    if (res.status !== 302 && res.status !== 301 && res.status !== 303) {
      deploymentOkUntil = Date.now() + DEPLOY_CHECK_MS
      return
    }
    const loc = res.headers.get('Location') || ''
    if (loc.includes('accounts.google.com') || loc.includes('ServiceLogin')) {
      throw new Error(AUTH_WALL_ERROR)
    }
    deploymentOkUntil = Date.now() + DEPLOY_CHECK_MS
  } catch (e) {
    if (e.message === AUTH_WALL_ERROR) throw e
  }
}

function jsonp(url, params, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const cbName = 'cd_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    const script = document.createElement('script')

    const cleanup = () => {
      delete window[cbName]
      script.parentNode?.removeChild(script)
    }

    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(
        'Timeout — server tidak merespons. ' +
        'Pastikan Apps Script di-deploy ulang dengan akses "Anyone".',
      ))
    }, timeoutMs)

    window[cbName] = (data) => {
      clearTimeout(timer)
      cleanup()
      if (data && data.success) resolve(data)
      else reject(new Error(data?.message || 'Server error'))
    }

    script.onerror = () => {
      clearTimeout(timer)
      cleanup()
      reject(new Error(LOAD_ERROR))
    }

    const qs = new URLSearchParams({ ...params, callback: cbName }).toString()
    script.src = `${url}?${qs}`
    document.head.appendChild(script)
  })
}

async function callScript(params, url) {
  const scriptUrl = url || getScriptUrl()
  if (!scriptUrl) throw new Error('Script URL belum dikonfigurasi. Buka Pengaturan ⚙️')

  const inflightKey = scriptUrl + '|' + JSON.stringify(params)
  if (inflight.has(inflightKey)) return inflight.get(inflightKey)

  const task = (async () => {
    await assertPublicDeployment(scriptUrl)
    return jsonp(scriptUrl, params)
  })()

  inflight.set(inflightKey, task)
  try {
    return await task
  } finally {
    inflight.delete(inflightKey)
  }
}

export async function submitTransaction(tx) {
  return callScript({ action: 'addTransaction', data: JSON.stringify(tx) })
}

export async function fetchSummary(monthIndex) {
  const res = await callScript({ action: 'getSummary', month: monthIndex })
  return res.data
}

export async function fetchRecentTransactions(limit = 30, monthIndex) {
  const res = await callScript({ action: 'getTransactions', limit, month: monthIndex })
  return res.data
}

/** Summary + transaksi paralel (1x preflight, 2x JSONP) */
export async function fetchBudgets(monthIndex) {
  const res = await callScript({ action: 'getBudgets', month: monthIndex })
  return res.data || {}
}

export async function saveBudgets(monthIndex, budgets, removed = []) {
  const res = await callScript({
    action: 'saveBudgets',
    month: monthIndex,
    data: JSON.stringify({ budgets, removed }),
  })
  return res.data || budgets
}

export async function fetchDashboardData(txnLimit = 200, monthIndex) {
  const scriptUrl = getScriptUrl()
  if (!scriptUrl) throw new Error('Script URL belum dikonfigurasi. Buka Pengaturan ⚙️')

  const month = monthIndex ?? new Date().getMonth()
  const inflightKey = scriptUrl + '|dashboard|' + txnLimit + '|' + month
  if (inflight.has(inflightKey)) return inflight.get(inflightKey)

  const task = (async () => {
    await assertPublicDeployment(scriptUrl)
    const [summaryRes, txnsRes] = await Promise.all([
      jsonp(scriptUrl, { action: 'getSummary', month }),
      jsonp(scriptUrl, { action: 'getTransactions', limit: txnLimit, month }),
    ])
    return {
      summary: summaryRes.data,
      transactions: txnsRes.data,
    }
  })()

  inflight.set(inflightKey, task)
  try {
    return await task
  } finally {
    inflight.delete(inflightKey)
  }
}

export async function testConnection(scriptUrl) {
  deploymentOkUntil = 0
  const res = await callScript({ action: 'ping' }, scriptUrl)
  return res.success === true
}
