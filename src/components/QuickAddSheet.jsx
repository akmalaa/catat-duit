import { useState, useEffect, useRef, useCallback } from 'react'
import {
  CATEGORIES, SUB_CATEGORIES, METODE_LIST, METODE_CONFIG,
  TRANSFER_CATEGORIES, TRANSFER_METODE, getMetodeForCategory,
  toSheetCategory, formatRupiah, formatDate,
} from '../lib/constants'
import { submitTransaction, getScriptUrl } from '../lib/api'
import { enqueue, saveLocalTransaction } from '../lib/storage'
import NumPad from './NumPad'

const getLastMetode = () => localStorage.getItem('cd_last_metode') || 'Cash'
const setLastMetode = (m) => localStorage.setItem('cd_last_metode', m)

export default function QuickAddSheet({ onClose, onSaved, onError }) {
  const today = new Date()

  const [step, setStep] = useState('amount')   // 'amount' | 'details'
  const [amount, setAmount] = useState('')
  const [keterangan, setKeterangan] = useState('')
  const [kategori, setKategori] = useState(CATEGORIES[0])  // Pengeluaran
  const [subKat, setSubKat] = useState('Lain-lain')
  const [metode, setMetode] = useState(getLastMetode())
  const [txDate, setTxDate] = useState(formatDate(today))
  const [loading, setLoading] = useState(false)

  const inputRef = useRef(null)
  const detailsRef = useRef(null)

  useEffect(() => {
    if (step === 'details') {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [step])

  useEffect(() => {
    const locked = TRANSFER_METODE[kategori.label]
    if (locked) setMetode(locked)
  }, [kategori.label])

  // ── Numpad handler (layar + keyboard fisik desktop) ───────
  const applyNumpadKey = useCallback((key) => {
    if (key === 'backspace') {
      setAmount(a => a.slice(0, -1))
      return
    }
    if (key === '000') {
      setAmount(a => (a.length ? a + '000' : a))
      return
    }
    if (key === '.') {
      setAmount(a => (a.includes('.') ? a : (a || '0') + '.'))
      return
    }
    setAmount(a => {
      const next = a === '0' ? key : a + key
      if (next.replace(/\D/g, '').length > 10) return a
      return next
    })
  }, [])

  const amountRef = useRef(amount)
  amountRef.current = amount

  const goDetails = useCallback(() => {
    const current = amountRef.current
    if (!current || Number(current) === 0) {
      onError('Masukkan nominal dulu 👆')
      return
    }
    setStep('details')
  }, [onError])

  // Keyboard fisik: angka 0–9, Backspace, Enter (hanya step nominal)
  useEffect(() => {
    if (step !== 'amount') return

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        applyNumpadKey(e.key)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        applyNumpadKey('backspace')
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        goDetails()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [step, applyNumpadKey, goDetails, onClose])

  // ── Submit ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!amount || Number(amount) === 0) return onError('Nominal tidak boleh kosong')

    const isTransfer = TRANSFER_CATEGORIES.includes(kategori.label)
    const finalMetode = getMetodeForCategory(kategori.label, metode)
    const sheetKategori = toSheetCategory(kategori.label)

    const tx = {
      tanggal: txDate,
      keterangan: keterangan.trim() || kategori.label,
      kategori: sheetKategori,
      metode: finalMetode,
      subKategori: subKat,
      tipe: kategori.tipe,
      nominal: Number(amount),
    }

    setLoading(true)
    if (!isTransfer) {
      setLastMetode(finalMetode)
    }
    saveLocalTransaction(tx)   // always save locally

    const hasUrl = !!getScriptUrl()

    // If no URL configured → queue silently
    if (!hasUrl) {
      enqueue(tx)
      onSaved(true)
      return
    }

    // If offline → queue silently
    if (!navigator.onLine) {
      enqueue(tx)
      onSaved(true)
      return
    }

    try {
      await submitTransaction(tx)
      onSaved(false)
    } catch (e) {
      // Show actual error so user knows what to fix
      setLoading(false)
      const msg = e.message || 'Error tidak diketahui'
      // Timeout / script load fail = Apps Script belum di-deploy ulang
      if (msg.includes('Timeout')) {
        onError('⏱ Timeout — Apps Script belum di-deploy ulang? Cek Pengaturan.')
      } else if (msg.includes('Gagal load script')) {
        onError('🔗 Gagal simpan ke Sheets — cek URL deployment, atau kategori tidak valid di spreadsheet.')
      } else {
        onError('❌ ' + msg)
      }
    }

  }

  // ── Display helpers ──────────────────────────────────────
  const displayNum = amount ? Number(amount).toLocaleString('id-ID') : '0'
  const isIncome = kategori.tipe === 'pemasukan'
  const isTransfer = TRANSFER_CATEGORIES.includes(kategori.label)

  const dateOptions = [0, 1, 2].map(d => {
    const dt = new Date(today)
    dt.setDate(dt.getDate() - d)
    return {
      label: d === 0 ? 'Hari ini' : d === 1 ? 'Kemarin' : '2 hari lalu',
      value: formatDate(dt),
    }
  })

  return (
    <div
      className="sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Catat Transaksi"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="quick-sheet">
        {/* Drag handle */}
        <div className="sheet-handle" aria-hidden="true" />

        {/* Header */}
        <div className="sheet-header">
          <button className="btn-ghost" id="btn-batal" onClick={onClose}>Batal</button>
          <span className="sheet-title">Catat Transaksi</span>
          <div style={{ width: 52 }} aria-hidden="true" />
        </div>

        {/* Income / Expense toggle */}
        <div className="tipe-row" role="group" aria-label="Jenis transaksi">
          <button
            id="btn-keluar"
            className={`tipe-btn ${!isIncome ? 'tipe-expense' : ''}`}
            onClick={() => setKategori(CATEGORIES[0])}
            aria-pressed={!isIncome}
          >
            💸 Keluar
          </button>
          <button
            id="btn-masuk"
            className={`tipe-btn ${isIncome ? 'tipe-income' : ''}`}
            onClick={() => setKategori(CATEGORIES[1])}
            aria-pressed={isIncome}
          >
            💰 Masuk
          </button>
        </div>

        {/* Amount display */}
        <div className={`amount-display ${isIncome ? 'amt-income' : 'amt-expense'}`} aria-live="polite">
          <span className="amt-prefix">Rp</span>
          <span className="amt-value">{displayNum}</span>
          {step === 'amount' && <span className="amt-cursor" aria-hidden="true" />}
        </div>

        {/* ── STEP: AMOUNT ─────────────────────────────────── */}
        {step === 'amount' && (
          <>
            <p className="numpad-kbd-hint">Desktop: ketik angka 0–9 · Backspace · Enter</p>
            <NumPad onKey={applyNumpadKey} />
            <button
              id="btn-lanjut"
              className="btn-primary btn-lanjut"
              onClick={goDetails}
              disabled={!amount || amount === '0'}
            >
              Lanjut →
            </button>
          </>
        )}

        {/* ── STEP: DETAILS ────────────────────────────────── */}
        {step === 'details' && (
          <div className="details-pane" ref={detailsRef}>

            {/* Keterangan */}
            <div className="field-group">
              <label htmlFor="inp-keterangan" className="field-label">
                Keterangan <span className="label-opt">(opsional)</span>
              </label>
              <input
                id="inp-keterangan"
                ref={inputRef}
                className="field-input"
                type="text"
                placeholder={kategori.label}
                value={keterangan}
                onChange={e => setKeterangan(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Kategori */}
            <div className="field-group">
              <div className="field-label">Kategori</div>
              <div className="chips-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    id={`chip-cat-${cat.label.replace(/\s/g, '-')}`}
                    className={`chip ${kategori.label === cat.label ? 'chip-active' : ''}`}
                    style={kategori.label === cat.label
                      ? { background: cat.color + '22', borderColor: cat.color, color: cat.color }
                      : {}}
                    onClick={() => setKategori(cat)}
                    aria-pressed={kategori.label === cat.label}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Kategori */}
            <div className="field-group">
              <div className="field-label">Sub-Kategori</div>
              <div className="chips-wrap">
                {SUB_CATEGORIES.map(s => (
                  <button
                    key={s}
                    id={`chip-sub-${s}`}
                    className={`chip chip-sm ${subKat === s ? 'chip-active' : ''}`}
                    onClick={() => setSubKat(s)}
                    aria-pressed={subKat === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Metode Pembayaran */}
            {!isTransfer ? (
              <div className="field-group">
                <div className="field-label">Metode Pembayaran</div>
                <div className="metode-grid" role="group">
                  {METODE_LIST.map(m => {
                    const c = METODE_CONFIG[m]
                    const active = metode === m
                    return (
                      <button
                        key={m}
                        id={`btn-metode-${m}`}
                        className={`metode-card ${active ? 'metode-on' : ''}`}
                        style={active
                          ? { background: c.gradient, borderColor: 'transparent' }
                          : { borderColor: c.color + '55' }}
                        onClick={() => setMetode(m)}
                        aria-pressed={active}
                      >
                        <span className="metode-emoji">{c.emoji}</span>
                        <span className="metode-name" style={active ? { color: '#fff' } : { color: c.color }}>
                          {m}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="field-group">
                <div className="field-label">Metode Pembayaran</div>
                <div className="transfer-metode-lock">
                  {(() => {
                    const m = TRANSFER_METODE[kategori.label]
                    const c = METODE_CONFIG[m]
                    return (
                      <>
                        <div
                          className="metode-card metode-on transfer-metode-card"
                          style={{ background: c.gradient, borderColor: 'transparent' }}
                        >
                          <span className="metode-emoji">{c.emoji}</span>
                          <span className="metode-name" style={{ color: '#fff' }}>{m}</span>
                        </div>
                        <p className="transfer-info">
                          Metode otomatis mengikuti kategori <strong>{kategori.label}</strong>
                          {' '}— sub-tabel terkait juga diisi di spreadsheet.
                        </p>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Tanggal */}
            <div className="field-group">
              <div className="field-label">Tanggal</div>
              <div className="chips-wrap">
                {dateOptions.map(({ label, value }) => (
                  <button
                    key={value}
                    id={`chip-date-${label.replace(/\s/g, '-')}`}
                    className={`chip chip-sm ${txDate === value ? 'chip-active' : ''}`}
                    onClick={() => setTxDate(value)}
                    aria-pressed={txDate === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              id="btn-simpan"
              className="btn-primary btn-full btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <><span className="btn-spinner" aria-hidden="true" /> Menyimpan...</>
                : '✅ Simpan Transaksi'}
            </button>

            <button className="btn-ghost btn-back-amount" onClick={() => setStep('amount')}>
              ← Ubah nominal ({formatRupiah(Number(amount))})
            </button>

            <div style={{ height: 28 }} aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  )
}
