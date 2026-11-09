export interface ChartPill {
  label: string
  time: string
  value: string
}

export interface ChartConfig {
  id: string
  title: string
  unit: string
  color: string
  current: string
  ticks: string[]
  min: number
  max: number
  data: number[]
  peak: ChartPill
  trough: ChartPill
}

const wattData = [
  1457, 1449, 1449, 1376, 1423, 1360, 1372, 1403, 1419, 1493, 1502, 1481,
  1469, 1516, 1447, 1364, 1459, 1306, 1033, 938, 928, 805, 894, 908, 753,
  747, 795, 795, 904, 912, 985, 948, 952, 906, 874, 821, 821, 839, 815,
  918, 971, 1393, 1080, 1168, 1310, 1423, 1514, 1520, 1548, 1594, 1582,
  1538, 1500, 1493,
]

const voltageData = [
  223, 222.7, 222.5, 223.3, 223.9, 223.8, 222.5, 223.8, 223.8, 223.5,
  223.5, 224.1, 223, 223.1, 222.7, 223.7, 222.4, 222.5, 223.5, 221.7,
  222.2, 221.2, 221, 221.6, 221.6, 221.9, 221.5, 220.3, 220.3, 218.7,
  218.7, 219.6, 218.9, 218.9, 218.6, 217.6, 217.4, 216.9, 217.4, 216.7,
  217.3, 216.9, 217.7, 217.1, 216.1, 216.6, 216.9, 216.8, 216.8, 216,
  217.4, 217, 217.4, 217.1,
]

const currentData = [
  7.1, 7.1, 6.7, 6.9, 6.6, 6.6, 6.7, 6.8, 7.1, 7.2, 7.1, 7, 7.3, 7,
  6.5, 6.9, 6.1, 4.8, 4.3, 4.3, 3.7, 4.2, 4.2, 3.5, 3.4, 3.7, 3.7,
  4.3, 4.3, 4.7, 4.5, 4.5, 4.4, 4.3, 4, 4, 4.1, 4, 4.5, 4.8, 6.9,
  5.3, 5.8, 6.4, 7, 7.4, 7.4, 7.5, 7.7, 7.7, 7.4, 7.2, 7.2,
]

export const charts: ChartConfig[] = [
  {
    id: 'watt',
    title: 'Watt',
    unit: 'W',
    color: '#F2AC2E',
    current: '1.488',
    ticks: ['1.808', '1.377', '946', '516'],
    min: 516,
    max: 1808,
    data: wattData,
    peak: { label: 'Watt peak', time: '22.17.00', value: '1.592 W' },
    trough: { label: 'Watt lembah', time: '22.16.50', value: '731 W' },
  },
  {
    id: 'voltage',
    title: 'Voltage',
    unit: 'V',
    color: '#F0806C',
    current: '217,0',
    ticks: ['226,3', '222,0', '217,8', '213,5'],
    min: 213.5,
    max: 226.3,
    data: voltageData,
    peak: { label: 'Voltage peak', time: '22.16.50', value: '224,2 V' },
    trough: { label: 'Voltage lembah', time: '22.17.00', value: '215,6 V' },
  },
  {
    id: 'arus',
    title: 'Arus',
    unit: 'A',
    color: '#6EA2F5',
    current: '7,17',
    ticks: ['8,80', '6,63', '4,45', '2,28'],
    min: 2.28,
    max: 8.8,
    data: currentData,
    peak: { label: 'Current peak', time: '22.16.50', value: '7,77 A' },
    trough: { label: 'Current lembah', time: '22.16.50', value: '3,37 A' },
  },
]

export const meters = [
  { id: 'pm1', name: 'Power Meter 1', online: true },
  { id: 'pm2', name: 'Power Meter 2', online: true },
  { id: 'pm3', name: 'Power Meter 3', online: false },
]

/* ------------------------------------------------------------------ */
/* Power comparison                                                    */
/* ------------------------------------------------------------------ */

export type CompareMetricId =
  | 'watt'
  | 'voltage'
  | 'arus'
  | 'powerFactor'
  | 'reactive'
  | 'energy'

export interface CompareMetric {
  id: CompareMetricId
  label: string
  title: string
  unit: string
  ticks: string[]
  min: number
  max: number
}

export const compareMetrics: CompareMetric[] = [
  {
    id: 'watt',
    label: 'Watt',
    title: 'Watt',
    unit: 'W',
    ticks: ['1.760', '1.424', '1.088', '752', '416'],
    min: 416,
    max: 1760,
  },
  {
    id: 'voltage',
    label: 'Voltage',
    title: 'Voltage',
    unit: 'V',
    ticks: ['235,8', '228,4', '221,0', '213,6'],
    min: 213.6,
    max: 235.8,
  },
  {
    id: 'arus',
    label: 'Arus',
    title: 'Arus',
    unit: 'A',
    ticks: ['8,80', '6,63', '4,45', '2,28'],
    min: 2.28,
    max: 8.8,
  },
  {
    id: 'powerFactor',
    label: 'Power factor',
    title: 'Power factor',
    unit: '',
    ticks: ['1,00', '0,95', '0,90', '0,85'],
    min: 0.85,
    max: 1,
  },
  {
    id: 'reactive',
    label: 'Daya reaktif',
    title: 'Daya reaktif',
    unit: 'VAR',
    ticks: ['800', '600', '400', '200', '0'],
    min: 0,
    max: 800,
  },
  {
    id: 'energy',
    label: 'Energi',
    title: 'Energi',
    unit: 'kWh',
    ticks: ['1,20', '0,90', '0,60', '0,30', '0,00'],
    min: 0,
    max: 1.2,
  },
]

