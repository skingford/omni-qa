<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  cancelClosedLoopRun,
  generateClosedLoopCases,
  getClosedLoopJob,
  getClosedLoopRun,
  listClosedLoopCases,
  listClosedLoopEndpoints,
  listClosedLoopResults,
  listClosedLoopSpecs,
  saveClosedLoopSelection,
  startClosedLoopImport,
  startClosedLoopRun,
} from '../lib/api'
import type {
  ClosedLoopEndpoint,
  ClosedLoopJob,
  ClosedLoopResult,
  ClosedLoopRun,
  ClosedLoopSelection,
  ClosedLoopSpec,
  ClosedLoopTestCase,
} from '../types'

const props = defineProps<{
  defaultEnv: string
}>()

const sourceUrl = ref('https://petstore3.swagger.io/api/v3/openapi.json')
const specs = ref<ClosedLoopSpec[]>([])
const selectedSpecId = ref('')
const endpoints = ref<ClosedLoopEndpoint[]>([])
const selectedEndpointIds = ref<string[]>([])
const cases = ref<ClosedLoopTestCase[]>([])
const results = ref<ClosedLoopResult[]>([])
const selection = ref<ClosedLoopSelection | null>(null)
const importJob = ref<ClosedLoopJob | null>(null)
const generationJob = ref<ClosedLoopJob | null>(null)
const runJob = ref<ClosedLoopJob | null>(null)
const run = ref<ClosedLoopRun | null>(null)
const endpointFilter = ref({ tag: '', method: '', keyword: '' })
const envId = ref(props.defaultEnv || 'dev')
const workers = ref('1')
const status = ref('')
const error = ref('')
const busy = ref(false)
const timers = new Set<number>()

const selectedSpec = computed(() => specs.value.find((spec) => spec.id === selectedSpecId.value))
const endpointTags = computed(() =>
  Array.from(new Set(endpoints.value.flatMap((endpoint) => endpoint.tags))).sort(),
)
const selectedCount = computed(() => selectedEndpointIds.value.length)
const canGenerate = computed(() => Boolean(selectedSpecId.value && selectedEndpointIds.value.length))
const canRun = computed(() => cases.value.length > 0 && !runIsActive.value)
const runIsActive = computed(() => run.value?.status === 'pending' || run.value?.status === 'running')

onMounted(async () => {
  await refreshSpecs()
})

onBeforeUnmount(() => {
  for (const timer of timers) {
    window.clearTimeout(timer)
  }
  timers.clear()
})

watch(
  () => props.defaultEnv,
  (next) => {
    if (next && !envId.value) {
      envId.value = next
    }
  },
)

