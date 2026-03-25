import type {
  ConfigStudioBootstrapPayload,
  ConfigStudioImportPayload,
  ConfigStudioImportResult,
  ConfigStudioRunPayload,
  ConfigStudioRunResult,
  ConfigStudioRunSession,
  ConfigStudioSavePayload,
  ConfigStudioState,
} from '../types'

const apiBaseUrl = (import.meta.env.VITE_CONFIG_STUDIO_API_BASE_URL || '').replace(/\/$/, '')

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.')
  }
  return payload as T
}

export async function loadConfigStudioState(): Promise<ConfigStudioState> {
  const response = await fetch(`${apiBaseUrl}/api/state`)
  return parseJsonResponse<ConfigStudioState>(response)
}

export async function saveConfigStudioState(
  payload: ConfigStudioSavePayload,
): Promise<ConfigStudioState> {
  const response = await fetch(`${apiBaseUrl}/api/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<ConfigStudioState>(response)
}

export async function bootstrapConfigStudioProject(
  payload: ConfigStudioBootstrapPayload,
): Promise<ConfigStudioState> {
  const response = await fetch(`${apiBaseUrl}/api/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<ConfigStudioState>(response)
}

export async function importConfigStudioSource(
  payload: ConfigStudioImportPayload,
): Promise<ConfigStudioImportResult> {
  const response = await fetch(`${apiBaseUrl}/api/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<ConfigStudioImportResult>(response)
}

export async function runConfigStudioTests(
  payload: ConfigStudioRunPayload,
): Promise<ConfigStudioRunResult> {
  const response = await fetch(`${apiBaseUrl}/api/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<ConfigStudioRunResult>(response)
}

export async function startConfigStudioRunSession(
  payload: ConfigStudioRunPayload,
): Promise<ConfigStudioRunSession> {
  const response = await fetch(`${apiBaseUrl}/api/run/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<ConfigStudioRunSession>(response)
}

export async function getConfigStudioRunSession(
  sessionId: string,
): Promise<ConfigStudioRunSession> {
  const response = await fetch(`${apiBaseUrl}/api/run/${encodeURIComponent(sessionId)}`)
  return parseJsonResponse<ConfigStudioRunSession>(response)
}

export async function stopConfigStudioRunSession(
  sessionId: string,
): Promise<ConfigStudioRunSession> {
  const response = await fetch(`${apiBaseUrl}/api/run/${encodeURIComponent(sessionId)}/stop`, {
    method: 'POST',
  })

  return parseJsonResponse<ConfigStudioRunSession>(response)
}
