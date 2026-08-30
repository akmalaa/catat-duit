import { useEffect, useState } from 'react'
import { Sun, Moon } from '@phosphor-icons/react'
import { getTheme, toggleThemeAnimated } from '../lib/theme'

export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme)

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  const isLight = theme === 'light'

  const handleClick = (e) => {
    const { clientX, clientY } = e
    toggleThemeAnimated(clientX, clientY, setThemeState)
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-pressed={isLight}
      aria-label={isLight ? 'Ganti ke mode gelap' : 'Ganti ke mode terang'}
      title={isLight ? 'Mode terang' : 'Mode gelap'}
    >
      {isLight ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
    </button>
  )
}
