import { formatRupiah } from '../lib/constants'

export default function BudgetProgressList({ items, emptyHint = 'Atur budget di bawah' }) {
  if (!items.length) {
    return (
      <div className="budget-empty">
        <span className="budget-empty-emoji">🎯</span>
        <span>{emptyHint}</span>
      </div>
    )
  }

  return (
    <div className="budget-list">
      {items.map(item => {
        const barPct = Math.min(item.pct, 100)
        const warn = item.pct >= 80 && !item.over
        return (
          <div key={item.sub} className={`budget-row ${item.over ? 'is-over' : warn ? 'is-warn' : ''}`}>
            <div className="budget-row-head">
              <span className="budget-sub">{item.sub}</span>
              <span className="budget-nums">
                {formatRupiah(item.spent)}<span className="budget-nums-sep"> / </span>{formatRupiah(item.limit)}
              </span>
            </div>
            <div className="budget-bar-wrap">
              <div
                className={`budget-bar-fill ${item.over ? 'over-budget' : warn ? 'warn-budget' : ''}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="budget-row-foot">
              <span className={`budget-pct ${item.over ? 'is-over' : ''}`}>
                {Math.round(item.pct)}%
              </span>
              {item.over && (
                <span className="budget-over-label">
                  Lebih {formatRupiah(item.spent - item.limit)}
                </span>
              )}
              {!item.over && item.spent === 0 && (
                <span className="budget-foot-hint">Belum ada pengeluaran</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