export interface MeterSeries {
  watt: number[]
  voltage: number[]
  arus: number[]
  powerFactor: number[]
  reactive: number[]
  energy: number[]
}

export interface MeterSummary {
  energy: number
  cost: number
  pf: number
}

export const meterSummaries: Record<string, MeterSummary> = {
  pm1: { energy: 0.94, cost: 1410, pf: 0.95 },
  pm2: { energy: 0.67, cost: 1005, pf: 0.97 },
  pm3: { energy: 0.52, cost: 780, pf: 0.91 },
}

const compareWattA = [
  1030, 1120, 1210, 1300, 1380, 1430, 1470, 1490, 1462, 1444, 1466, 1480,
  1442, 1408, 1414, 1388, 1362, 1384, 1348, 1312, 1272, 1244, 1266, 1232,
  1192, 1150, 1110, 1064, 1020, 968, 916, 858, 788, 720, 680, 702, 742,
  802, 872, 952, 1032, 1112, 1190, 1252, 1312, 1344, 1300, 1340, 1360,
  1330, 1356, 1370, 1332, 1358, 1310,
]

const compareWattB = [
  1300, 1250, 1150, 1060, 960, 880, 800, 740, 680, 640, 600, 580, 560, 590,
  620, 590, 560, 585, 570, 540, 520, 495, 520, 485, 460, 490, 520, 560,
  610, 660, 720, 780, 850, 920, 990, 1060, 1120, 1165, 1120, 1070, 1010,
  950, 890, 850, 880, 830, 790, 745, 710, 680, 650, 620, 600, 570, 550,
]

function makeVoltageSeries(
  count: number,
  base: number,
  amplitude: number,
  phase: number,
) {
  return Array.from({ length: count }, (_, index) => {
    const value =
      base +
      amplitude * Math.sin(index / 5.2 + phase) +
      amplitude * 0.5 * Math.sin(index / 2.6 + phase * 1.6) +
      amplitude * 0.22 * Math.sin(index / 1.3 + phase * 0.7)
    return Number(value.toFixed(1))
  })
}

const compareVoltageA = makeVoltageSeries(compareWattA.length, 222.6, 3.8, 0.6)
const compareVoltageB = makeVoltageSeries(compareWattB.length, 221.4, 3.2, 2.4)

function makePfSeries(count: number, base: number, amplitude: number, phase: number) {
  return Array.from({ length: count }, (_, index) => {
    const value =
      base +
      amplitude * Math.sin(index / 4.1 + phase) +
      amplitude * 0.45 * Math.sin(index / 2.3 + phase * 1.7)
    return Number(Math.min(0.995, Math.max(0.86, value)).toFixed(3))
  })
}

function makeCurrent(watt: number[], voltage: number[]) {
  return watt.map((value, index) =>
    Number(Math.max(2.3, value / voltage[index]).toFixed(2)),
  )
}

function makeReactive(watt: number[], powerFactor: number[]) {
  return watt.map((value, index) => {
    const apparent = value / powerFactor[index]
    return Math.round(Math.sqrt(Math.max(0, apparent * apparent - value * value)))
  })
}

function makeEnergy(watt: number[], total: number) {
  const sum = watt.reduce((acc, value) => acc + value, 0)
  let running = 0
  return watt.map((value) => {
    running += value
    return Number(((running / sum) * total).toFixed(3))
  })
}

function makeSeries(
  watt: number[],
  voltage: number[],
  powerFactor: number[],
  totalEnergy: number,
): MeterSeries {
  return {
    watt,
    voltage,
    arus: makeCurrent(watt, voltage),
    powerFactor,
    reactive: makeReactive(watt, powerFactor),
    energy: makeEnergy(watt, totalEnergy),
  }
}

function scaleSeries(values: number[], factor: number, offset = 0) {
  return values.map((value) => Number((value * factor + offset).toFixed(2)))
}

const pfA = makePfSeries(compareWattA.length, 0.945, 0.02, 0.4)
const pfB = makePfSeries(compareWattB.length, 0.965, 0.012, 1.2)
const pfC = makePfSeries(compareWattA.length, 0.905, 0.018, 2.1)

export const comparisonSeries: Record<string, MeterSeries> = {
  pm1: makeSeries(compareWattA, compareVoltageA, pfA, meterSummaries.pm1.energy),
  pm2: makeSeries(compareWattB, compareVoltageB, pfB, meterSummaries.pm2.energy),
  pm3: makeSeries(
    scaleSeries(compareWattA, 0.74),
    scaleSeries(compareVoltageA, 1, -0.7),
    pfC,
    meterSummaries.pm3.energy,
  ),
}
