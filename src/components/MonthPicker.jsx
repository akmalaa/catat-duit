import { MONTH_LABELS_ID } from '../lib/constants'

const CURRENT_YEAR = new Date().getFullYear()

export default function MonthPicker({ value, onChange, id = 'month-picker' }) {
  return (
    <div className="month-picker">
      <select
        id={id}
        className="month-picker-select"
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        aria-label="Pilih bulan"
      >
        {MONTH_LABELS_ID.map((label, i) => (
          <option key={i} value={i}>
            {label} {CURRENT_YEAR}
          </option>
        ))}
      </select>
      <span className="month-picker-chevron" aria-hidden="true">▾</span>
    </div>
  )
}
