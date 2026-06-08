import { useMemo, useRef, useState } from 'react'
import { METODE_LIST, METODE_CONFIG, TRANSFER_CATEGORIES, formatRupiah } from '../lib/constants'
import MonthPicker from '../components/MonthPicker'
import { groupTransactionsByDay } from '../lib/transactions'
import TransactionItem from '../components/TransactionItem'

// Tidak ada calcStats di sini.
// Semua angka (pemasukan, pengeluaran, saldo) diambil langsung dari
// prop `summary` dan `masterTotals` yang sudah dihitung oleh Apps Script
// — sama persis dengan yang tampil di Dashboard.

export default function History({ summary, masterTotals, txns = [], dataLoading, selectedMonth, onMonthChange }) {
  const [filter, setFilter] = useState('All')
  const headerRef = useRef(null)

  const filtered = filter === 'All' ? txns : txns.filter(t => t.metode === filter)
  const dayGroups = useMemo(() => groupTransactionsByDay(filtered), [filtered])

  // ── Ambil angka dari Dashboard (Apps Script), bukan hitung sendiri ──
  const filterCfg = filter !== 'All' ? METODE_CONFIG[filter] : null

  // Saat filter = 'All' → pakai masterTotals (total semua baris master)
  // Saat filter = metode → pakai summary[metode]
  const displayData = filter === 'All'
    ? { pemasukan: masterTotals?.pemasukan ?? null, pengeluaran: masterTotals?.pengeluaran ?? null }
    : summary?.[filter] ?? null

  const dispPemasukan = displayData?.pemasukan ?? null
  const dispPengeluaran = displayData?.pengeluaran ?? null

  // Saldo akhir hanya tampil jika filter per-metode (ada saldoAwal dari Apps Script)
  const metodeData = filter !== 'All' && summary ? summary[filter] : null
  const saldoAkhir = metodeData
    ? (metodeData.saldoAwal || 0) + (metodeData.pemasukan || 0) - (metodeData.pengeluaran || 0)
    : null

  return (
    <div className="page history-page">
      {/* ── Fixed sticky header ───────────────────────────────── */}
      <div className="hist-sticky" ref={headerRef}>
        <div className="hist-title-row">
          <h1 className="hist-title">Riwayat</h1>
          <div className="hist-title-right">
            {dataLoading && <span className="loading-pill" aria-label="Memuat" />}
            <MonthPicker id="hist-month-picker" value={selectedMonth} onChange={onMonthChange} />
          </div>
        </div>

        {/* Stats mini-bar — angka dari Apps Script, sama dengan Dashboard */}
        <div
          className="hist-stats"
          style={filterCfg ? { borderColor: filterCfg.color + '44' } : {}}
        >
          <div className="hist-stat">
            <span className="hist-stat-label">Pemasukan</span>
            <span className="hist-stat-val is-income">
              {dispPemasukan !== null ? formatRupiah(dispPemasukan) : '—'}
            </span>
          </div>
          <div className="hist-stat-divider" />
          <div className="hist-stat">
            <span className="hist-stat-label">Pengeluaran</span>
            <span className="hist-stat-val is-expense">
              {dispPengeluaran !== null ? formatRupiah(dispPengeluaran) : '—'}
            </span>
          </div>
          {saldoAkhir !== null && (
            <>
              <div className="hist-stat-divider" />
              <div className="hist-stat">
                <span className="hist-stat-label">Saldo Akhir</span>
                <span
                  className="hist-stat-val"
                  style={{ color: filterCfg ? filterCfg.color : 'var(--t1)' }}
                >
                  {formatRupiah(saldoAkhir)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Filter metode */}
        <div className="filter-bar hist-filter" role="group" aria-label="Filter metode">
          {['All', ...METODE_LIST].map(m => {
            const cfg = m !== 'All' ? METODE_CONFIG[m] : null
            const active = filter === m
            return (
              <button
                key={m}
                id={`hist-filter-${m}`}
                className={`filter-chip ${active ? 'filter-on' : ''}`}
                style={active && cfg ? { background: cfg.color + '22', borderColor: cfg.color, color: cfg.color } : {}}
                onClick={() => setFilter(m)}
                aria-pressed={active}
              >
                {cfg && <>{cfg.emoji}&nbsp;</>}{m === 'All' ? 'Semua' : m}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────── */}
      <div className="hist-body">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🔍</div>
            <p className="empty-msg">
              {filter === 'All' ? 'Belum ada transaksi' : `Tidak ada transaksi ${filter}`}
            </p>
          </div>
        ) : (
          dayGroups.map(group => (
            <section key={group.dateKey} className="day-group" aria-label={group.label}>
              <div className="day-group-header">
                <span className="day-group-label">{group.label}</span>
                <span className="day-group-count">{group.items.length} transaksi</span>
              </div>
              <div className="txn-list day-group-list">
                {group.items.map((tx, i) => (
                  <TransactionItem
                    key={`${group.dateKey}-${i}`}
                    tx={tx}
                    forceIncome={TRANSFER_CATEGORIES.includes(tx.kategori)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}