import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { LivePage } from './pages/LivePage'
import { ComparisonPage } from './pages/ComparisonPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { selectedDevice } from './devices'
import { useDevices } from './useDevices'
import { pageFromHash, pageHash } from './navigation'
import type { DashboardPage, Theme } from './types'

function initialPage(): DashboardPage {
  return pageFromHash(window.location.hash)
}

function initialTheme(): Theme {
  try {
    return localStorage.getItem('kostwatt.theme') === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  const [page, setPage] = useState<DashboardPage>(initialPage)
  const [meterId, setMeterId] = useState('')
  const { devices, loading, error, health } = useDevices()
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [themeError, setThemeError] = useState('')

  useEffect(() => {
    const syncPage = () => setPage(initialPage())
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const changeTheme = (next: Theme) => {
    setTheme(next)
    try {
      localStorage.setItem('kostwatt.theme', next)
      setThemeError('')
    } catch {
      setThemeError('Tema berubah untuk sesi ini, tetapi tidak dapat disimpan di browser.')
    }
  }

  const meter = selectedDevice(devices, meterId)

  const navigate = (next: DashboardPage) => {
    setPage(next)
    const base = window.location.pathname + window.location.search
    window.history.pushState(null, '', pageHash(next) || base)
  }

  const handleSelectMeter = (id: string) => {
    setMeterId(id)
    navigate('live')
  }

  return (
    <div className="app">
      <Sidebar
        page={page}
        meterId={meter?.id ?? ''}
        meters={devices}
        onNavigate={navigate}
        onSelectMeter={handleSelectMeter}
      />

      <main className="main">
        <TopBar theme={theme} onThemeChange={changeTheme} connected={health} />

        <div className="content">
          {themeError && <p className="app-notice" role="alert">{themeError}</p>}
          {loading && <p className="app-notice" role="status">Memuat perangkat dari backend…</p>}
          {error && <p className="app-notice" role="alert">{error}</p>}
          {page !== 'live' && <p className="app-notice" role="status">Halaman ini masih memakai data contoh/pengaturan browser. Data perangkat nyata tersedia di Live monitoring.</p>}
          {page === 'live' ? (
            <LivePage key={meter?.id ?? 'empty'} meterName={meter?.name ?? 'PowerMeter'} deviceCode={meter?.id} />
          ) : page === 'comparison' ? (
            <ComparisonPage />
          ) : page === 'reports' ? (
            <ReportsPage />
          ) : (
            <SettingsPage theme={theme} onThemeChange={changeTheme} />
          )}
        </div>
      </main>
    </div>
  )
}
