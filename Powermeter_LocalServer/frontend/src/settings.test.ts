import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultLimits, defaultSettings, initialDevices, loadLocal, parseDevices, parseSettings, saveLocal, validateConnection, validateDevice, validateLimits } from './settings.ts'

test('untrusted settings preserve typed defaults and reject invalid ranges', () => {
  const result = parseSettings({ limits: { minVoltage: 300, maxVoltage: 100 }, notifications: { power: true, mqtt: 'false' }, preferences: { range: 'forever', powerUnit: 'kW' } })
  assert.deepEqual(result.limits, defaultLimits)
  assert.equal(result.notifications.power, true)
  assert.equal(result.notifications.mqtt, true)
  assert.equal(result.preferences.range, '24h')
  assert.equal(result.preferences.powerUnit, 'kW')
  assert.deepEqual(parseSettings(null), defaultSettings)
})

test('defaults are independent between parsing calls', () => {
  const result = parseSettings(undefined)
  result.notifications.power = true
  assert.equal(parseSettings(undefined).notifications.power, false)
})

test('electrical validation rejects zero, infinity, NaN and reversed voltages', () => {
  for (const value of [0, -1, Infinity, NaN]) assert.ok(validateLimits({ ...defaultLimits, maxCurrent: value }))
  assert.ok(validateLimits({ ...defaultLimits, minVoltage: 231 }))
  assert.equal(validateLimits(defaultLimits), '')
})

test('device validation enforces names, IDs, and positive intervals', () => {
  const devices = initialDevices()
  assert.equal(validateDevice(devices[0], devices, devices[0].id), '')
  assert.ok(validateDevice({ ...devices[0], id: 'pm-001' }, devices))
  assert.ok(validateDevice({ ...devices[0], id: 'unique', name: 'power meter 1' }, devices))
  assert.ok(validateDevice({ ...devices[0], interval: 0 }, [], undefined))
  assert.ok(validateDevice({ ...devices[0], name: ' ' }, []))
})

test('malformed or duplicated device lists use imported meter defaults', () => {
  assert.deepEqual(parseDevices([{ id: 'untrusted' }]), initialDevices())
  assert.deepEqual(parseDevices([initialDevices()[0], initialDevices()[0]]), initialDevices())
  assert.deepEqual(parseDevices(initialDevices()), initialDevices())
})

test('connection validation accepts blank configuration and rejects credentials', () => {
  assert.equal(validateConnection({ broker: '', topic: '', api: '' }), '')
  assert.equal(validateConnection({ broker: 'mqtts://example.com:8883', topic: 'meter/1', api: 'https://example.com' }), '')
  assert.ok(validateConnection({ broker: 'mqtt://user:secret@example.com', topic: '', api: '' }))
  assert.ok(validateConnection({ broker: '', topic: 'meter/#', api: '' }))
  assert.ok(validateConnection({ broker: '', topic: '', api: 'javascript:alert(1)' }))
})

test('storage helpers report malformed JSON and unavailable storage honestly', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{broken', setItem: () => { throw new Error('Quota exceeded') } } })
    const loaded = loadLocal('test', parseSettings)
    assert.deepEqual(loaded.value, defaultSettings)
    assert.ok(loaded.error)
    assert.ok(saveLocal('test', defaultSettings))
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
