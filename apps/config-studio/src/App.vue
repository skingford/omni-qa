<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EnvironmentCard from './components/EnvironmentCard.vue'
import NotificationCard from './components/NotificationCard.vue'
import { locale, localeChoices, setLocale, t } from './lib/i18n'
import {
  bootstrapConfigStudioProject,
  getConfigStudioRunSession,
  importConfigStudioSource,
  loadConfigStudioState,
  saveConfigStudioState,
  startConfigStudioRunSession,
  stopConfigStudioRunSession,
} from './lib/api'
import {
  buildSavePayload,
  createBlankEnvironment,
  createBlankNotification,
  createBootstrapForm,
  createEmptyForm,
  createSuggestedEnvName,
  toStudioForm,
} from './lib/config-form'
import type {
  BootstrapFormState,
  ConfigStudioImportResult,
  ConfigStudioPaths,
  ConfigStudioRunSession,
  ConfigStudioState,
  ReportPreviewState,
  StatusType,
  StudioFormState,
} from './types'

const loading = ref(true)
const saving = ref(false)
const bootstrapping = ref(false)
const importing = ref(false)
const running = ref(false)
const stoppingRun = ref(false)
const studioMode = ref<ConfigStudioState['mode']>('editor')
const form = ref<StudioFormState>(createEmptyForm())
const bootstrap = ref<BootstrapFormState>(createBootstrapForm())
const importForm = ref({
  source: '',
  outDir: 'tests/api',
  tagsText: '',
  force: false,
})
const importResult = ref<ConfigStudioImportResult | null>(null)
const runForm = ref({
  env: '',
  tag: '',
  retry: '0',
  trace: false,
  headed: false,
  workers: '',
})
const runSession = ref<ConfigStudioRunSession | null>(null)
const reportState = ref<ReportPreviewState | null>(null)
const paths = ref<ConfigStudioPaths>({
  configPath: '',
  envPath: '',
})
const status = ref<{ message: string; type: StatusType }>({
  message: '',
  type: 'info',
})

const pageBusy = computed(
  () =>
    loading.value ||
    saving.value ||
    bootstrapping.value ||
    importing.value ||
    running.value ||
    stoppingRun.value,
)

const runButtonDisabled = computed(
  () =>
    loading.value ||
    saving.value ||
    bootstrapping.value ||
    importing.value ||
    running.value ||
    stoppingRun.value,
)

const canStopRun = computed(() => runSession.value?.status === 'running')

const effectiveDefaultEnv = computed(() => {
  if (studioMode.value === 'bootstrap') {
    return bootstrap.value.defaultEnv.trim() || 'dev'
  }

  const configured = form.value.defaultEnv.trim()
  if (configured) {
    return configured
  }
  return form.value.envs[0]?.name.trim() || 'dev'
})

const bootstrapCommandPreview = computed(() => {
  const command = ['omni-qa init']

  if (bootstrap.value.defaultEnv.trim() && bootstrap.value.defaultEnv.trim() !== 'dev') {
    command.push(`--default-env ${bootstrap.value.defaultEnv.trim()}`)
  }

  if (bootstrap.value.baseUrl.trim()) {
    command.push(`--base-url ${bootstrap.value.baseUrl.trim()}`)
  }

  if (bootstrap.value.authMode !== 'header') {
    command.push(`--auth ${bootstrap.value.authMode}`)
  }

  if (!bootstrap.value.includeDingtalk) {
    command.push('--no-dingtalk')
  }

  if (!bootstrap.value.includeEmail) {
    command.push('--no-email')
  }

  if (!bootstrap.value.createEnvFile) {
    command.push('--skip-env')
  }

  return command.join(' ')
})

const activeRunStatusLabel = computed(() => {
  if (!runSession.value) {
    return ''
  }

  if (runSession.value.status === 'running') {
    return t('run.liveInProgress')
  }

  if (runSession.value.status === 'cancelled') {
    return t('run.latestCancelled')
  }

  return runSession.value.success ? t('run.latestPassed') : t('run.latestFailed')
})

const localeModel = computed({
  get: () => locale.value,
  set: (value: string) => {
    setLocale(value as typeof locale.value)
  },
})

const languageOptions = computed(() =>
  localeChoices.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  })),
)

let runPollTimer: number | undefined

