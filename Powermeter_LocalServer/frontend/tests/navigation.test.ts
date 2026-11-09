import assert from 'node:assert/strict'
import test from 'node:test'
import { pageFromHash, pageHash } from '../src/navigation.ts'

test('all dashboard pages can be opened directly', () => {
  for (const page of ['live', 'comparison', 'reports', 'settings'] as const) {
    assert.equal(pageFromHash(pageHash(page)), page)
  }
})

test('unknown and empty hashes fall back to live monitoring', () => {
  assert.equal(pageFromHash('#unknown'), 'live')
  assert.equal(pageFromHash(''), 'live')
})
