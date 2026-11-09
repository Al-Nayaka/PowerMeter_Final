import { useState } from 'react'
import { Activity, ChartColumn, ChevronDown, FileText, Settings } from 'lucide-react'
import { Logo } from './Logo'
import type { Device } from '../devices'
import type { DashboardPage } from '../types'

interface SidebarProps {
  page: DashboardPage
  meterId: string
  meters: Device[]
  onNavigate: (page: DashboardPage) => void
  onSelectMeter: (id: string) => void
}

export function Sidebar({
  page,
  meterId,
  meters,
  onNavigate,
  onSelectMeter,
}: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(page === 'live')
  const selectedMeter = meters.find((meter) => meter.id === meterId) ?? meters[0]

  const handleLiveClick = () => {
    if (page !== 'live') {
      onNavigate('live')
      setMenuOpen(true)
      return
    }
    setMenuOpen((open) => !open)
  }

  const handleComparisonClick = () => {
    setMenuOpen(false)
    onNavigate('comparison')
  }

  const handleMeterClick = (id: string) => {
    onSelectMeter(id)
    setMenuOpen(true)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo />
        <span className="brand">KostWatt</span>
      </div>

      <nav className="nav" aria-label="Navigasi utama">
        <button
          type="button"
          className="nav-item"
          onClick={handleLiveClick}
          aria-expanded={menuOpen}
          aria-label="Live monitoring"
        >
          <Activity size={20} strokeWidth={1.8} />
          <span className="nav-text">Live monitoring</span>
          <ChevronDown
            size={16}
            strokeWidth={1.8}
            className={`chevron${menuOpen ? ' is-open' : ''}`}
          />
        </button>

        {menuOpen && (
          <button
            type="button"
            className={`nav-item nav-sub${page === 'live' ? ' is-active' : ''}`}
            aria-current={page === 'live' ? 'page' : undefined}
            onClick={() => onNavigate('live')}
          >
            {selectedMeter?.name ?? 'Belum ada perangkat'}
          </button>
        )}

        <button
          type="button"
          className={`nav-item${page === 'comparison' ? ' is-active' : ''}`}
          onClick={handleComparisonClick}
          aria-label="Power comparison"
          aria-current={page === 'comparison' ? 'page' : undefined}
        >
          <ChartColumn size={20} strokeWidth={1.8} />
          <span className="nav-text">Power comparison</span>
        </button>

        <button type="button" className={`nav-item${page === 'reports' ? ' is-active' : ''}`} aria-label="Laporan"
          aria-current={page === 'reports' ? 'page' : undefined}
          onClick={() => { setMenuOpen(false); onNavigate('reports') }}>
          <FileText size={20} strokeWidth={1.8} />
          <span className="nav-text">Laporan</span>
        </button>

        <button type="button" className={`nav-item${page === 'settings' ? ' is-active' : ''}`} aria-label="Pengaturan"
          aria-current={page === 'settings' ? 'page' : undefined}
          onClick={() => { setMenuOpen(false); onNavigate('settings') }}>
          <Settings size={20} strokeWidth={1.8} />
          <span className="nav-text">Pengaturan</span>
        </button>
      </nav>

      <div className="meter-list">
        {meters.length === 0 && <p className="app-notice">Belum ada perangkat terdaftar.</p>}
        {meters.map((meter) => (
          <button
            key={meter.id}
            type="button"
            className={`meter-card${meterId === meter.id ? ' is-selected' : ''}`}
            onClick={() => handleMeterClick(meter.id)}
            aria-pressed={meterId === meter.id}
            aria-label={`${meter.name}, ${meter.online ? 'Online' : 'Offline'}`}
            title={meter.name}
          >
            <span className="meter-name">{meter.name}</span>
            <span className="meter-status">
              <span className={`dot ${meter.online ? 'online' : 'offline'}`} />
              {meter.online ? 'Online' : 'Offline'}
            </span>
          </button>
        ))}
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <span className="avatar">AD</span>
        <div className="user-meta">
          <div className="user-name">Adrian Kost</div>
          <div className="user-role">Pemilik</div>
        </div>
      </div>
    </aside>
  )
}
