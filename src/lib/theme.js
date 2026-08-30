const KEY = 'cd_theme'
const THEME_COLOR = { dark: '#0b1220', light: '#f1f5f9' }

export function getStoredTheme() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function getTheme() {
  return getStoredTheme() || getSystemTheme()
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] || THEME_COLOR.dark)
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  applyTheme(theme)
}

export function toggleTheme() {
  const next = getTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

// Toggle dengan animasi lingkaran membesar dari titik (x, y) — biasanya posisi
// tombol yang ditekan. Butuh View Transitions API (Chrome/Edge/Android WebView);
// browser lain & prefers-reduced-motion jatuh ke ganti tema instan.
//
// `onApply` (mis. setState ikon Sun/Moon) dipanggil DI DALAM callback
// startViewTransition, bukan langsung setelah return — supaya re-render React-nya
// ikut ke-capture dalam satu snapshot yang sama, bukan numpuk kerjaan terpisah di
// tengah proses capture browser (itu yang bikin animasinya patah-patah/stutter).
export function toggleThemeAnimated(x, y, onApply) {
  const next = getTheme() === 'light' ? 'dark' : 'light'
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const apply = () => {
    setTheme(next)
    onApply?.(next)
  }

  if (!document.startViewTransition || reduceMotion) {
    apply()
    return next
  }

  const transition = document.startViewTransition(apply)
  transition.ready.then(() => {
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${endRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 380,
        easing: 'linear',
        pseudoElement: '::view-transition-new(root)',
      },
    )
  })
  return next
}
