import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { defaultLimits, loadLocal, parseDevices, parseSettings, saveLocal, validateConnection, validateDevice, validateLimits } from '../settings'
import type { LocalDevice, LocalSettings } from '../settings'
import './SettingsPage.css'

type Theme = 'dark' | 'light'
type Notice = { text: string; error: boolean }

function Switch({ label, checked, onChange, helper, disabled = false }: { label: string; checked: boolean; onChange?: (value: boolean) => void; helper?: string; disabled?: boolean }) {
  return <label className={`settings-switch-row${disabled ? ' is-disabled' : ''}`}><span><span className="settings-switch-label">{label}</span>{helper && <small>{helper}</small>}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange?.(event.target.checked)} /><span className="settings-switch-track" aria-hidden="true" /></label>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="settings-field"><span>{label}</span>{children}</label>
}

export function SettingsPage({ theme, onThemeChange }: { theme: Theme; onThemeChange: (theme: Theme) => void }) {
  const [loaded] = useState(() => loadLocal('kostwatt.settings', parseSettings))
  const [loadedDevices] = useState(() => loadLocal('kostwatt.devices', parseDevices))
  const [settings, setSettings] = useState(loaded.value)
  const [devices, setDevices] = useState(loadedDevices.value)
  const [selectedId, setSelectedId] = useState(loadedDevices.value[0].id)
  const [limits, setLimits] = useState(settings.limits)
  const [connection, setConnection] = useState(settings.connection)
  const [notice, setNotice] = useState<Notice>({ text: loaded.error || loadedDevices.error, error: true })
  const [dialogError, setDialogError] = useState('')
  const [originalId, setOriginalId] = useState<string>()
  const [draft, setDraft] = useState<LocalDevice>(devices[0])
  const dialog = useRef<HTMLDialogElement>(null)
  const device = devices.find(item => item.id === selectedId) || devices[0]

  function persist(next: LocalSettings, message = 'Preferensi disimpan di browser ini.') {
    const error = saveLocal('kostwatt.settings', next)
    if (!error) setSettings(next)
    setNotice({ text: error || message, error: !!error })
    return !error
  }

  function preference(key: keyof LocalSettings['preferences'], value: string) {
    persist({ ...settings, preferences: { ...settings.preferences, [key]: value } })
  }

  function openDevice(edit: boolean) {
    setOriginalId(edit ? device.id : undefined)
    setDraft(edit ? { ...device } : { id: '', name: '', location: '', protocol: 'MQTT', interval: 2 })
    setDialogError('')
    dialog.current?.showModal()
  }

  function submitDevice(event: FormEvent) {
    event.preventDefault()
    const cleaned = { ...draft, id: draft.id.trim(), name: draft.name.trim(), location: draft.location.trim() }
    const error = validateDevice(cleaned, devices, originalId)
    if (error) { setDialogError(error); return }
    const next = originalId ? devices.map(item => item.id === originalId ? cleaned : item) : [...devices, cleaned]
    const storageError = saveLocal('kostwatt.devices', next)
    if (storageError) { setDialogError(storageError); return }
    setDevices(next)
    setSelectedId(cleaned.id)
    setNotice({ text: 'Data perangkat disimpan lokal. Perangkat fisik tidak ditambahkan atau dihubungkan.', error: false })
    dialog.current?.close()
  }

  function submitLimits(event: FormEvent) {
    event.preventDefault()
    const error = validateLimits(limits)
    if (error) { setNotice({ text: error, error: true }); return }
    persist({ ...settings, limits }, 'Batas parameter disimpan lokal. Pemantauan perangkat belum aktif.')
  }

  const notificationLabels = { voltage: 'Tegangan di luar batas', current: 'Arus melebihi batas', power: 'Daya melebihi batas', device: 'Perangkat kehilangan koneksi', mqtt: 'Koneksi MQTT terputus' }
  const limitFields = [['minVoltage', 'Tegangan minimum', 'V'], ['maxVoltage', 'Tegangan maksimum', 'V'], ['maxCurrent', 'Arus maksimum', 'A'], ['maxPower', 'Daya maksimum', 'W']] as const

  return <div className="settings-page">
    <header className="settings-heading"><h1>Pengaturan</h1><p>Kelola perangkat, parameter listrik, notifikasi, dan preferensi sistem.</p></header>
    {notice.text && <div className={`settings-notice${notice.error ? ' is-error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
    <div className="settings-grid">
      <section className="settings-card" aria-labelledby="device-title">
        <div className="settings-card-heading"><h2 id="device-title">Pengaturan Perangkat</h2><span className="settings-badge">Lokal</span></div>
        <div className="settings-fields">
          <div className="settings-pair"><Field label="Nama perangkat"><select aria-label="Nama perangkat" value={device.id} onChange={event => setSelectedId(event.target.value)}>{devices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="ID perangkat"><input value={device.id} readOnly /></Field></div>
          <div className="settings-pair"><Field label="Lokasi"><input value={device.location} readOnly /></Field><Field label="Protokol komunikasi"><select aria-label="Protokol komunikasi" value={device.protocol} onChange={event => { setOriginalId(device.id); setDraft({ ...device, protocol: event.target.value as LocalDevice['protocol'] }); setDialogError(''); dialog.current?.showModal() }}><option>MQTT</option><option>HTTP</option></select></Field></div>
          <div className="settings-pair"><Field label="Interval polling"><input value={`${device.interval} detik`} readOnly /></Field><div className="settings-device-status"><span>Status koneksi</span><span className="settings-offline"><i />Belum terhubung</span></div></div>
        </div>
        <div className="settings-actions"><button className="settings-primary" type="button" onClick={() => openDevice(false)}>Tambah Perangkat</button><button className="settings-secondary" type="button" onClick={() => openDevice(true)}>Edit Perangkat</button></div>
        <p className="settings-help">Daftar perangkat hanya tersimpan lokal, bukan provisioning perangkat fisik.</p>
      </section>

      <section className="settings-card" aria-labelledby="limits-title">
        <div className="settings-card-heading"><h2 id="limits-title">Batas Parameter Listrik</h2><Switch label="Peringatan batas" checked={limits.enabled} onChange={enabled => setLimits({ ...limits, enabled })} /></div>
        <form onSubmit={submitLimits}>
          <div className="settings-limit-grid">{limitFields.map(([key, label, unit]) => <Field key={key} label={label}><span className="settings-unit-input"><input aria-label={label} type="number" required min="0.01" step="any" value={Number.isNaN(limits[key]) ? '' : limits[key]} onChange={event => setLimits({ ...limits, [key]: event.target.valueAsNumber })} /><span aria-hidden="true">{unit}</span></span></Field>)}</div>
          <p className="settings-help">Batas untuk peringatan lokal. Belum terhubung ke pemantauan langsung.</p>
          <div className="settings-actions"><button className="settings-primary" type="submit">Simpan Pengaturan</button><button className="settings-secondary" type="button" onClick={() => { const next = { ...defaultLimits }; if (persist({ ...settings, limits: next }, 'Batas parameter dikembalikan ke nilai bawaan dan disimpan lokal.')) setLimits(next) }}>Reset</button></div>
        </form>
      </section>

      <section className="settings-card" aria-labelledby="notifications-title">
        <div className="settings-card-heading"><h2 id="notifications-title">Notifikasi</h2></div>
        {(Object.keys(notificationLabels) as (keyof typeof notificationLabels)[]).map(key => <Switch key={key} label={notificationLabels[key]} checked={settings.notifications[key]} onChange={value => persist({ ...settings, notifications: { ...settings.notifications, [key]: value } })} />)}
        <div className="settings-subsection"><h3>Jenis notifikasi</h3><Switch label="Dashboard" helper="Muncul sebagai peringatan di halaman" checked={settings.notifications.dashboard} onChange={dashboard => persist({ ...settings, notifications: { ...settings.notifications, dashboard } })} /><Switch label="Eksternal · Belum dikonfigurasi" helper="Email atau pesan instan perlu disiapkan dulu." checked={false} disabled /></div>
        <p className="settings-help">Pilihan disimpan lokal. Pengiriman notifikasi belum aktif tanpa backend.</p>
      </section>

      <section className="settings-card" aria-labelledby="preferences-title">
        <div className="settings-card-heading"><h2 id="preferences-title">Preferensi Dashboard</h2></div>
        <div className="settings-preferences">
          <div className="settings-preference-row"><span>Tema tampilan</span><div className="settings-segment" role="group" aria-label="Tema tampilan">{(['light', 'dark'] as const).map(value => <button type="button" key={value} aria-pressed={theme === value} onClick={() => onThemeChange(value)}>{value === 'light' ? 'Light' : 'Dark'}</button>)}</div></div>
          <div className="settings-preference-row"><span>Satuan daya</span><div className="settings-segment" role="group" aria-label="Satuan daya">{['W', 'kW'].map(value => <button type="button" key={value} aria-pressed={settings.preferences.powerUnit === value} onClick={() => preference('powerUnit', value)}>{value}</button>)}</div></div>
          <Field label="Rentang waktu grafik default"><select aria-label="Rentang waktu grafik default" value={settings.preferences.range} onChange={event => preference('range', event.target.value)}><option value="1h">1 jam</option><option value="24h">24 jam</option><option value="7d">7 hari</option></select></Field>
          <div className="settings-preference-row"><span>Format waktu</span><div className="settings-segment" role="group" aria-label="Format waktu">{['12', '24'].map(value => <button type="button" key={value} aria-pressed={settings.preferences.timeFormat === value} onClick={() => preference('timeFormat', value)}>{value} jam</button>)}</div></div>
          <Field label="Format tanggal"><select aria-label="Format tanggal" value={settings.preferences.dateFormat} onChange={event => preference('dateFormat', event.target.value)}><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option><option>DD MMM YYYY</option></select></Field>
          <div className="settings-preference-row"><span>Ekspor laporan default</span><div className="settings-segment" role="group" aria-label="Format ekspor laporan"><button type="button" aria-pressed="true" onClick={() => preference('exportFormat', 'CSV')}>CSV</button><button type="button" disabled title="Ekspor PDF belum tersedia">PDF</button></div></div>
        </div>
        <p className="settings-help">Preferensi disimpan lokal sebagai nilai default untuk penggunaan berikutnya. Selain tema, pilihan ini belum diterapkan di halaman lain.</p>
      </section>

      <details className="settings-card settings-system">
        <summary><span>Koneksi Sistem</span><span className="settings-badge">Lanjutan</span><ChevronDown size={18} className="settings-system-chevron" aria-hidden="true" /></summary>
        <p className="settings-help">Konfigurasi lokal saja. Menyimpan tidak membuat koneksi MQTT atau API. Jangan masukkan kredensial.</p>
        <form onSubmit={event => { event.preventDefault(); const cleaned = { broker: connection.broker.trim(), topic: connection.topic.trim(), api: connection.api.trim() }; const error = validateConnection(cleaned); if (error) setNotice({ text: error, error: true }); else if (persist({ ...settings, connection: cleaned }, 'Konfigurasi koneksi disimpan lokal. Tidak ada koneksi jaringan yang dibuat.')) setConnection(cleaned) }}>
          <div className="settings-system-fields"><Field label="URL broker MQTT"><input type="text" placeholder="mqtt://broker:1883" value={connection.broker} onChange={event => setConnection({ ...connection, broker: event.target.value })} /></Field><Field label="Topik MQTT"><input placeholder="powermeter/telemetry" value={connection.topic} onChange={event => setConnection({ ...connection, topic: event.target.value })} /></Field><Field label="URL API"><input type="url" placeholder="https://api.example.com" value={connection.api} onChange={event => setConnection({ ...connection, api: event.target.value })} /></Field></div>
          <button className="settings-primary" type="submit">Simpan Koneksi</button>
        </form>
      </details>
    </div>
    <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-dialog-title"><form onSubmit={submitDevice}>
      <h2 id="settings-dialog-title">{originalId ? 'Edit Perangkat' : 'Tambah Perangkat'}</h2><p className="settings-help">Data lokal saja; tidak menghubungkan perangkat fisik.</p>
      {dialogError && <p className="settings-notice is-error" role="alert">{dialogError}</p>}
      <div className="settings-fields"><Field label="Nama perangkat"><input autoFocus required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></Field><Field label="ID perangkat"><input required maxLength={80} value={draft.id} onChange={event => setDraft({ ...draft, id: event.target.value })} /></Field><Field label="Lokasi"><input required maxLength={160} value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></Field><div className="settings-pair"><Field label="Protokol komunikasi"><select value={draft.protocol} onChange={event => setDraft({ ...draft, protocol: event.target.value as LocalDevice['protocol'] })}><option>MQTT</option><option>HTTP</option></select></Field><Field label="Interval polling (detik)"><input type="number" min="0.01" step="any" required value={Number.isNaN(draft.interval) ? '' : draft.interval} onChange={event => setDraft({ ...draft, interval: event.target.valueAsNumber })} /></Field></div></div>
      <div className="settings-actions"><button className="settings-primary" type="submit">Simpan Perangkat</button><button className="settings-secondary" type="button" onClick={() => dialog.current?.close()}>Batal</button></div>
    </form></dialog>
  </div>
}
