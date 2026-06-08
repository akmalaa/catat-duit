import { useMemo, useState, useEffect } from 'react'
import { SUB_CATEGORIES, formatRupiah, getMonthLabel } from '../lib/constants'
import MonthPicker from '../components/MonthPicker'
import BudgetProgressList from '../components/BudgetProgressList'
import { getAllSubSpending, getBudgetProgressItems } from '../lib/transactions'

function parseBudgetInput(raw) {
  const n = Number(String(raw).replace(/\D/g, ''))
  return n > 0 ? n : 0
}

function formatBudgetInput(num) {
  if (!num) return ''
  return Number(num).toLocaleString('id-ID')
}

export default function Budgeting({
  txns = [],
  budgets = {},
  onBudgetsChange,
  selectedMonth,
  onMonthChange,
  dataLoading,
  budgetSaving,
  onSaved,
  onError,
}) {
  const [draft, setDraft] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const next = {}
    for (const sub of SUB_CATEGORIES) {
      next[sub] = budgets[sub] ? formatBudgetInput(budgets[sub]) : ''
    }
    setDraft(next)
  }, [budgets])

  const budgetItems = useMemo(() => {
    const spending = getAllSubSpending(txns, selectedMonth, new Date().getFullYear())
    return getBudgetProgressItems(spending, budgets)
  }, [txns, selectedMonth, budgets])

  const monthLabel = getMonthLabel(selectedMonth)
  const activeCount = Object.values(budgets).filter(v => Number(v) > 0).length
  const totalLimit = budgetItems.reduce((s, i) => s + i.limit, 0)
  const totalSpent = budgetItems.reduce((s, i) => s + i.spent, 0)
  const overCount = budgetItems.filter(i => i.over).length

  const handleSaveBudgets = async () => {
    const next = {}
    const removed = []
    for (const sub of SUB_CATEGORIES) {
      const val = parseBudgetInput(draft[sub])
      if (val > 0) {
        next[sub] = val
      } else if (Number(budgets[sub]) > 0) {
        removed.push(sub)
      }
    }
    setSaving(true)
    try {
      await onBudgetsChange(next, selectedMonth, removed)
      setShowForm(false)
      onSaved?.()
    } catch (e) {
      onError?.(e?.message || 'Gagal menyimpan budget')
    } finally {
      setSaving(false)
    }
  }

  const handleBudgetChange = (sub, value) => {
    setDraft(prev => ({
      ...prev,
      [sub]: value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
    }))
  }

  return (
    <div className="page budgeting-page">
      <div className="budgeting-header">
        <div>
          <h1 className="page-title">Budgeting</h1>
          <div className="budgeting-sub">{monthLabel}</div>
        </div>
        <div className="budgeting-header-right">
          {dataLoading && <span className="loading-pill" aria-label="Memuat" />}
          <MonthPicker id="budget-month-picker" value={selectedMonth} onChange={onMonthChange} />
        </div>
      </div>

      {/* ── Ringkasan ─────────────────────────────────────────── */}
      {activeCount > 0 && (
        <div className="budgeting-summary">
          <div className="budgeting-stat">
            <span className="budgeting-stat-label">Terpakai</span>
            <span className="budgeting-stat-val is-expense">{formatRupiah(totalSpent)}</span>
          </div>
          <div className="budgeting-stat-divider" />
          <div className="budgeting-stat">
            <span className="budgeting-stat-label">Total Budget</span>
            <span className="budgeting-stat-val">{formatRupiah(totalLimit)}</span>
          </div>
          <div className="budgeting-stat-divider" />
          <div className="budgeting-stat">
            <span className="budgeting-stat-label">Over</span>
            <span className={`budgeting-stat-val ${overCount ? 'is-expense' : 'is-ok'}`}>
              {overCount} kategori
            </span>
          </div>
        </div>
      )}

      {/* ── Progress ──────────────────────────────────────────── */}
      <div className="section-head">
        <h2 className="section-title">Progress</h2>
        {budgetItems.length > 0 && (
          <span className="budget-count-badge">{budgetItems.length} aktif</span>
        )}
      </div>
      <div className="budget-card">
        <BudgetProgressList items={budgetItems} emptyHint="Belum ada budget — atur di bawah" />
      </div>

      {/* ── Atur budget ───────────────────────────────────────── */}
      <div className="section-head" style={{ marginTop: 20 }}>
        <h2 className="section-title">Atur Budget</h2>
        <button
          type="button"
          className="budgeting-toggle"
          onClick={() => setShowForm(v => !v)}
          aria-expanded={showForm}
        >
          {showForm ? 'Tutup' : 'Edit'}
        </button>
      </div>

      {showForm && (
        <div className="settings-card budgeting-form-card">
          <p className="card-body" style={{ marginBottom: 14 }}>
            Batas pengeluaran bulanan per sub-kategori. Tersimpan ke spreadsheet (A63:B) dan cache lokal.
          </p>
          <div className="budget-form">
            {SUB_CATEGORIES.map(sub => (
              <div key={sub} className="budget-form-row">
                <label htmlFor={`budget-${sub}`} className="budget-form-label">{sub}</label>
                <div className="budget-form-input-wrap">
                  <span className="budget-form-prefix">Rp</span>
                  <input
                    id={`budget-${sub}`}
                    type="text"
                    inputMode="numeric"
                    className="budget-form-input"
                    placeholder="0"
                    value={draft[sub] ?? ''}
                    onChange={e => handleBudgetChange(sub, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            id="btn-save-budgets"
            className="btn-primary"
            style={{ marginTop: 14, width: '100%' }}
            onClick={handleSaveBudgets}
            disabled={saving || budgetSaving}
          >
            {saving || budgetSaving ? '⏳ Menyimpan...' : 'Simpan Budget'}
          </button>
        </div>
      )}
    </div>
  )
}
