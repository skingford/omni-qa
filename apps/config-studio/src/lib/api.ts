import type { ConfigStudioSavePayload, ConfigStudioState } from '../types'

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
