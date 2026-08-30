import { useState, useRef } from 'react'
import { CATEGORIES, SUB_CATEGORIES, METODE_LIST, METODE_CONFIG, getMetodeForCategory, formatRupiah } from '../lib/constants'
import { fetchRecentTransactions, importTransactions } from '../lib/api'
import MonthPicker from './MonthPicker'

let uid = 0
const nextId = () => ++uid

export default function ImportStatementSheet({ onClose, onImported, onError }) {
  const [step, setStep] = useState('upload') // upload | parsing | review | importing | result
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [monthIndex, setMonthIndex] = useState(new Date().getMonth())
  const [rows, setRows] = useState([])
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleParse = async () => {
    if (!file) return onError('Pilih file .xlsx dulu')

    setStep('parsing')
    try {
      const [{ parseMandiriStatement }, { mapStatementRows }] = await Promise.all([
        import('../lib/statementParser'),
        import('../lib/statementMapper'),
      ])

      const rawRows = await parseMandiriStatement(file, password)
      if (rawRows.length === 0) throw new Error('Tidak ada transaksi ditemukan di file ini.')

      const mapped = mapStatementRows(rawRows)

      // Auto-deteksi bulan target dari tanggal transaksi pertama
      const firstDate = new Date(rawRows[0].tanggalRaw)
      const detectedMonth = isNaN(firstDate.getTime()) ? monthIndex : firstDate.getMonth()
      setMonthIndex(detectedMonth)

      let existing = []
      try {
        existing = await fetchRecentTransactions(400, detectedMonth)
      } catch { /* dedup optional — lanjut tanpa cek kalau gagal fetch */ }

      const withMeta = mapped.map(tx => {
        const isDup = existing.some(ex =>
          ex.tanggal === tx.tanggal &&
          ex.tipe === tx.tipe &&
          Number(ex.nominal) === Number(tx.nominal)
        )
        return { ...tx, _id: nextId(), include: !isDup, isDup }
      })

      setRows(withMeta)
      setStep('review')
    } catch (e) {
      onError('❌ ' + (e.message || 'Gagal parse file'))
      setStep('upload')
    }
  }

  const updateRow = (id, patch) => {
    setRows(rs => rs.map(r => (r._id === id ? { ...r, ...patch } : r)))
  }

  const includedRows = rows.filter(r => r.include)
  const totalMasuk = includedRows.filter(r => r.tipe === 'pemasukan').reduce((s, r) => s + r.nominal, 0)
  const totalKeluar = includedRows.filter(r => r.tipe === 'pengeluaran').reduce((s, r) => s + r.nominal, 0)

  const handleImport = async () => {
    if (includedRows.length === 0) return onError('Gak ada transaksi yang dicentang')

    setStep('importing')
    try {
      const payload = includedRows.map(({ _id, include, isDup, _raw, ...tx }) => tx)
      const data = await importTransactions(monthIndex, payload)
      setResult({ ok: true, count: data.count, sheetName: data.sheetName })
      setStep('result')
      onImported(monthIndex)
    } catch (e) {
      setResult({ ok: false, message: e.message })
      setStep('result')
    }
  }

  return (
    <div
      className="sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import E-Statement"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="quick-sheet import-sheet">
        <div className="sheet-handle" aria-hidden="true" />

        <div className="sheet-header">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <span className="sheet-title">Import E-Statement</span>
          <div style={{ width: 52 }} aria-hidden="true" />
        </div>

        {step === 'upload' && (
          <div className="details-pane">
            <p className="card-body">
              Upload e-statement Mandiri Livin (.xlsx). Kalau ber-password, masukkan password-nya —
              file di-decrypt & diparse langsung di browser, gak dikirim ke mana-mana.
            </p>

            <div className="field-group">
              <label className="field-label" htmlFor="import-file">File .xlsx</label>
              <input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="field-input"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="import-password">
                Password <span className="label-opt">(kosongkan kalau file gak ber-password)</span>
              </label>
              <input
                id="import-password"
                type="password"
                className="field-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button className="btn-primary btn-full" onClick={handleParse} disabled={!file}>
              Parse File
            </button>
          </div>
        )}

        {step === 'parsing' && (
          <div className="details-pane import-loading">
            <span className="btn-spinner" aria-hidden="true" />
            <p className="card-body">Decrypt & parsing file...</p>
          </div>
        )}

        {step === 'review' && (
          <div className="details-pane">
            <div className="field-group">
              <div className="field-label">Import ke bulan</div>
              <MonthPicker value={monthIndex} onChange={setMonthIndex} />
            </div>

            <div className="import-summary">
              <span>{includedRows.length}/{rows.length} transaksi dipilih</span>
              <span className="txn-amount is-income">+{formatRupiah(totalMasuk)}</span>
              <span className="txn-amount is-expense">-{formatRupiah(totalKeluar)}</span>
            </div>

            <div className="txn-list import-review-list">
              {rows.map(row => (
                <ImportRow key={row._id} row={row} onChange={patch => updateRow(row._id, patch)} />
              ))}
            </div>

            <button className="btn-primary btn-full btn-submit" onClick={handleImport} disabled={includedRows.length === 0}>
              ✅ Import {includedRows.length} Transaksi
            </button>
          </div>
        )}

        {step === 'importing' && (
          <div className="details-pane import-loading">
            <span className="btn-spinner" aria-hidden="true" />
            <p className="card-body">Mengirim transaksi ke spreadsheet...</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="details-pane">
            {result.ok ? (
              <>
                <p className="card-body">✅ {result.count} transaksi berhasil diimport ke sheet {result.sheetName}.</p>
                <button className="btn-primary btn-full" onClick={onClose}>Selesai</button>
              </>
            ) : (
              <>
                <p className="card-body">❌ Import gagal: {result.message}</p>
                <button className="btn-outline btn-full" onClick={() => setStep('review')}>Kembali ke Review</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ImportRow({ row, onChange }) {
  const cfg = METODE_CONFIG[row.metode] || METODE_CONFIG.Cash
  const catCfg = CATEGORIES.find(c => c.label === row.kategori)
  const isIncome = catCfg?.tipe === 'pemasukan'

  return (
    <div className={`txn-item import-row ${!row.include ? 'import-row-excluded' : ''}`}>
      <input
        type="checkbox"
        className="import-row-check"
        checked={row.include}
        onChange={e => onChange({ include: e.target.checked })}
        aria-label="Sertakan transaksi ini"
      />
      <div className="txn-icon" style={{ background: cfg.bg, color: cfg.color }}>{cfg.emoji}</div>

      <div className="txn-body">
        <input
          type="text"
          className="field-input import-row-keterangan"
          value={row.keterangan}
          onChange={e => onChange({ keterangan: e.target.value })}
          placeholder="Keterangan"
          maxLength={80}
        />
        <div className="txn-meta">
          <span className="meta-tag">{row.tanggal}</span>
          {row.isDup && <span className="meta-tag import-dup-badge">Kemungkinan duplikat</span>}
        </div>
        <div className="import-row-selects">
          <select
            className="field-input"
            value={row.kategori}
            onChange={e => {
              const nextCat = CATEGORIES.find(c => c.label === e.target.value)
              onChange({
                kategori: e.target.value,
                metode: getMetodeForCategory(e.target.value, row.metode),
                subKategori: nextCat?.tipe === 'pemasukan' ? null : (row.subKategori || 'Lain-lain'),
              })
            }}
          >
            {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          {!isIncome && (
            <select className="field-input" value={row.subKategori} onChange={e => onChange({ subKategori: e.target.value })}>
              {SUB_CATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select className="field-input" value={row.metode} onChange={e => onChange({ metode: e.target.value })}>
            {METODE_LIST.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className={`txn-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
        <span className="amount-sign">{isIncome ? '+' : '-'}</span>
        {formatRupiah(row.nominal)}
      </div>
    </div>
  )
}
