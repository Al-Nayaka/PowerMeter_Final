import assert from 'node:assert/strict'
import test from 'node:test'
import { parseDevices, selectedDevice } from './devices.ts'

test('device list uses real codes, names and explicit online state', () => {
  const devices = parseDevices([{ id: '9007199254740993', device_code: 'PM-ESP32-001', device_name: 'Panel', online: false, is_enabled: true }])
  assert.deepEqual(devices, [{ id: 'PM-ESP32-001', name: 'Panel', online: false, enabled: true }])
  assert.equal(selectedDevice(devices, 'deleted')?.id, 'PM-ESP32-001')
  assert.equal(selectedDevice([], 'pm1'), undefined)
})

test('empty and invalid responses never fall back to demo devices', () => {
  assert.deepEqual(parseDevices([]), [])
  assert.throws(() => parseDevices(null))
  assert.throws(() => parseDevices([{ device_code: 'bad/code', device_name: 'Bad' }]))
  assert.throws(() => parseDevices([{ device_code: 'PM-1', device_name: '' }]))
})

test('disabled devices cannot appear online', () => {
  assert.equal(parseDevices([{ device_code: 'PM-1', device_name: 'Panel', online: true, is_enabled: false }])[0].online, false)
})
