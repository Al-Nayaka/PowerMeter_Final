export interface ReportRow {
  date: string
  watt: number
  peak: number
  trough: number
  voltage: number
  current: number
  pf: number
  energy: number
  cost: number
}

export interface ReportFilters {
  board: string
  start: string
  end: string
  resolution: 'daily' | 'hourly'
}

export const initialReportFilters: ReportFilters = {
  board: 'pm1', start: '2026-10-20', end: '2026-10-26', resolution: 'daily',
}

export const reportSample: readonly ReportRow[] = [
  { date: '2026-10-20', watt: 974, peak: 1412, trough: 435, voltage: 221.3, current: 4.96, pf: .89, energy: 23.372, cost: 33766 },
  { date: '2026-10-21', watt: 908, peak: 1227, trough: 455, voltage: 220.5, current: 4.65, pf: .89, energy: 21.793, cost: 31484 },
  { date: '2026-10-22', watt: 942, peak: 1241, trough: 558, voltage: 221.6, current: 4.86, pf: .87, energy: 22.598, cost: 32648 },
  { date: '2026-10-23', watt: 1029, peak: 1419, trough: 481, voltage: 221.3, current: 5.25, pf: .89, energy: 24.701, cost: 35685 },
  { date: '2026-10-24', watt: 1076, peak: 1573, trough: 642, voltage: 220.3, current: 5.47, pf: .89, energy: 25.836, cost: 37325 },
  { date: '2026-10-25', watt: 1159, peak: 1734, trough: 648, voltage: 219.1, current: 5.91, pf: .90, energy: 27.814, cost: 40183 },
  { date: '2026-10-26', watt: 1050, peak: 1575, trough: 554, voltage: 220.1, current: 5.40, pf: .88, energy: 25.204, cost: 36413 },
]

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value
}

export function validateReportFilters(filters: ReportFilters): string | null {
  if (!validDate(filters.start) || !validDate(filters.end)) return 'Isi tanggal mulai dan akhir yang valid.'
  if (filters.start > filters.end) return 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.'
  return null
}

export function filterReportRows(filters: ReportFilters): ReportRow[] {
  if (validateReportFilters(filters) || filters.board !== 'pm1' || filters.resolution !== 'daily') return []
  return reportSample.filter((row) => row.date >= filters.start && row.date <= filters.end)
}

export function summarizeReport(rows: readonly ReportRow[]) {
  if (!rows.length) return null
  return {
    energy: Number(rows.reduce((sum, row) => sum + row.energy, 0).toFixed(3)),
    cost: rows.reduce((sum, row) => sum + row.cost, 0),
    peak: Math.max(...rows.map((row) => row.peak)),
    trough: Math.min(...rows.map((row) => row.trough)),
    pf: rows.reduce((sum, row) => sum + row.pf, 0) / rows.length,
  }
}

export function csvCell(value: string | number): string {
  const text = String(value)
  const safe = typeof value === 'string' && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function createReportCsv(rows: readonly ReportRow[]): string {
  const headings = ['Tanggal', 'Watt rata-rata (W)', 'Watt peak (W)', 'Watt lembah (W)', 'Volt rata-rata (V)', 'Arus rata-rata (A)', 'PF rata-rata', 'Energi (kWh)', 'Biaya (Rp)']
  const records: (string | number)[][] = rows.map((row) => [row.date, row.watt, row.peak, row.trough, row.voltage, row.current, row.pf, row.energy, row.cost])
  const totals = summarizeReport(rows)
  if (totals) records.push(['Total', '', '', '', '', '', '', totals.energy, totals.cost])
  return '\uFEFF' + [headings, ...records].map((record) => record.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