function setStatus(message: string, type: StatusType = 'success') {
  status.value = { message, type }
}

function clearRunPollTimer() {
  if (runPollTimer !== undefined) {
    window.clearTimeout(runPollTimer)
    runPollTimer = undefined
  }
}

function applyState(payload: ConfigStudioState) {
  studioMode.value = payload.mode
  paths.value = payload.paths ?? { configPath: '', envPath: '' }

  if (payload.mode === 'bootstrap') {
    bootstrap.value = {
      ...createBootstrapForm(),
      ...payload.bootstrap,
    }
    form.value = createEmptyForm()
    reportState.value = null
    runSession.value = null
    return
  }

  form.value = toStudioForm(payload)
  importForm.value.outDir = payload.config.testDir || 'tests/api'
  runForm.value.env = payload.config.defaultEnv || Object.keys(payload.config.envs ?? {})[0] || ''
  reportState.value = payload.report
}

async function fetchState(isReload = false) {
  loading.value = true
  setStatus(
    isReload ? t('status.reloading') : t('status.loadingStudio'),
    'info',
  )

  try {
    const payload = await loadConfigStudioState()
    applyState(payload)

    if (payload.mode === 'bootstrap') {
      setStatus(t('status.noConfig'), 'info')
    } else {
      setStatus(t('status.configLoaded'), 'success')
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    loading.value = false
  }
}

function addEnvironment() {
  const name = createSuggestedEnvName(form.value.envs)
  form.value.envs.push(createBlankEnvironment(name))
  if (!form.value.defaultEnv) {
    form.value.defaultEnv = name
  }
}

function removeEnvironment(index: number) {
  const [removed] = form.value.envs.splice(index, 1)
  if (removed?.name === form.value.defaultEnv) {
    form.value.defaultEnv = form.value.envs[0]?.name ?? ''
  }
}

function addNotification() {
  form.value.notifications.push(createBlankNotification())
}

function removeNotification(index: number) {
  form.value.notifications.splice(index, 1)
}

async function bootstrapProject() {
  bootstrapping.value = true
  setStatus(t('status.creatingStarter'), 'info')

  try {
    const payload = await bootstrapConfigStudioProject({
      ...bootstrap.value,
      defaultEnv: bootstrap.value.defaultEnv.trim() || 'dev',
      baseUrl: bootstrap.value.baseUrl.trim(),
    })
    applyState(payload)
    setStatus(t('status.starterCreated'), 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    bootstrapping.value = false
  }
}

async function saveState() {
  saving.value = true
  setStatus(t('status.savingConfig'), 'info')

  try {
    const payload = await saveConfigStudioState(buildSavePayload(form.value))
    applyState(payload)
    setStatus(t('status.saved'), 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    saving.value = false
  }
}

function parseImportTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  )
}

async function importFromSource() {
  const source = importForm.value.source.trim()
  const outDir = importForm.value.outDir.trim()

  if (!source) {
    setStatus(t('status.importSourceRequired'), 'error')
    return
  }

  if (!outDir) {
    setStatus(t('status.importOutDirRequired'), 'error')
    return
  }

  importing.value = true
  setStatus(t('status.importing'), 'info')

  try {
    importResult.value = await importConfigStudioSource({
      source,
      outDir,
      tags: parseImportTags(importForm.value.tagsText),
      force: importForm.value.force,
    })
    setStatus(
      t('status.imported', {
        title: importResult.value.apiTitle,
        count: importResult.value.generatedFiles.length,
      }),
      'success',
    )
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    importing.value = false
  }
}

async function runTests() {
  const env = runForm.value.env.trim()

  clearRunPollTimer()
  running.value = true
  stoppingRun.value = false
  setStatus(t('status.startingRun'), 'info')

  try {
    runSession.value = await startConfigStudioRunSession({
      env: env || undefined,
      tag: runForm.value.tag.trim() || undefined,
      retry: runForm.value.retry,
      trace: runForm.value.trace,
      headed: runForm.value.headed,
      workers: runForm.value.workers.trim() || undefined,
    })

    if (runSession.value.report) {
      reportState.value = runSession.value.report
    }

    if (runSession.value.status === 'running') {
      setStatus(t('status.runStarted'), 'info')
      scheduleRunPoll(runSession.value.id)
      return
    }

    finalizeRunSession(runSession.value)
  } catch (error) {
    clearRunPollTimer()
    setStatus(error instanceof Error ? error.message : String(error), 'error')
    running.value = false
    stoppingRun.value = false
  } finally {
    if (!runSession.value || runSession.value.status !== 'running') {
      running.value = false
    }
  }
}

async function stopActiveRun() {
  if (!runSession.value || runSession.value.status !== 'running') {
    return
  }

  stoppingRun.value = true
  setStatus(t('status.stoppingRun'), 'info')

  try {
    const snapshot = await stopConfigStudioRunSession(runSession.value.id)
    runSession.value = snapshot

    if (snapshot.report) {
      reportState.value = snapshot.report
    }

    if (snapshot.status === 'running') {
      scheduleRunPoll(snapshot.id)
      return
    }

    finalizeRunSession(snapshot)
  } catch (error) {
    stoppingRun.value = false
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

function scheduleRunPoll(sessionId: string) {
  clearRunPollTimer()
  runPollTimer = window.setTimeout(() => {
    void pollRunSession(sessionId)
  }, 800)
}

async function pollRunSession(sessionId: string) {
  try {
    const snapshot = await getConfigStudioRunSession(sessionId)
    runSession.value = snapshot

    if (snapshot.report) {
      reportState.value = snapshot.report
    }

    if (snapshot.status === 'running') {
      scheduleRunPoll(sessionId)
      return
    }

    finalizeRunSession(snapshot)
  } catch (error) {
    clearRunPollTimer()
    running.value = false
    stoppingRun.value = false
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

function finalizeRunSession(session: ConfigStudioRunSession) {
  clearRunPollTimer()
  running.value = false
  stoppingRun.value = false
  setStatus(
    session.status === 'cancelled'
      ? t('status.runCancelled')
      : session.success
        ? t('status.runSucceeded')
        : t('status.runFailed', { exitCode: session.exitCode ?? 1 }),
    session.status === 'cancelled'
      ? 'info'
      : session.success
        ? 'success'
        : 'error',
  )
}

onMounted(() => {
  void fetchState(false)
})

onBeforeUnmount(() => {
  clearRunPollTimer()
})
</script>

<template>
  <div class="shell">
    <section class="hero">
      <div>
        <h1>{{ t('hero.title') }}</h1>
        <p>{{ t('hero.description') }}</p>
      </div>
      <div class="hero-meta">
        <div class="meta-card">
          <strong>{{ t('hero.configFile') }}</strong>
          <code>{{ paths.configPath || t('common.loading') }}</code>
        </div>
        <div class="meta-card">
          <strong>{{ t('hero.envFile') }}</strong>
          <code>{{ paths.envPath || t('common.loading') }}</code>
        </div>
      </div>
    </section>

    <div class="page-actions">
      <div class="page-actions-left">
        <label class="locale-control" for="locale-select">
          <span>{{ t('language.label') }}</span>
          <select id="locale-select" v-model="localeModel">
            <option
              v-for="option in languageOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <button class="secondary" :disabled="pageBusy" @click="fetchState(true)">
          {{ t('actions.reload') }}
        </button>
      </div>
      <button
        v-if="studioMode === 'bootstrap'"
        class="primary"
        :disabled="pageBusy"
        @click="bootstrapProject"
      >
        {{ bootstrapping ? t('actions.creatingProject') : t('actions.createProject') }}
      </button>
      <button
        v-else
        class="primary"
        :disabled="pageBusy"
        @click="saveState"
      >
        {{ saving ? t('actions.saving') : t('actions.saveConfig') }}
      </button>
    </div>

    <div v-if="status.message" class="status" :class="status.type">
      {{ status.message }}
    </div>

    <main>
      <div v-if="loading" class="panel loading-note">{{ t('status.loadingStudio') }}</div>

      <template v-else-if="studioMode === 'bootstrap'">
        <div class="panel">
          <div class="toolbar">
            <div>
              <span class="section-title">{{ t('bootstrap.section') }}</span>
              <h2>{{ t('bootstrap.title') }}</h2>
              <p>{{ t('bootstrap.description') }}</p>
            </div>
          </div>

          <div class="stack">
            <div class="grid two">
              <div class="field">
                <label for="bootstrap-default-env">{{ t('bootstrap.defaultEnvironment') }}</label>
                <input
                  id="bootstrap-default-env"
                  v-model="bootstrap.defaultEnv"
                  placeholder="dev"
                />
              </div>
              <div class="field">
                <label for="bootstrap-base-url">{{ t('bootstrap.baseUrl') }}</label>
                <input
                  id="bootstrap-base-url"
                  v-model="bootstrap.baseUrl"
                  placeholder="https://dev-api.example.com"
                />
              </div>
            </div>

            <div class="field">
              <label for="bootstrap-auth">{{ t('bootstrap.authScaffold') }}</label>
              <select id="bootstrap-auth" v-model="bootstrap.authMode">
                <option value="none">{{ t('bootstrap.noAuth') }}</option>
                <option value="header">{{ t('bootstrap.staticAuthHeaders') }}</option>
                <option value="bearer">{{ t('bootstrap.loginBearer') }}</option>
              </select>
              <div class="hint" v-html="t('bootstrap.authScaffoldHint')"></div>
            </div>

            <div class="toggle-grid">
              <label class="toggle-card">
                <input v-model="bootstrap.includeDingtalk" type="checkbox" />
                <div>
                  <strong>{{ t('bootstrap.includeDingtalk') }}</strong>
                  <span>{{ t('bootstrap.includeDingtalkHint') }}</span>
                </div>
              </label>

              <label class="toggle-card">
                <input v-model="bootstrap.includeEmail" type="checkbox" />
                <div>
                  <strong>{{ t('bootstrap.includeEmail') }}</strong>
                  <span>{{ t('bootstrap.includeEmailHint') }}</span>
                </div>
              </label>

              <label class="toggle-card">
                <input v-model="bootstrap.createEnvFile" type="checkbox" />
                <div>
                  <strong>{{ t('bootstrap.createEnvFile') }}</strong>
                  <span>{{ t('bootstrap.createEnvFileHint') }}</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="panel">
          <span class="section-title">{{ t('bootstrap.preview') }}</span>
          <h2>{{ t('bootstrap.previewTitle') }}</h2>
          <div class="command-list">
            <code>{{ bootstrapCommandPreview }}</code>
          </div>

          <div class="checklist">
            <div><strong>{{ t('common.files') }}</strong></div>
            <div><code>omni-qa.config.ts</code>, <code>.env.example</code>, <code>playwright.config.ts</code></div>
            <div><strong>{{ t('common.folders') }}</strong></div>
            <div><code>tests/api</code>, <code>reports</code></div>
            <div><strong>{{ t('common.optional') }}</strong></div>
            <div>
              <template v-if="bootstrap.createEnvFile">
                <span v-html="t('bootstrap.createsEnv')"></span>
              </template>
              <template v-else>
                <span v-html="t('bootstrap.skipsEnv')"></span>
              </template>
            </div>
          </div>

          <div class="panel panel-embedded">
            <span class="section-title">{{ t('bootstrap.then') }}</span>
            <h2>{{ t('bootstrap.nextCommands') }}</h2>
            <div class="command-list">
              <code>bun run dev -- import https://your-api.example.com/openapi.json</code>
              <code>bun run dev -- run --env {{ effectiveDefaultEnv }}</code>
              <code>bun run dev -- report</code>
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="panel">
          <div class="toolbar">
            <div>
              <span class="section-title">{{ t('general.section') }}</span>
              <h2>{{ t('general.title') }}</h2>
              <p>{{ t('general.description') }}</p>
            </div>
          </div>

          <div class="stack">
            <div class="grid three">
              <div class="field">
                <label for="default-env">{{ t('general.defaultEnvironment') }}</label>
                <select id="default-env" v-model="form.defaultEnv">
                  <option
                    v-for="env in form.envs"
                    :key="`${env.id}-default`"
                    :value="env.name"
                  >
                    {{ env.name || t('common.envFallback') }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label for="test-dir">{{ t('general.testDirectory') }}</label>
                <input id="test-dir" v-model="form.testDir" />
              </div>
              <div class="field">
                <label for="report-dir">{{ t('general.reportDirectory') }}</label>
                <input id="report-dir" v-model="form.reportDir" />
              </div>
            </div>

            <div class="field">
              <label for="global-headers">{{ t('general.globalHeaders') }}</label>
              <textarea
                id="global-headers"
                v-model="form.globalHeadersText"
                placeholder="Content-Type=application/json&#10;Accept=application/json"
              ></textarea>
              <div class="hint" v-html="t('general.globalHeadersHint')"></div>
            </div>

            <div class="panel panel-embedded">
              <div class="toolbar">
                <div>
                  <span class="section-title">{{ t('environments.section') }}</span>
                  <h2>{{ t('environments.title') }}</h2>
                  <p>{{ t('environments.description') }}</p>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" @click="addEnvironment">
                    {{ t('environments.add') }}
                  </button>
                </div>
              </div>

              <div v-if="!form.envs.length" class="empty-note">
                {{ t('environments.empty') }}
              </div>

              <div v-else class="stack">
                <EnvironmentCard
                  v-for="(env, index) in form.envs"
                  :key="env.id"
                  :env="env"
                  :index="index"
                  @remove="removeEnvironment"
                />
              </div>
            </div>

            <div class="panel panel-embedded">
              <div class="toolbar">
                <div>
                  <span class="section-title">{{ t('notifications.section') }}</span>
                  <h2>{{ t('notifications.title') }}</h2>
                  <p>{{ t('notifications.description') }}</p>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" @click="addNotification">
                    {{ t('notifications.add') }}
                  </button>
                </div>
              </div>

              <div v-if="!form.notifications.length" class="empty-note">
                {{ t('notifications.empty') }}
              </div>

              <div v-else class="stack">
                <NotificationCard
                  v-for="(notify, index) in form.notifications"
                  :key="notify.id"
                  :notify="notify"
                  :index="index"
                  @remove="removeNotification"
                />
              </div>
            </div>

            <div class="field">
              <label for="env-text">{{ t('general.envVars') }}</label>
              <textarea
                id="env-text"
                v-model="form.envText"
                style="min-height: 220px;"
                placeholder="API_KEY=...&#10;USERNAME=...&#10;PASSWORD=..."
              ></textarea>
              <div class="hint" v-html="t('general.envVarsHint')"></div>
            </div>
          </div>
        </div>

        <div class="side-stack">
          <div class="panel">
            <span class="section-title">{{ t('import.section') }}</span>
            <h2>{{ t('import.title') }}</h2>
            <div class="stack">
              <div class="field">
                <label for="import-source">{{ t('import.source') }}</label>
                <input
                  id="import-source"
                  v-model="importForm.source"
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                />
              </div>

              <div class="field">
                <label for="import-out-dir">{{ t('import.outDir') }}</label>
                <input
                  id="import-out-dir"
                  v-model="importForm.outDir"
                  placeholder="tests/api"
                />
              </div>

              <div class="field">
                <label for="import-tags">{{ t('import.filterTags') }}</label>
                <textarea
                  id="import-tags"
                  v-model="importForm.tagsText"
                  style="min-height: 96px;"
                  placeholder="users, orders"
                ></textarea>
                <div class="hint">{{ t('import.filterTagsHint') }}</div>
              </div>

              <label class="toggle-card compact">
                <input v-model="importForm.force" type="checkbox" />
                <div>
                  <strong>{{ t('import.overwrite') }}</strong>
                  <span>{{ t('import.overwriteHint') }}</span>
                </div>
              </label>

              <button class="primary" :disabled="pageBusy" @click="importFromSource">
                {{ importing ? t('import.importingButton') : t('import.importButton') }}
              </button>

              <div v-if="importResult" class="result-card">
                <div class="result-summary">
                  <strong>{{ importResult.apiTitle }}</strong>
                  <span>
                    v{{ importResult.apiVersion }} ·
                    {{ t('result.endpoints', { count: importResult.endpointCount }) }}
                  </span>
                </div>
                <div class="checklist compact">
                  <div><strong>{{ t('common.outputDirectory') }}</strong></div>
                  <div><code>{{ importResult.outDir }}</code></div>
                  <div><strong>{{ t('common.generated') }}</strong></div>
                  <div>{{ t('common.fileCount', { count: importResult.generatedFiles.length }) }}</div>
                </div>

                <div v-if="importResult.groups.length" class="result-list">
                  <div class="section-title">{{ t('common.groups') }}</div>
                  <div class="pill-list">
                    <span
                      v-for="group in importResult.groups"
                      :key="group.name"
                      class="pill"
                    >
                      {{ group.name }} ({{ group.endpoints }})
                    </span>
                  </div>
                </div>

                <div v-if="importResult.generatedFiles.length" class="result-list">
                  <div class="section-title">{{ t('common.files') }}</div>
                  <code
                    v-for="file in importResult.generatedFiles"
                    :key="file"
                    class="file-chip"
                  >
                    {{ file }}
                  </code>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <span class="section-title">{{ t('run.section') }}</span>
            <h2>{{ t('run.title') }}</h2>
            <div class="stack">
              <div class="grid two">
                <div class="field">
                  <label for="run-env">{{ t('run.environment') }}</label>
                  <select id="run-env" v-model="runForm.env">
                    <option
                      v-for="env in form.envs"
                      :key="`${env.id}-run`"
                      :value="env.name"
                    >
                      {{ env.name || t('common.envFallback') }}
                    </option>
                  </select>
                </div>

                <div class="field">
                  <label for="run-tag">{{ t('run.tagFilter') }}</label>
                  <input id="run-tag" v-model="runForm.tag" placeholder="@pet" />
                </div>
              </div>

              <div class="grid three">
                <div class="field">
                  <label for="run-retry">{{ t('run.retries') }}</label>
                  <input id="run-retry" v-model="runForm.retry" type="number" min="0" />
                </div>

                <div class="field">
                  <label for="run-workers">{{ t('run.workers') }}</label>
                  <input id="run-workers" v-model="runForm.workers" type="number" min="1" placeholder="auto" />
                </div>

                <div class="toggle-stack">
                  <label class="toggle-card compact">
                    <input v-model="runForm.trace" type="checkbox" />
                    <div>
                      <strong>{{ t('run.trace') }}</strong>
                      <span v-html="t('run.traceHint')"></span>
                    </div>
                  </label>

                  <label class="toggle-card compact">
                    <input v-model="runForm.headed" type="checkbox" />
                    <div>
                      <strong>{{ t('run.headed') }}</strong>
                      <span>{{ t('run.headedHint') }}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div class="run-actions">
                <button class="primary" :disabled="runButtonDisabled" @click="runTests">
                  {{ running ? t('run.runningButton') : t('run.runButton') }}
                </button>
                <button
                  v-if="canStopRun"
                  class="secondary"
                  :disabled="stoppingRun"
                  @click="stopActiveRun"
                >
                  {{ stoppingRun ? t('run.stoppingButton') : t('run.stopButton') }}
                </button>
                <a
                  v-if="reportState?.available && reportState.reportUrl"
                  class="button-link"
                  :href="reportState.reportUrl"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ t('run.openReport') }}
                </a>
              </div>

              <div v-if="runSession" class="result-card">
                <div class="result-summary">
                  <strong>{{ activeRunStatusLabel }}</strong>
                  <span>
                    <template v-if="runSession.exitCode !== null">
                      {{ t('run.exit') }} {{ runSession.exitCode }} ·
                    </template>
                    {{ Math.round(runSession.durationMs / 100) / 10 }}s ·
                    <code>{{ runSession.command }}</code>
                  </span>
                </div>

                <div class="checklist compact">
                  <div><strong>{{ t('common.reportDirectory') }}</strong></div>
                  <div><code>{{ reportState?.htmlDir || 'reports/html' }}</code></div>
                </div>

                <div v-if="runSession.output" class="result-list">
                  <div class="section-title">
                    {{ runSession.status === 'running' ? t('run.liveOutput') : t('common.output') }}
                  </div>
                  <pre class="log-output">{{ runSession.output }}</pre>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <span class="section-title">{{ t('runbook.section') }}</span>
            <h2>{{ t('runbook.title') }}</h2>
            <div class="command-list">
              <code>bun run dev -- import https://your-api.example.com/openapi.json</code>
              <code>bun run dev -- run --env {{ effectiveDefaultEnv }}</code>
              <code>bun run dev -- report</code>
            </div>
          </div>
        </div>
      </template>
    </main>

    <div class="footer-note">
      {{ t('runbook.footer') }}
    </div>
  </div>
</template>
