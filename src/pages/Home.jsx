import { useEffect, useMemo, useState } from 'react'
import { METODE_LIST, METODE_CONFIG, SUB_CATEGORIES, formatRupiah, getDayLabel, getMonthLabel } from '../lib/constants'
import MonthPicker from '../components/MonthPicker'
import { getScriptUrl } from '../lib/api'
import { getQueue } from '../lib/storage'
import { getTopExpenses, getExpenseAmount, getWeeklyExpenses, getWeekOfMonth, getRollingWeekComparison } from '../lib/transactions'
import WeeklyComparison from '../components/WeeklyComparison'
import ThemeToggle from '../components/ThemeToggle'
import { MethodIcon, GearSix, CloudArrowUp, Receipt, ChartBar } from '../components/icons'

// ── Spending by sub-kategori (dari transaksi lokal) ─────────────
function getSpendingBySubKat(txns, metode = 'All') {
  const map = {}
  for (const tx of txns) {
    if (getExpenseAmount(tx) === 0) continue
    if (metode !== 'All' && tx.metode !== metode) continue
    const sub = tx.subKategori || 'Lain-lain'
    map[sub] = (map[sub] || 0) + getExpenseAmount(tx)
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
}

// ── Weekly spending chart ───────────────────────────────────────
function WeeklyChart({ data, currentWeek }) {
  const { weeks, total } = data
  if (!total) {
    return (
      <div className="weekly-empty">
        <ChartBar size={26} weight="light" aria-hidden="true" />
        <span>Belum ada pengeluaran minggu ini</span>
      </div>
    )
  }

  return (
    <div className="weekly-chart">
      <div className="weekly-bars" role="img" aria-label={`Grafik pengeluaran mingguan, total ${formatRupiah(total)}`}>
        {weeks.map((w) => {
          const isActive = currentWeek === w.week
          return (
            <div key={w.week} className={`weekly-col ${isActive ? 'is-current' : ''}`}>
              <div className="weekly-col-amt">{w.amount > 0 ? formatRupiah(w.amount) : '—'}</div>
              <div className="weekly-col-track">
                <div className="weekly-col-fill" style={{ height: `${w.barPct}%` }} />
              </div>
              <div className="weekly-col-label">{w.label}</div>
              <div className="weekly-col-range">{w.range}</div>
              {w.pct > 0 && (
                <div className="weekly-col-pct">{Math.round(w.pct)}%</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Sub-kategori chart (CSS horizontal bars) ────────────────────
const SUBKAT_COLORS = ['#2563eb', '#f59e0b', '#8b5cf6', '#10b981', '#f87171', '#94a3b8']

function SubKatChart({ data }) {
  if (!data.length) return null
  const max = data[0][1]
  return (
    <div className="subkat-chart">
      {data.map(([sub, amt], i) => (
        <div key={sub} className="subkat-row">
          <div className="subkat-label">{sub}</div>
          <div className="subkat-bar-wrap">
            <div
              className="subkat-bar-fill"
              style={{ width: `${(amt / max) * 100}%`, background: SUBKAT_COLORS[i % SUBKAT_COLORS.length] }}
            />
          </div>
          <div className="subkat-amt">{formatRupiah(amt)}</div>
        </div>
      ))}
    </div>
  )
}

// ── Balance Card ─────────────────────────────────────────────────
function BalanceCard({ metode, data }) {
  const cfg = METODE_CONFIG[metode]
  const in_ = data?.pemasukan || 0
  const out = data?.pengeluaran || 0
  const net = in_ - out
  const awal = data?.saldoAwal || 0
  const akhir = awal + net

  return (
    <div className="bal-card">
      <div className="bal-header">
        <span className="bal-icon" style={{ background: cfg.bg, color: cfg.color }}>
          <MethodIcon metode={metode} size={15} />
        </span>
        <span className="bal-name">{metode}</span>
      </div>
      <div className="bal-saldo">
        {formatRupiah(akhir)}
      </div>
      <div className={`bal-net ${net < 0 ? 'is-rugi' : 'is-untung'}`}>
        {net < 0 ? '− ' : '+ '}{formatRupiah(Math.abs(net))}
      </div>

      <div className="bal-detail">
        <span className="bal-in">↑ {formatRupiah(in_)}</span>
        <span className="bal-out">↓ {formatRupiah(out)}</span>
      </div>
    </div>
  )
}

// ── Baris pengeluaran teratas (khusus Beranda) ───────────────────
function ExpenseRow({ tx, rank }) {
  const cfg = METODE_CONFIG[tx.metode] || METODE_CONFIG.Cash
  const amount = Number(tx.pengeluaran || tx.nominal || 0)

  return (
    <div className="exp-row">
      <div className="exp-rank" aria-hidden="true">{rank}</div>
      <div className="exp-icon" style={{ background: cfg.bg, color: cfg.color }}>
        <MethodIcon metode={tx.metode} size={17} />
      </div>
      <div className="exp-body">
        <div className="exp-name">{tx.keterangan || tx.kategori}</div>
        <div className="exp-meta">
          <span className="exp-tag">{tx.kategori}</span>
          {tx.subKategori && tx.subKategori !== 'All' && (
            <>
              <span className="exp-dot">·</span>
              <span className="exp-sub">{tx.subKategori}</span>
            </>
          )}
          <span className="exp-dot">·</span>
          <span className="exp-date">{tx.tanggal}</span>
        </div>
      </div>
      <div className="exp-amount">−{formatRupiah(amount)}</div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function Home({ summary, masterTotals, txns = [], rollingTxns = [], dataLoading, selectedMonth, onMonthChange, onAdd }) {
  const [queueCount, setQueueCount] = useState(0)
  const [filterMetode, setFilterMetode] = useState('All')
  const [filterSub, setFilterSub] = useState('All')
  const [topLimit, setTopLimit] = useState(5)

  useEffect(() => {
    setQueueCount(getQueue().length)
  }, [txns])

  const topExpenses = useMemo(
    () => getTopExpenses(txns, { limit: topLimit === 'All' ? 999 : topLimit, metode: filterMetode, subKategori: filterSub }),
    [txns, filterMetode, filterSub, topLimit],
  )
  const spendingBySubKat = useMemo(
    () => getSpendingBySubKat(txns, filterMetode),
    [txns, filterMetode],
  )
  const weeklyExpenses = useMemo(
    () => getWeeklyExpenses(txns, selectedMonth, new Date().getFullYear(), filterMetode),
    [txns, selectedMonth, filterMetode],
  )
  const weekComparison = useMemo(
    () => getRollingWeekComparison(rollingTxns, filterMetode),
    [rollingTxns, filterMetode],
  )

  const isCurrentMonth = selectedMonth === new Date().getMonth()
  const currentWeek = isCurrentMonth ? getWeekOfMonth(new Date()) : null
  const monthLabel = getMonthLabel(selectedMonth)
  const totalIn = masterTotals?.pemasukan ?? null
  const totalOut = masterTotals?.pengeluaran ?? null
  const netTotal = (totalIn !== null && totalOut !== null) ? totalIn - totalOut : null
  const awalTotal = masterTotals?.saldoAwal ?? null
  const akhirTotal = (awalTotal !== null && netTotal !== null) ? awalTotal + netTotal : null
  const isRugi = netTotal !== null && netTotal < 0
  const spendRatio = (totalIn && totalOut) ? Math.min((totalOut / totalIn) * 100, 100) : null

  return (
    <div className="page home-page">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="home-header">
        <div>
          <div className="greeting">CatatDuit</div>
          <div className="day-label">{getDayLabel()}</div>
        </div>
        <div className="home-header-right">
          {dataLoading && (
            <span className="loading-pill" role="status">
              <span className="sr-only">Memuat data</span>
            </span>
          )}
          <ThemeToggle />
          <MonthPicker id="home-month-picker" value={selectedMonth} onChange={onMonthChange} />
        </div>
      </div>

      {/* ── Hero Card ──────────────────────────────────────────── */}
      <div className="hero-card">
        <div className="hero-label">Saldo Akhir {isCurrentMonth ? 'Bulan Ini' : monthLabel}</div>
        <div className="hero-amount">
          {akhirTotal !== null ? formatRupiah(akhirTotal) : '—'}
        </div>
        {netTotal !== null && (
          <div className={`hero-net ${isRugi ? 'is-rugi' : 'is-untung'}`}>
            <span aria-hidden="true">{isRugi ? '▾' : '▴'}</span> {formatRupiah(Math.abs(netTotal))}
          </div>
        )}

        {/* Spend ratio bar */}
        {spendRatio !== null && (
          <div className="hero-ratio-wrap">
            <div className="hero-ratio-track">
              <div
                className={`hero-ratio-fill ${spendRatio >= 100 ? 'over-budget' : ''}`}
                style={{ width: `${spendRatio}%` }}
              />
            </div>
            <div className="hero-ratio-label">
              <span className="hero-sub-in">↑ {formatRupiah(totalIn)}</span>
              <span className="hero-ratio-pct">{Math.round(spendRatio)}% terpakai</span>
              <span className="hero-sub-out">↓ {formatRupiah(totalOut)}</span>
            </div>
          </div>
        )}

        {!getScriptUrl() && (
          <div className="hero-hint">
            <GearSix size={16} weight="bold" />
            <span>Atur Apps Script URL di <strong>Pengaturan</strong> untuk sync real-time</span>
          </div>
        )}
      </div>

      {/* ── Queue banner ───────────────────────────────────────── */}
      {queueCount > 0 && (
        <div className="queue-banner">
          <CloudArrowUp size={16} weight="bold" />
          <span><strong>{queueCount}</strong> transaksi offline menunggu sync</span>
        </div>
      )}

      {/* ── Balance Grid ───────────────────────────────────────── */}
      {summary && (
        <div className="bal-grid">
          {METODE_LIST.map(m => (
            <BalanceCard key={m} metode={m} data={summary[m]} />
          ))}
        </div>
      )}

      {/* ── Charts: minggu + kategori ───────────────────────────── */}
      <div className="chart-section">
        <div className="section-head" style={{ marginTop: 14 }}>
          <h2 className="section-title">Pengeluaran per Minggu</h2>
          {weeklyExpenses.total > 0 && (
            <span className="weekly-total-badge">{formatRupiah(weeklyExpenses.total)}</span>
          )}
        </div>

        <WeeklyComparison data={weekComparison} />

        <div className="weekly-card">
          <WeeklyChart data={weeklyExpenses} currentWeek={currentWeek} />
        </div>

        <div className="section-head" style={{ marginTop: 20 }}>
          <h2 className="section-title">Pengeluaran per Kategori</h2>
        </div>
        <div className="filter-bar filter-bar--scroll" role="group" aria-label="Filter metode chart">
          {['All', ...METODE_LIST].map(m => {
            const active = filterMetode === m
            return (
              <button
                key={m}
                className={`filter-chip filter-chip--sm ${active ? 'filter-on' : ''}`}
                onClick={() => setFilterMetode(m)}
                aria-pressed={active}
              >
                {m !== 'All' && <MethodIcon metode={m} size={14} />}
                {m === 'All' ? 'Semua' : m}
              </button>
            )
          })}
        </div>
        <SubKatChart data={spendingBySubKat} />
      </div>

      {/* ── Top Pengeluaran ─────────────────────────────────────── */}
      <div className="section-head" style={{ marginTop: 8 }}>
        <h2 className="section-title">Top Pengeluaran</h2>

        {/* Filter metode */}
        <div className="top-n-picker" role="group" aria-label="Batas tampil">
          {[5, 10, 20, 'All'].map(n => (
            <button
              key={n}
              className={`top-n-btn ${topLimit === n ? 'top-n-active' : ''}`}
              onClick={() => setTopLimit(n)}
              aria-pressed={topLimit === n}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Filter sub-kategori */}
      <div className="filter-bar filter-bar--scroll" role="group" aria-label="Filter sub-kategori" style={{ marginBottom: 12 }}>
        {['All', ...SUB_CATEGORIES].map(s => {
          const active = filterSub === s
          return (
            <button
              key={s}
              className={`filter-chip filter-chip--sm ${active ? 'filter-on' : ''}`}
              onClick={() => setFilterSub(s)}
              aria-pressed={active}
            >
              {s === 'All' ? 'Semua' : s}
            </button>
          )
        })}
      </div>

      <div className="txn-list">
        {topExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji"><Receipt size={26} weight="light" aria-hidden="true" /></div>
            <p className="empty-msg">
              {filterMetode !== 'All' || filterSub !== 'All'
                ? 'Tidak ada pengeluaran untuk filter ini'
                : `Belum ada pengeluaran di ${monthLabel}`}
            </p>
            <button id="btn-add-empty" className="btn-primary" onClick={onAdd}>
              Catat Sekarang
            </button>
          </div>
        ) : (
          topExpenses.map((tx, i) => (
            <ExpenseRow key={`${tx.tanggal}-${tx.keterangan}-${i}`} tx={tx} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  )
}
