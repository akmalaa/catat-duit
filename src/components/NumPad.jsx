// Custom numeric keypad — bigger tap targets than system keyboard
// Layout: 1 2 3 / 4 5 6 / 7 8 9 / 000 0 ⌫

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
    <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
  </svg>
)

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['000', '0', 'backspace'],
]

export default function NumPad({ onKey }) {
  return (
    <div className="numpad" aria-label="Keyboard angka">
      {ROWS.map((row, ri) => (
        <div key={ri} className="numpad-row">
          {row.map(key => (
            <button
              key={key}
              className={`numpad-key${key === 'backspace' ? ' numpad-back' : ''}`}
              onClick={() => onKey(key)}
              aria-label={key === 'backspace' ? 'Hapus' : key}
              onContextMenu={e => e.preventDefault()}
            >
              {key === 'backspace' ? <BackIcon /> : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
