import { useState } from 'react'
import { meters } from '../data'
import { createReportCsv, filterReportRows, initialReportFilters, summarizeReport, validateReportFilters, type ReportFilters } from '../reports'
import './ReportsPage.css'

const number = (value: number, digits = 0) => value.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
const exportUnavailable = 'Ekspor ini belum tersedia karena backend belum terhubung. Gunakan CSV untuk data contoh.'

export function ReportsPage() {
  const [draft, setDraft] = useState<ReportFilters>({ ...initialReportFilters })
  const [applied, setApplied] = useState<ReportFilters>({ ...initialReportFilters })
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rows = filterReportRows(applied)
  const totals = summarizeReport(rows)
  const peakDay = rows.find((row) => row.peak === totals?.peak)
  const troughDay = rows.find((row) => row.trough === totals?.trough)
  const boardName = meters.find((meter) => meter.id === applied.board)?.name ?? applied.board
  const summaryCards = [
    { label: 'Total energi', value: totals ? number(totals.energy, 2) : '—', unit: 'kWh', tone: 'neutral', note: `${rows.length} hari, per hari` },
    { label: 'Total biaya', value: totals ? `Rp${number(totals.cost)}` : '—', unit: '', tone: 'neutral', note: 'Biaya dari data contoh' },
    { label: 'Watt peak', value: totals ? number(totals.peak) : '—', unit: 'W', tone: 'yellow', note: peakDay ? dateLabel(peakDay.date) : 'Tidak ada data' },
    { label: 'Watt lembah', value: totals ? number(totals.trough) : '—', unit: 'W', tone: 'blue', note: troughDay ? dateLabel(troughDay.date) : 'Tidak ada data' },
    { label: 'Rata-rata power factor', value: totals ? number(totals.pf, 2) : '—', unit: '', tone: 'neutral', note: totals ? (totals.pf >= 0.85 ? 'Baik (di atas 0,85)' : 'Di bawah 0,85') : 'Tidak ada data' },
  ]

  function exportCsv() {
    if (!rows.length) return
    const blob = new Blob([createReportCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `laporan-data-contoh-${applied.board}-${applied.start}-${applied.end}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setAnnouncement('CSV data contoh telah disiapkan untuk diunduh.')
  }

  return (
    <div className="reports-page">
      <header className="reports-heading">
        <h1>Laporan</h1>
        <p>Pilih board dan periode, lihat ringkasannya, lalu ekspor datanya.</p>
      </header>

      <form className="reports-filters" noValidate onSubmit={(event) => {
        event.preventDefault()
        const message = validateReportFilters(draft)
        setError(message)
        if (message) return
        setApplied({ ...draft })
        setAnnouncement(`${filterReportRows(draft).length} baris data contoh ditampilkan.`)
      }}>
        <label className="reports-field reports-board">Board
          <select value={draft.board} onChange={(event) => setDraft({ ...draft, board: event.target.value })}>
            {meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name}</option>)}
          </select>
        </label>
        <label className="reports-field">Tanggal mulai
          <input type="date" required value={draft.start} aria-invalid={!!error} aria-describedby={error ? 'reports-filter-error' : undefined} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
        </label>
        <label className="reports-field">Tanggal akhir
          <input type="date" required value={draft.end} aria-invalid={!!error} aria-describedby={error ? 'reports-filter-error' : undefined} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
        </label>
        <fieldset className="reports-resolution">
          <legend>Resolusi</legend>
          <div className="reports-chips">
            {(['daily', 'hourly'] as const).map((resolution) => <button key={resolution} type="button" aria-pressed={draft.resolution === resolution} onClick={() => setDraft({ ...draft, resolution })}>{resolution === 'daily' ? 'Per hari' : 'Per jam'}</button>)}
          </div>
        </fieldset>
        <button className="reports-apply" type="submit">Tampilkan</button>
        {error && <p className="reports-error" id="reports-filter-error" role="alert">{error} Hasil sebelumnya tetap ditampilkan.</p>}
      </form>

      <div className="reports-source"><span>Data contoh</span><p>Hanya Power Meter 1 · per hari · 20–26 Oktober 2026. Backend belum terhubung.</p></div>
      <section className="reports-summaries" aria-label="Ringkasan laporan">
        {summaryCards.map((card) => <article className={`reports-summary reports-tone-${card.tone}`} key={card.label}>
          <h2>{card.label}</h2><p>{card.value}{totals && card.unit && <small> {card.unit}</small>}</p>
          <span className="reports-summary-note">{card.note}</span>
        </article>)}
      </section>

      <section className="reports-results" aria-labelledby="reports-table-heading">
        <header className="reports-results-header">
          <div><h2 id="reports-table-heading">Rincian laporan</h2><p>{boardName} · {dateLabel(applied.start)} – {dateLabel(applied.end)} · {applied.resolution === 'daily' ? 'Per hari' : 'Per jam'}</p></div>
          <div className="reports-export" aria-label="Ekspor laporan">
            <button type="button" disabled={!rows.length} onClick={exportCsv}>Ekspor CSV</button>
            <span tabIndex={0} className="reports-disabled-export" title={exportUnavailable} aria-label={`Ekspor XLSX. ${exportUnavailable}`}><button type="button" disabled>Ekspor XLSX</button><span className="reports-tooltip" role="tooltip">{exportUnavailable}</span></span>
            <span tabIndex={0} className="reports-disabled-export" title={exportUnavailable} aria-label={`Ekspor PDF. ${exportUnavailable}`}><button type="button" disabled>Ekspor PDF</button><span className="reports-tooltip" role="tooltip">{exportUnavailable}</span></span>
          </div>
        </header>
        <div className="reports-table-scroll" tabIndex={0} role="region" aria-label="Tabel laporan; geser horizontal untuk seluruh kolom">
          <table>
            <caption>Data contoh · {boardName} · {rows.length} baris</caption>
            <thead><tr>{['Tanggal', 'Watt rata-rata (W)', 'Watt peak (W)', 'Watt lembah (W)', 'Volt rata-rata (V)', 'Arus rata-rata (A)', 'PF rata-rata', 'Energi (kWh)', 'Biaya (Rp)'].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.date}><th scope="row">{dateLabel(row.date)}</th><td>{number(row.watt)}</td><td className="reports-peak">{number(row.peak)}</td><td className="reports-trough">{number(row.trough)}</td><td>{number(row.voltage, 1)}</td><td>{number(row.current, 2)}</td><td>{number(row.pf, 2)}</td><td>{number(row.energy, 3)}</td><td>{number(row.cost)}</td></tr>)}</tbody>
            {totals && <tfoot><tr><th scope="row">Total / ringkasan</th><td></td><td>{number(totals.peak)}</td><td>{number(totals.trough)}</td><td></td><td></td><td>{number(totals.pf, 2)}</td><td>{number(totals.energy, 3)}</td><td>{number(totals.cost)}</td></tr></tfoot>}
          </table>
        </div>
        {!rows.length && <div className="reports-empty"><h3>Data contoh tidak tersedia</h3><p>{applied.board !== 'pm1' ? 'Board ini belum memiliki data contoh.' : applied.resolution === 'hourly' ? 'Sampel per jam belum tersedia.' : 'Tidak ada sampel dalam periode ini.'} Backend belum terhubung. Pilih Power Meter 1, resolusi per hari, dan periode 20–26 Oktober 2026.</p></div>}
        <p className="reports-table-note">Data contoh, bukan pembacaan langsung. Biaya mengikuti nilai sampel; total dihitung dari baris yang ditampilkan. XLSX dan PDF belum tersedia tanpa backend.</p>
      </section>
      <p className="reports-sr-only" role="status">{announcement}</p>
    </div>
  )
}
