import type {
  ConfigStudioBootstrapPayload,
  ConfigStudioImportPayload,
  ConfigStudioImportResult,
  ConfigStudioRunPayload,
  ConfigStudioRunResult,
  ConfigStudioRunSession,
  ConfigStudioSavePayload,
  ConfigStudioState,
  ClosedLoopEndpoint,
  ClosedLoopJob,
  ClosedLoopResult,
  ClosedLoopRun,
  ClosedLoopSelection,
  ClosedLoopSpec,
  ClosedLoopTestCase,
} from '../types'
import { t } from './i18n'

const apiBaseUrl = (import.meta.env.VITE_CONFIG_STUDIO_API_BASE_URL || '').replace(/\/$/, '')

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.error || t('status.requestFailed'))
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

export async function startClosedLoopImport(sourceUrl: string): Promise<{ job: ClosedLoopJob }> {
  const response = await fetch(`${apiBaseUrl}/api/openapi/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl }),
  })
  return parseJsonResponse<{ job: ClosedLoopJob }>(response)
}

export async function getClosedLoopJob(jobId: string): Promise<{ job: ClosedLoopJob }> {
  const response = await fetch(`${apiBaseUrl}/api/jobs/${encodeURIComponent(jobId)}`)
  return parseJsonResponse<{ job: ClosedLoopJob }>(response)
}

export async function listClosedLoopSpecs(): Promise<{ specs: ClosedLoopSpec[] }> {
  const response = await fetch(`${apiBaseUrl}/api/specs`)
  return parseJsonResponse<{ specs: ClosedLoopSpec[] }>(response)
}

export async function listClosedLoopEndpoints(
  specId: string,
  filter: { tag?: string; method?: string; keyword?: string } = {},
): Promise<{ endpoints: ClosedLoopEndpoint[] }> {
  const params = new URLSearchParams()
  if (filter.tag) params.append('tag', filter.tag)
  if (filter.method) params.append('method', filter.method)
  if (filter.keyword) params.set('keyword', filter.keyword)
  const qs = params.toString()
  const response = await fetch(
    `${apiBaseUrl}/api/specs/${encodeURIComponent(specId)}/endpoints${qs ? `?${qs}` : ''}`,
  )
  return parseJsonResponse<{ endpoints: ClosedLoopEndpoint[] }>(response)
}

export async function saveClosedLoopSelection(payload: {
  specId: string
  endpointIds: string[]
  name?: string
}): Promise<{ selection: ClosedLoopSelection }> {
  const response = await fetch(`${apiBaseUrl}/api/selections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse<{ selection: ClosedLoopSelection }>(response)
}

export async function generateClosedLoopCases(payload: {
  selectionId?: string
  specId?: string
  endpointIds?: string[]
  useFallback?: boolean
}): Promise<{ job: ClosedLoopJob }> {
  const response = await fetch(`${apiBaseUrl}/api/test-cases/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse<{ job: ClosedLoopJob }>(response)
}

export async function listClosedLoopCases(filter: {
  specId?: string
  endpointId?: string
  selectionId?: string
}): Promise<{ cases: ClosedLoopTestCase[] }> {
  const params = new URLSearchParams()
  if (filter.specId) params.set('specId', filter.specId)
  if (filter.endpointId) params.set('endpointId', filter.endpointId)
  if (filter.selectionId) params.set('selectionId', filter.selectionId)
  const qs = params.toString()
  const response = await fetch(`${apiBaseUrl}/api/test-cases${qs ? `?${qs}` : ''}`)
  return parseJsonResponse<{ cases: ClosedLoopTestCase[] }>(response)
}

export async function startClosedLoopRun(payload: {
  caseIds: string[]
  envId: string
  workers?: number
}): Promise<{ job: ClosedLoopJob; run: ClosedLoopRun }> {
  const response = await fetch(`${apiBaseUrl}/api/test-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseJsonResponse<{ job: ClosedLoopJob; run: ClosedLoopRun }>(response)
}

export async function getClosedLoopRun(runId: string): Promise<{ run: ClosedLoopRun }> {
  const response = await fetch(`${apiBaseUrl}/api/test-runs/${encodeURIComponent(runId)}`)
  return parseJsonResponse<{ run: ClosedLoopRun }>(response)
}

export async function listClosedLoopResults(runId: string): Promise<{ results: ClosedLoopResult[] }> {
  const response = await fetch(`${apiBaseUrl}/api/test-runs/${encodeURIComponent(runId)}/results`)
  return parseJsonResponse<{ results: ClosedLoopResult[] }>(response)
}

export async function cancelClosedLoopRun(runId: string): Promise<{ run: ClosedLoopRun }> {
  const response = await fetch(`${apiBaseUrl}/api/test-runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
  })
  return parseJsonResponse<{ run: ClosedLoopRun }>(response)
}
