import type {
  BootstrapFormState,
  ConfigStudioSavePayload,
  ConfigStudioEditorState,
  EnvFormItem,
  NotificationFormItem,
  StudioFormState,
} from '../types'

let idCounter = 0

function createId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function createEmptyForm(): StudioFormState {
  return {
    defaultEnv: '',
    testDir: 'tests/api',
    reportDir: 'reports',
    globalHeadersText: '',
    envs: [],
    notifications: [],
    envText: '',
  }
}

export function createBootstrapForm(): BootstrapFormState {
  return {
    defaultEnv: 'dev',
    baseUrl: 'https://dev-api.example.com',
    authMode: 'header',
    includeDingtalk: true,
    includeEmail: true,
    createEnvFile: true,
  }
}

export function normalizeEnvText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trimEnd()
  return normalized ? `${normalized}\n` : ''
}

export function recordToText(record?: Record<string, unknown>): string {
  return Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n')
}

export function parseRecordText(value: string): Record<string, string> {
  const result: Record<string, string> = {}

  value
    .split(/\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }

      const separatorIndex = trimmed.includes('=') ? trimmed.indexOf('=') : trimmed.indexOf(':')
      if (separatorIndex === -1) {
        return
      }

      const key = trimmed.slice(0, separatorIndex).trim()
      const recordValue = trimmed.slice(separatorIndex + 1).trim()
      if (key) {
        result[key] = recordValue
      }
    })

  return result
}

function parseLooseValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === 'true') {
    return true
  }
  if (trimmed === 'false') {
    return false
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }
  return trimmed
}

function parseLooseRecordText(value: string): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parseRecordText(value)).map(([key, raw]) => [key, parseLooseValue(raw)]),
  )
}

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function createEnvForm(name: string, env: ConfigStudioEditorState['config']['envs'][string]): EnvFormItem {
  const authType = env.auth?.type ?? 'none'
  const login = authType === 'bearer' ? env.auth.login : undefined

  return {
    id: createId('env'),
    name,
    baseURL: env.baseURL ?? '',
    headersText: recordToText(env.headers),
    authType,
    authHeadersText: authType === 'header' ? recordToText(env.auth.headers) : '',
    loginUrl: login?.url ?? '',
    loginMethod: login?.method === 'GET' ? 'GET' : 'POST',
    tokenPath: login?.tokenPath ?? '',
    loginBodyText: recordToText(login?.body),
  }
}

function createNotificationForm(
  notify: NonNullable<ConfigStudioEditorState['config']['notify']>[number],
): NotificationFormItem {
  if (notify.type === 'email') {
    return {
      id: createId('notify'),
      type: 'email',
      webhook: '',
      recipientsText: (notify.to ?? []).join(', '),
      smtpHost: notify.smtp.host ?? '',
      smtpPort: String(notify.smtp.port ?? 465),
      smtpSecure: notify.smtp.secure ? 'true' : 'false',
      smtpUser: notify.smtp.user ?? '',
      smtpPass: notify.smtp.pass ?? '',
    }
  }

  return {
    id: createId('notify'),
    type: 'dingtalk',
    webhook: notify.webhook ?? '',
    recipientsText: '',
    smtpHost: '',
    smtpPort: '465',
    smtpSecure: 'true',
    smtpUser: '',
    smtpPass: '',
  }
}

export function toStudioForm(state: ConfigStudioEditorState): StudioFormState {
  const envEntries = Object.entries(state.config.envs ?? {})

  return {
    defaultEnv: state.config.defaultEnv ?? envEntries[0]?.[0] ?? '',
    testDir: state.config.testDir ?? 'tests/api',
    reportDir: state.config.reportDir ?? 'reports',
    globalHeadersText: recordToText(state.config.globalHeaders),
    envs: envEntries.map(([name, env]) => createEnvForm(name, env)),
    notifications: (state.config.notify ?? []).map((notify) => createNotificationForm(notify)),
    envText: state.envText ?? '',
  }
}

