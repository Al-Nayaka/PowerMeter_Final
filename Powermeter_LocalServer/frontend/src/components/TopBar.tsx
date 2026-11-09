import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../types'

export function TopBar({ theme, onThemeChange }: {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const time = now.toLocaleTimeString('id-ID', { hour12: false })
  const date = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const shortDate = now.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <header className="topbar">
      <div className="connection">
        <span className="dot offline" />
        <span>Mode contoh, {time}</span>
      </div>

      <div className="topbar-right">
        <button type="button" className="icon-button" aria-label={theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap'}
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
        </button>
        <span className="today today-full">{date}</span>
        <span className="today today-short">{shortDate}</span>
      </div>
    </header>
  )
}
