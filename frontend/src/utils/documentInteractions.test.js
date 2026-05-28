import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeDocumentName,
  formatBytes
} from './documentInteractions.js'

test('normalizeDocumentName trims and strips unsafe path characters', () => {
  assert.equal(normalizeDocumentName(' ../Company Plan.md '), 'Company_Plan.md')
})

test('normalizeDocumentName adds markdown extension when missing', () => {
  assert.equal(normalizeDocumentName('POLICY'), 'POLICY.md')
})

test('normalizeDocumentName keeps common text document extensions', () => {
  assert.equal(normalizeDocumentName('notes.txt'), 'notes.txt')
  assert.equal(normalizeDocumentName('table.csv'), 'table.csv')
})

test('formatBytes returns readable file sizes', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(2 * 1024 * 1024), '2 MB')
})