async function importSpec() {
  error.value = ''
  status.value = ''
  busy.value = true

  try {
    importJob.value = (await startClosedLoopImport(sourceUrl.value.trim())).job
    status.value = 'Import queued'
    const job = await pollJob(importJob.value.id, (next) => {
      importJob.value = next
      status.value = `Import ${next.status}`
    })

    if (job.status !== 'succeeded') {
      throw new Error(job.error || 'Import failed')
    }

    await refreshSpecs()
    const specId = String(job.result?.specId || '')
    if (specId) {
      selectedSpecId.value = specId
      await loadEndpoints()
    }
    status.value = 'Import complete'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function refreshSpecs() {
  specs.value = (await listClosedLoopSpecs()).specs
  if (!selectedSpecId.value && specs.value[0]) {
    selectedSpecId.value = specs.value[0].id
    await loadEndpoints()
  }
}

async function loadEndpoints() {
  if (!selectedSpecId.value) return
  error.value = ''
  endpoints.value = (
    await listClosedLoopEndpoints(selectedSpecId.value, {
      tag: endpointFilter.value.tag || undefined,
      method: endpointFilter.value.method || undefined,
      keyword: endpointFilter.value.keyword || undefined,
    })
  ).endpoints

  const visible = new Set(endpoints.value.map((endpoint) => endpoint.id))
  selectedEndpointIds.value = selectedEndpointIds.value.filter((id) => visible.has(id))
}

function toggleEndpoint(endpointId: string) {
  const selected = new Set(selectedEndpointIds.value)
  if (selected.has(endpointId)) {
    selected.delete(endpointId)
  } else {
    selected.add(endpointId)
  }
  selectedEndpointIds.value = Array.from(selected)
}

function toggleAllVisible() {
  if (selectedEndpointIds.value.length === endpoints.value.length) {
    selectedEndpointIds.value = []
    return
  }
  selectedEndpointIds.value = endpoints.value.map((endpoint) => endpoint.id)
}

async function generateCases() {
  if (!canGenerate.value) return
  error.value = ''
  busy.value = true

  try {
    selection.value = (
      await saveClosedLoopSelection({
        specId: selectedSpecId.value,
        endpointIds: selectedEndpointIds.value,
        name: selectedSpec.value?.title,
      })
    ).selection

    generationJob.value = (
      await generateClosedLoopCases({ selectionId: selection.value.id, useFallback: true })
    ).job
    const job = await pollJob(generationJob.value.id, (next) => {
      generationJob.value = next
      status.value = `Generation ${next.status}`
    })

    if (job.status !== 'succeeded') {
      throw new Error(job.error || 'Generation failed')
    }

    cases.value = (await listClosedLoopCases({ selectionId: selection.value.id })).cases
    status.value = `Generated ${cases.value.length} cases`
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function runCases() {
  if (!canRun.value) return
  error.value = ''
  busy.value = true
  results.value = []

  try {
    const started = await startClosedLoopRun({
      caseIds: cases.value.map((testCase) => testCase.id),
      envId: envId.value || props.defaultEnv || 'dev',
      workers: Number.parseInt(workers.value, 10) || 1,
    })
    runJob.value = started.job
    run.value = started.run

    const finished = await pollRun(started.run.id)
    run.value = finished
    results.value = (await listClosedLoopResults(finished.id)).results
    status.value = `Run ${finished.status}: ${finished.passed}/${finished.total} passed`
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function cancelRun() {
  if (!run.value) return
  run.value = (await cancelClosedLoopRun(run.value.id)).run
}

async function pollJob(jobId: string, onUpdate: (job: ClosedLoopJob) => void): Promise<ClosedLoopJob> {
  while (true) {
    const job = (await getClosedLoopJob(jobId)).job
    onUpdate(job)
    if (job.status !== 'pending' && job.status !== 'running') {
      return job
    }
    await delay(900)
  }
}

async function pollRun(runId: string): Promise<ClosedLoopRun> {
  while (true) {
    const next = (await getClosedLoopRun(runId)).run
    run.value = next
    if (next.status !== 'pending' && next.status !== 'running') {
      return next
    }
    await delay(1200)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      resolve()
    }, ms)
    timers.add(timer)
  })
}
</script>

<template>
  <div class="panel ai-loop-panel">
    <div class="panel-heading">
      <div>
        <span class="section-title">AI Loop</span>
        <h2>OpenAPI closed loop</h2>
      </div>
      <span v-if="status" class="status-pill">{{ status }}</span>
    </div>

    <div v-if="error" class="inline-alert error">{{ error }}</div>

    <div class="grid two">
      <div class="field">
        <label for="ai-loop-source">OpenAPI URL</label>
        <input id="ai-loop-source" v-model="sourceUrl" :disabled="busy" />
      </div>
      <div class="field compact-field">
        <label>&nbsp;</label>
        <button type="button" :disabled="busy || !sourceUrl.trim()" @click="importSpec">
          Import
        </button>
      </div>
    </div>

    <div class="grid three">
      <div class="field">
        <label for="ai-loop-spec">Spec</label>
        <select id="ai-loop-spec" v-model="selectedSpecId" @change="loadEndpoints">
          <option value="">Select spec</option>
          <option v-for="spec in specs" :key="spec.id" :value="spec.id">
            {{ spec.title }} · {{ spec.endpointCount }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="ai-loop-tag">Tag</label>
        <select id="ai-loop-tag" v-model="endpointFilter.tag" @change="loadEndpoints">
          <option value="">All tags</option>
          <option v-for="tag in endpointTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </div>
      <div class="field">
        <label for="ai-loop-keyword">Search</label>
        <input id="ai-loop-keyword" v-model="endpointFilter.keyword" @change="loadEndpoints" />
      </div>
    </div>

    <div class="endpoint-toolbar">
      <button type="button" class="secondary" :disabled="!endpoints.length" @click="toggleAllVisible">
        {{ selectedCount === endpoints.length ? 'Clear' : 'Select visible' }}
      </button>
      <span>{{ selectedCount }} selected</span>
      <button type="button" :disabled="busy || !canGenerate" @click="generateCases">
        Generate cases
      </button>
    </div>

    <div class="endpoint-list">
      <label v-for="endpoint in endpoints" :key="endpoint.id" class="endpoint-row">
        <input
          type="checkbox"
          :checked="selectedEndpointIds.includes(endpoint.id)"
          @change="toggleEndpoint(endpoint.id)"
        />
        <strong>{{ endpoint.method }}</strong>
        <code>{{ endpoint.path }}</code>
        <span>{{ endpoint.summary || endpoint.operationId || endpoint.tags[0] }}</span>
      </label>
      <div v-if="selectedSpecId && !endpoints.length" class="empty-state">No endpoints</div>
    </div>

    <div v-if="cases.length" class="case-runbar">
      <div>
        <strong>{{ cases.length }}</strong>
        <span> generated cases</span>
      </div>
      <div class="run-controls">
        <input v-model="envId" class="short-input" placeholder="env" />
        <input v-model="workers" class="short-input" placeholder="workers" />
        <button type="button" :disabled="busy || !canRun" @click="runCases">Run</button>
        <button v-if="runIsActive" type="button" class="secondary" @click="cancelRun">Cancel</button>
      </div>
    </div>

    <div v-if="run" class="run-summary">
      <span>Status: {{ run.status }}</span>
      <span>Passed: {{ run.passed }}/{{ run.total }}</span>
      <span>Failed: {{ run.failed }}</span>
    </div>

    <div v-if="results.length" class="result-list">
      <div v-for="result in results" :key="result.id" class="result-row" :class="result.status">
        <strong>{{ result.status }}</strong>
        <span>{{ result.caseId }}</span>
        <small>{{ result.durationMs }}ms</small>
      </div>
    </div>

    <div v-if="run?.report" class="report-paths">
      <code v-if="run.report.htmlReportDir">{{ run.report.htmlReportDir }}</code>
      <code v-if="run.report.jsonReportPath">{{ run.report.jsonReportPath }}</code>
    </div>
  </div>
</template>