function ensureUniqueName(baseName: string, usedNames: Set<string>): string {
  let finalName = baseName
  let suffix = 2

  while (usedNames.has(finalName)) {
    finalName = `${baseName}-${suffix}`
    suffix += 1
  }

  usedNames.add(finalName)
  return finalName
}

export function buildSavePayload(form: StudioFormState): ConfigStudioSavePayload {
  const envs: ConfigStudioSavePayload['config']['envs'] = {}
  const usedNames = new Set<string>()

  form.envs.forEach((env, index) => {
    const fallbackName = `env${index + 1}`
    const finalName = ensureUniqueName(env.name.trim() || fallbackName, usedNames)
    const envConfig: ConfigStudioSavePayload['config']['envs'][string] = {
      baseURL: env.baseURL.trim(),
    }

    const headers = parseRecordText(env.headersText)
    if (Object.keys(headers).length > 0) {
      envConfig.headers = headers
    }

    if (env.authType === 'header') {
      envConfig.auth = {
        type: 'header',
        headers: parseRecordText(env.authHeadersText),
      }
    }

    if (env.authType === 'bearer') {
      const body = parseLooseRecordText(env.loginBodyText)
      envConfig.auth = {
        type: 'bearer',
        login: {
          url: env.loginUrl.trim(),
          method: env.loginMethod === 'GET' ? 'GET' : 'POST',
          tokenPath: env.tokenPath.trim(),
          ...(Object.keys(body).length > 0 ? { body } : {}),
        },
      }
    }

    envs[finalName] = envConfig
  })

  const notifications = form.notifications.map((notify) => {
    if (notify.type === 'email') {
      return {
        type: 'email' as const,
        smtp: {
          host: notify.smtpHost.trim(),
          port: Number(notify.smtpPort || '465'),
          secure: notify.smtpSecure === 'true',
          user: notify.smtpUser.trim(),
          pass: notify.smtpPass.trim(),
        },
        to: splitList(notify.recipientsText),
      }
    }

    return {
      type: 'dingtalk' as const,
      webhook: notify.webhook.trim(),
    }
  })

  const envNames = Object.keys(envs)
  const requestedDefaultEnv = form.defaultEnv.trim()
  const config: ConfigStudioSavePayload['config'] = {
    defaultEnv: envNames.includes(requestedDefaultEnv) ? requestedDefaultEnv : (envNames[0] ?? ''),
    envs,
  }

  const globalHeaders = parseRecordText(form.globalHeadersText)
  if (Object.keys(globalHeaders).length > 0) {
    config.globalHeaders = globalHeaders
  }

  if (notifications.length > 0) {
    config.notify = notifications
  }

  if (form.testDir.trim()) {
    config.testDir = form.testDir.trim()
  }

  if (form.reportDir.trim()) {
    config.reportDir = form.reportDir.trim()
  }

  return {
    config,
    envText: normalizeEnvText(form.envText),
  }
}

export function createSuggestedEnvName(envs: EnvFormItem[]): string {
  const existing = new Set(envs.map((env) => env.name.trim()).filter(Boolean))
  const candidates = ['dev', 'staging', 'prod']

  for (const candidate of candidates) {
    if (!existing.has(candidate)) {
      return candidate
    }
  }

  let counter = existing.size + 1
  while (existing.has(`env${counter}`)) {
    counter += 1
  }
  return `env${counter}`
}

export function createBlankEnvironment(name = ''): EnvFormItem {
  return {
    id: createId('env'),
    name,
    baseURL: '',
    headersText: '',
    authType: 'none',
    authHeadersText: '',
    loginUrl: '',
    loginMethod: 'POST',
    tokenPath: '',
    loginBodyText: '',
  }
}

export function createBlankNotification(): NotificationFormItem {
  return {
    id: createId('notify'),
    type: 'dingtalk',
    webhook: '',
    recipientsText: '',
    smtpHost: '',
    smtpPort: '465',
    smtpSecure: 'true',
    smtpUser: '',
    smtpPass: '',
  }
}
