import { METODE_CONFIG, formatRupiah } from '../lib/constants'

export default function TransactionItem({ tx, rank, forceIncome }) {
  const cfg      = METODE_CONFIG[tx.metode] || METODE_CONFIG.Cash
  const isIncome = forceIncome || tx.tipe === 'pemasukan' || Number(tx.pemasukan) > 0
  const amount   = isIncome
    ? Number(tx.pemasukan || tx.nominal || 0)
    : Number(tx.pengeluaran || tx.nominal || 0)

  return (
    <div className="txn-item">
      {rank != null && <div className="txn-rank">{rank}</div>}
      <div className="txn-icon" style={{ background: cfg.bg, color: cfg.color }}>
        {cfg.emoji}
      </div>

      <div className="txn-body">
        <div className="txn-name">{tx.keterangan || tx.kategori}</div>
        <div className="txn-meta">
          <span className="meta-tag meta-tag--kategori">{tx.kategori}</span>
          {tx.subKategori && tx.subKategori !== 'All' && (
            <>
              <span className="meta-dot">·</span>
              <span className="meta-sub">{tx.subKategori}</span>
            </>
          )}
          <span className="meta-dot">·</span>
          <span className="meta-date">{tx.tanggal}</span>
        </div>
      </div>

      <div className={`txn-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
        <span className="amount-sign">{isIncome ? '+' : '-'}</span>
        {formatRupiah(amount)}
      </div>
    </div>
  )
}
