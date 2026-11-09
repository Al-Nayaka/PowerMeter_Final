/// <reference types="node" />
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createReportCsv, csvCell, filterReportRows, initialReportFilters, reportSample, summarizeReport, validateReportFilters } from './reports.ts'

test('daily sample is filtered inclusively without invented records', () => {
  assert.equal(filterReportRows(initialReportFilters).length, 7)
  assert.deepEqual(filterReportRows({ ...initialReportFilters, start: '2026-10-21', end: '2026-10-21' }), [reportSample[1]])
  for (const board of ['pm2', 'pm3', 'unknown']) assert.deepEqual(filterReportRows({ ...initialReportFilters, board }), [])
  assert.deepEqual(filterReportRows({ ...initialReportFilters, resolution: 'hourly' }), [])
  assert.deepEqual(filterReportRows({ ...initialReportFilters, start: '2026-11-01', end: '2026-11-05' }), [])
})

test('invalid or reversed dates are rejected', () => {
  for (const start of ['', 'not-a-date', '2026-02-30', '2026-10-27']) {
    assert.ok(validateReportFilters({ ...initialReportFilters, start }))
    assert.deepEqual(filterReportRows({ ...initialReportFilters, start }), [])
  }
  assert.equal(validateReportFilters(initialReportFilters), null)
})

test('summary derives totals and extrema from visible rows', () => {
  assert.deepEqual(summarizeReport(reportSample), { energy: 171.318, cost: 247504, peak: 1734, trough: 435, pf: reportSample.reduce((sum, row) => sum + row.pf, 0) / 7 })
  assert.equal(summarizeReport([]), null)
  assert.equal(summarizeReport([reportSample[1]])?.energy, 21.793)
})

test('CSV exports exact raw values, totals, CRLF and spreadsheet-safe strings', () => {
  const csv = createReportCsv(reportSample)
  assert.ok(csv.startsWith('\uFEFF"Tanggal"'))
  assert.equal(csv.split('\r\n').length, 10)
  assert.ok(csv.includes('"2026-10-20","974","1412","435","221.3","4.96","0.89","23.372","33766"'))
  assert.ok(csv.includes('"171.318","247504"'))
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"')
  assert.equal(csvCell('  @command'), '"\'  @command"')
  assert.equal(csvCell('a,"b"'), '"a,""b"""')
})
