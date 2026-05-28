import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMentionItems,
  getMentionQuery,
  insertMention,
  getRecipientOptions,
  getRecipientLabel
} from './chatInteractions.js'

test('buildMentionItems combines workspace and project files without duplicates', () => {
  const items = buildMentionItems(
    [{ path: 'AIM.md' }, { path: 'OPERATIONS.md' }],
    [{ path: 'AIM.md' }, { path: 'PRODUCT.md' }]
  )

  assert.deepEqual(items, [
    { label: 'AIM.md', source: 'Company Documents' },
    { label: 'OPERATIONS.md', source: 'Company Documents' },
    { label: 'PRODUCT.md', source: 'Project Files' }
  ])
})

test('getMentionQuery returns the active query before the caret', () => {
  assert.deepEqual(getMentionQuery('Please read @AIM and reply', 16), {
    active: true,
    query: 'AIM',
    start: 12,
    end: 16
  })
})

test('getMentionQuery ignores spaces after at sign', () => {
  assert.deepEqual(getMentionQuery('Please read @AIM now', 20), {
    active: false,
    query: '',
    start: -1,
    end: 20
  })
})

test('insertMention replaces the active query and returns a new caret', () => {
  const result = insertMention('Please read @AI today', 15, 'AIM.md')

  assert.deepEqual(result, {
    text: 'Please read @AIM.md today',
    caret: 20
  })
})

test('getRecipientOptions includes available departments only once', () => {
  const options = getRecipientOptions(['dep_planning', 'dep_engineering', 'dep_planning'])

  assert.deepEqual(options.map(option => option.tab), [
    'secretary_chat',
    'dep_planning',
    'dep_engineering'
  ])
})

test('getRecipientLabel formats known tabs for compact display', () => {
  assert.equal(getRecipientLabel('secretary_chat'), 'Secretary')
  assert.equal(getRecipientLabel('dep_finance_legal'), 'Finance Legal')
})
