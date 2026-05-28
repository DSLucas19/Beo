import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getProviderAuthTarget,
  getCliproxyAuthTarget
} from './authInteractions.js'

test('getProviderAuthTarget returns API key page for major providers', () => {
  assert.deepEqual(getProviderAuthTarget('gemini'), {
    url: 'https://aistudio.google.com/app/apikey',
    label: 'Google Gemini'
  })

  assert.deepEqual(getProviderAuthTarget('openai'), {
    url: 'https://platform.openai.com/api-keys',
    label: 'OpenAI'
  })
})

test('getProviderAuthTarget returns null for custom endpoints', () => {
  assert.equal(getProviderAuthTarget('custom'), null)
})

test('getCliproxyAuthTarget returns app auth session URL and terminal fallback command', () => {
  assert.deepEqual(getCliproxyAuthTarget('claude_code'), {
    url: 'https://claude.ai/login',
    command: 'cli-proxy-api -claude-login',
    label: 'Claude Code'
  })

  assert.equal(getCliproxyAuthTarget('codex').url, 'https://chatgpt.com/auth/login')
  assert.equal(getCliproxyAuthTarget('antigravity').url, 'https://accounts.google.com/')
})
