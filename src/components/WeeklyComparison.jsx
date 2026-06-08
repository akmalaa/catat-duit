import { formatRupiah } from '../lib/constants'

export default function WeeklyComparison({ data }) {
  const { recentTotal, prevTotal, changePct, direction, recentLabel, prevLabel, recentRange, prevRange } = data
  const hasData = recentTotal > 0 || prevTotal > 0

  if (!hasData) {
    return (
      <div className="week-compare week-compare--empty">
        <span>Belum ada pengeluaran minggu ini / minggu kemarin</span>
      </div>
    )
  }

  const isUp = direction === 'up'
  const isDown = direction === 'down'
  const pctText = changePct === null
    ? '—'
    : `${changePct > 0 ? '+' : ''}${Math.round(changePct)}%`

  return (
    <div className="week-compare" role="group" aria-label="Perbandingan pengeluaran minggu ini vs minggu kemarin">
      <div className="week-compare-col">
        <span className="week-compare-label">{recentLabel}</span>
        {recentRange && <span className="week-compare-range">{recentRange}</span>}
        <span className="week-compare-val">{formatRupiah(recentTotal)}</span>
      </div>

      <div className={`week-compare-delta ${isUp ? 'is-up' : isDown ? 'is-down' : 'is-flat'}`}>
        <span className="week-compare-arrow" aria-hidden="true">
          {isUp ? '▲' : isDown ? '▼' : '—'}
        </span>
        <span className="week-compare-pct">{pctText}</span>
      </div>

      <div className="week-compare-col week-compare-col--prev">
        <span className="week-compare-label">{prevLabel}</span>
        {prevRange && <span className="week-compare-range">{prevRange}</span>}
        <span className="week-compare-val">{formatRupiah(prevTotal)}</span>
      </div>
    </div>
  )
}
