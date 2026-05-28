const PROVIDER_AUTH_TARGETS = {
  gemini: {
    url: 'https://aistudio.google.com/app/apikey',
    label: 'Google Gemini'
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    label: 'OpenAI'
  },
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    label: 'Anthropic Claude'
  },
  openrouter: {
    url: 'https://openrouter.ai/keys',
    label: 'OpenRouter'
  },
  cohere: {
    url: 'https://dashboard.cohere.com/api-keys',
    label: 'Cohere'
  },
  groq: {
    url: 'https://console.groq.com/keys',
    label: 'Groq'
  }
}

const CLIPROXY_AUTH_TARGETS = {
  claude_code: {
    url: 'https://claude.ai/login',
    command: 'cli-proxy-api -claude-login',
    label: 'Claude Code'
  },
  codex: {
    url: 'https://chatgpt.com/auth/login',
    command: 'cli-proxy-api -codex-login',
    label: 'OpenAI Codex'
  },
  antigravity: {
    url: 'https://accounts.google.com/',
    command: 'cli-proxy-api -antigravity-login',
    label: 'Antigravity'
  }
}

export const getProviderAuthTarget = (providerId) => PROVIDER_AUTH_TARGETS[providerId] || null

export const getCliproxyAuthTarget = (mode) =>
  CLIPROXY_AUTH_TARGETS[mode] || CLIPROXY_AUTH_TARGETS.claude_code
