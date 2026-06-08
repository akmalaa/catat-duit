import { useState, useEffect, useCallback } from 'react'
import BottomNav    from './components/BottomNav'
import QuickAdd     from './components/QuickAddSheet'
import Toast        from './components/Toast'
import Home         from './pages/Home'
import History      from './pages/History'
import Budgeting    from './pages/Budgeting'
import Settings     from './pages/Settings'
import { fetchDashboardData, fetchBudgets, saveBudgets, fetchRecentTransactions, getScriptUrl, submitTransaction } from './lib/api'
import {
  cacheSummary, getCachedSummary, isSummaryCacheFresh,
  cacheRemoteTransactions, getCachedRemoteTransactions, isRemoteTransactionsCacheFresh,
  getLocalTransactions, getQueue, dequeue,
  getSelectedMonth, saveSelectedMonth,
  getCachedSubBudgets, cacheSubBudgets, saveSubBudgets,
} from './lib/storage'

export default function App() {
  const [page,       setPage]       = useState('home')
  const [showAdd,    setShowAdd]    = useState(false)
  const [toast,      setToast]      = useState(null)
  const [summary,       setSummary]       = useState(null)
  const [masterTotals,  setMasterTotals]  = useState(null)
  const [txns,          setTxns]          = useState(() => getLocalTransactions())
  const [dataLoading,   setDataLoading]   = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState(getSelectedMonth)
  const [budgets, setBudgets] = useState(() => getCachedSubBudgets({ allowStale: true, monthIndex: getSelectedMonth() }) || {})
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [rollingTxns, setRollingTxns] = useState(() => getLocalTransactions())

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  const applySummaryData = useCallback((data, monthIndex) => {
    if (!data) return
    const bundle = data.summary
      ? data
      : data.Cash || data.Mandiri
        ? { summary: data, masterTotals: null }
        : null
    if (!bundle?.summary) return
    setSummary(bundle.summary)
    setMasterTotals(bundle.masterTotals ?? null)
    cacheSummary(bundle, monthIndex)
  }, [])

  const handleMonthChange = useCallback((monthIndex) => {
    setSelectedMonth(monthIndex)
    saveSelectedMonth(monthIndex)
  }, [])

  const loadBudgets = useCallback(async (monthIndex = selectedMonth) => {
    const cached = getCachedSubBudgets({ allowStale: true, monthIndex })
    if (cached) setBudgets(cached)
    else setBudgets({})

    if (!getScriptUrl()) return

    try {
      const remote = await fetchBudgets(monthIndex)
      if (remote && typeof remote === 'object') {
        setBudgets(remote)
        cacheSubBudgets(remote, monthIndex)
      }
    } catch { /* tampilkan cache */ }
  }, [selectedMonth])

  const applyRollingTxns = useCallback((curTxns, prevTxns) => {
    setRollingTxns([...(curTxns || []), ...(prevTxns || [])])
  }, [])

  /** Data minggu ini vs kemarin: bulan berjalan + bulan sebelumnya (bisa lintas bulan) */
  const ensureRollingData = useCallback(async (knownCurTxns = null) => {
    const curMonth = new Date().getMonth()
    const prevMonth = curMonth === 0 ? 11 : curMonth - 1

    let curTxns = knownCurTxns || getCachedRemoteTransactions({ allowStale: true, monthIndex: curMonth }) || []
    let prevTxns = getCachedRemoteTransactions({ allowStale: true, monthIndex: prevMonth }) || []

    if (curTxns.length || prevTxns.length) {
      applyRollingTxns(curTxns, prevTxns)
    }

    if (!getScriptUrl()) {
      setRollingTxns(getLocalTransactions())
      return
    }

    const needCur = !knownCurTxns && !isRemoteTransactionsCacheFresh(curMonth)
    const needPrev = !isRemoteTransactionsCacheFresh(prevMonth)
    if (!needCur && !needPrev) return

    try {
      const [fetchedCur, fetchedPrev] = await Promise.all([
        needCur ? fetchRecentTransactions(200, curMonth) : Promise.resolve(curTxns),
        needPrev ? fetchRecentTransactions(200, prevMonth) : Promise.resolve(prevTxns),
      ])
      if (needCur && Array.isArray(fetchedCur)) {
        curTxns = fetchedCur
        cacheRemoteTransactions(curTxns, curMonth)
      }
      if (needPrev && Array.isArray(fetchedPrev)) {
        prevTxns = fetchedPrev
        cacheRemoteTransactions(prevTxns, prevMonth)
      }
      applyRollingTxns(curTxns, prevTxns)
    } catch { /* tampilkan data cache / partial yang sudah ada */ }
  }, [applyRollingTxns])

  const loadRemoteData = useCallback(async ({ force = false } = {}) => {
    const curMonth = new Date().getMonth()
    const cachedSummary = getCachedSummary({ allowStale: true, monthIndex: selectedMonth })
    const cachedTxns = getCachedRemoteTransactions({ allowStale: true, monthIndex: selectedMonth })

    if (cachedSummary) applySummaryData(cachedSummary, selectedMonth)
    else { setSummary(null); setMasterTotals(null) }

    if (Array.isArray(cachedTxns)) setTxns(cachedTxns)
    else setTxns([])

    // Tampilkan perbandingan minggu dari cache secepat chart lain
    const rollingCurFromCache = selectedMonth === curMonth && Array.isArray(cachedTxns)
      ? cachedTxns
      : null
    await ensureRollingData(rollingCurFromCache)

    if (!getScriptUrl()) return

    const fresh = !force && isSummaryCacheFresh(selectedMonth) && isRemoteTransactionsCacheFresh(selectedMonth)
    if (fresh) return

    setDataLoading(true)
    try {
      const { summary: summaryData, transactions } = await fetchDashboardData(200, selectedMonth)
      if (summaryData) applySummaryData(summaryData, selectedMonth)
      if (Array.isArray(transactions)) {
        setTxns(transactions)
        cacheRemoteTransactions(transactions, selectedMonth)
        // Pakai ulang transaksi dashboard untuk bulan berjalan — hindari JSONP ganda
        await ensureRollingData(selectedMonth === curMonth ? transactions : null)
      }
    } catch { /* silent — tampilkan cache */ }
    finally { setDataLoading(false) }
  }, [applySummaryData, ensureRollingData, selectedMonth])

  const processQueue = useCallback(async () => {
    const q = getQueue()
    if (!q.length || !navigator.onLine || !getScriptUrl()) return
    let synced = 0
    for (const item of q) {
      try { await submitTransaction(item); dequeue(item._id); synced++ }
      catch { break }
    }
    if (synced > 0) {
      showToast(`☁️ ${synced} transaksi offline berhasil disync!`)
      setRefreshKey(k => k + 1)
    }
  }, [showToast])

  useEffect(() => { loadRemoteData() }, [loadRemoteData, refreshKey])
  useEffect(() => { loadBudgets(selectedMonth) }, [loadBudgets, selectedMonth, refreshKey])
  useEffect(() => {
    window.addEventListener('online', processQueue)
    return () => window.removeEventListener('online', processQueue)
  }, [processQueue])

  const onSaved = (isQueued = false) => {
    setShowAdd(false)
    setRefreshKey(k => k + 1)
    loadRemoteData({ force: true })
    showToast(isQueued ? '📥 Disimpan offline — akan sync otomatis' : '✅ Transaksi berhasil dicatat!')
  }

  const onError = (msg) => showToast(msg, 'error')

  const handleBudgetsChange = useCallback(async (next, monthIndex = selectedMonth, removed = []) => {
    setBudgets(next)
    saveSubBudgets(next, monthIndex)
    if (!getScriptUrl()) return

    setBudgetSaving(true)
    try {
      const saved = await saveBudgets(monthIndex, next, removed)
      setBudgets(saved)
      cacheSubBudgets(saved, monthIndex)
    } catch (e) {
      showToast('Budget lokal tersimpan, gagal sync ke spreadsheet', 'error')
      throw e
    } finally {
      setBudgetSaving(false)
    }
  }, [selectedMonth, showToast])

  const sharedPageProps = {
    summary,
    masterTotals,
    txns,
    dataLoading,
    selectedMonth,
    onMonthChange: handleMonthChange,
    budgets,
    budgetSaving,
    rollingTxns,
    onAdd: () => setShowAdd(true),
  }

  return (
    <div className="app">
      <div className={`page-scroll${page === 'history' ? ' hist-mode' : ''}`}>
        <div className="page-layer" hidden={page !== 'home'} aria-hidden={page !== 'home'}>
          <Home {...sharedPageProps} />
        </div>
        <div className="page-layer" hidden={page !== 'history'} aria-hidden={page !== 'history'}>
          <History {...sharedPageProps} />
        </div>
        <div className="page-layer" hidden={page !== 'budgeting'} aria-hidden={page !== 'budgeting'}>
          <Budgeting
            {...sharedPageProps}
            onBudgetsChange={handleBudgetsChange}
            onSaved={() => showToast('✅ Budget tersimpan ke spreadsheet!')}
            onError={onError}
          />
        </div>
        <div className="page-layer" hidden={page !== 'settings'} aria-hidden={page !== 'settings'}>
          <Settings onSaved={() => { showToast('✅ Tersimpan!'); loadRemoteData({ force: true }) }} />
        </div>
      </div>

      <BottomNav page={page} onNavigate={setPage} onAdd={() => setShowAdd(true)} />

      {showAdd && (
        <QuickAdd
          onClose={() => setShowAdd(false)}
          onSaved={onSaved}
          onError={onError}
        />
      )}

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
