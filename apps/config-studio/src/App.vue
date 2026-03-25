<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EnvironmentCard from './components/EnvironmentCard.vue'
import NotificationCard from './components/NotificationCard.vue'
import {
  bootstrapConfigStudioProject,
  importConfigStudioSource,
  loadConfigStudioState,
  saveConfigStudioState,
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
  ConfigStudioState,
  StatusType,
  StudioFormState,
} from './types'

const loading = ref(true)
const saving = ref(false)
const bootstrapping = ref(false)
const importing = ref(false)
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
const paths = ref<ConfigStudioPaths>({
  configPath: '',
  envPath: '',
})
const status = ref<{ message: string; type: StatusType }>({
  message: '',
  type: 'info',
})

const isBusy = computed(() => loading.value || saving.value || bootstrapping.value || importing.value)

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

function setStatus(message: string, type: StatusType = 'success') {
  status.value = { message, type }
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
    return
  }

  form.value = toStudioForm(payload)
  importForm.value.outDir = payload.config.testDir || 'tests/api'
}

async function fetchState(isReload = false) {
  loading.value = true
  setStatus(
    isReload ? 'Reloading configuration from disk...' : 'Loading configuration studio...',
    'info',
  )

  try {
    const payload = await loadConfigStudioState()
    applyState(payload)

    if (payload.mode === 'bootstrap') {
      setStatus('No config detected yet. Choose a starter setup and create the project files.', 'info')
    } else {
      setStatus('Configuration loaded. Adjust the form and save when ready.', 'success')
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
  setStatus('Creating starter project files...', 'info')

  try {
    const payload = await bootstrapConfigStudioProject({
      ...bootstrap.value,
      defaultEnv: bootstrap.value.defaultEnv.trim() || 'dev',
      baseUrl: bootstrap.value.baseUrl.trim(),
    })
    applyState(payload)
    setStatus('Starter files created. You can fine-tune them below and save anytime.', 'success')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    bootstrapping.value = false
  }
}

async function saveState() {
  saving.value = true
  setStatus('Saving configuration...', 'info')

  try {
    const payload = await saveConfigStudioState(buildSavePayload(form.value))
    applyState(payload)
    setStatus('Saved. Config and .env are updated on disk.', 'success')
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
    setStatus('Enter an OpenAPI URL or local file path before importing.', 'error')
    return
  }

  if (!outDir) {
    setStatus('Choose where generated test files should be written.', 'error')
    return
  }

  importing.value = true
  setStatus('Importing OpenAPI document and generating tests...', 'info')

  try {
    importResult.value = await importConfigStudioSource({
      source,
      outDir,
      tags: parseImportTags(importForm.value.tagsText),
      force: importForm.value.force,
    })
    setStatus(
      `Imported ${importResult.value.apiTitle} and generated ${importResult.value.generatedFiles.length} test file(s).`,
      'success',
    )
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  void fetchState(false)
})
</script>

<template>
  <div class="shell">
    <section class="hero">
      <div>
        <h1>omni-qa config studio</h1>
        <p>
          Use this page to bootstrap or edit environments, auth flows, notifications, and secret
          placeholders without hand-editing multiple files.
        </p>
      </div>
      <div class="hero-meta">
        <div class="meta-card">
          <strong>Config file</strong>
          <code>{{ paths.configPath || 'Loading...' }}</code>
        </div>
        <div class="meta-card">
          <strong>Env file</strong>
          <code>{{ paths.envPath || 'Loading...' }}</code>
        </div>
      </div>
    </section>

    <div class="page-actions">
      <button class="secondary" :disabled="isBusy" @click="fetchState(true)">Reload from disk</button>
      <button
        v-if="studioMode === 'bootstrap'"
        class="primary"
        :disabled="isBusy"
        @click="bootstrapProject"
      >
        {{ bootstrapping ? 'Creating project...' : 'Create starter project' }}
      </button>
      <button
        v-else
        class="primary"
        :disabled="isBusy"
        @click="saveState"
      >
        {{ saving ? 'Saving...' : 'Save configuration' }}
      </button>
    </div>

    <div v-if="status.message" class="status" :class="status.type">
      {{ status.message }}
    </div>

    <main>
      <div v-if="loading" class="panel loading-note">Loading configuration studio...</div>

      <template v-else-if="studioMode === 'bootstrap'">
        <div class="panel">
          <div class="toolbar">
            <div>
              <span class="section-title">Bootstrap</span>
              <h2>Create your first omni-qa workspace files</h2>
              <p>
                Pick a sensible starting point, generate the files, then continue tweaking
                everything in the editor.
              </p>
            </div>
          </div>

          <div class="stack">
            <div class="grid two">
              <div class="field">
                <label for="bootstrap-default-env">Default environment</label>
                <input
                  id="bootstrap-default-env"
                  v-model="bootstrap.defaultEnv"
                  placeholder="dev"
                />
              </div>
              <div class="field">
                <label for="bootstrap-base-url">Base URL</label>
                <input
                  id="bootstrap-base-url"
                  v-model="bootstrap.baseUrl"
                  placeholder="https://dev-api.example.com"
                />
              </div>
            </div>

            <div class="field">
              <label for="bootstrap-auth">Authentication scaffold</label>
              <select id="bootstrap-auth" v-model="bootstrap.authMode">
                <option value="none">No auth</option>
                <option value="header">Static auth headers</option>
                <option value="bearer">Login and fetch bearer token</option>
              </select>
              <div class="hint">
                This chooses which starter auth fields and .env placeholders get generated.
              </div>
            </div>

            <div class="toggle-grid">
              <label class="toggle-card">
                <input v-model="bootstrap.includeDingtalk" type="checkbox" />
                <div>
                  <strong>Include DingTalk</strong>
                  <span>Generate a webhook notification block and placeholder.</span>
                </div>
              </label>

              <label class="toggle-card">
                <input v-model="bootstrap.includeEmail" type="checkbox" />
                <div>
                  <strong>Include email</strong>
                  <span>Generate SMTP notification config and env placeholders.</span>
                </div>
              </label>

              <label class="toggle-card">
                <input v-model="bootstrap.createEnvFile" type="checkbox" />
                <div>
                  <strong>Create local .env</strong>
                  <span>Uncheck this if you only want `.env.example` at bootstrap time.</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="panel">
          <span class="section-title">Preview</span>
          <h2>What the studio will create</h2>
          <div class="command-list">
            <code>{{ bootstrapCommandPreview }}</code>
          </div>

          <div class="checklist">
            <div><strong>Files</strong></div>
            <div><code>omni-qa.config.ts</code>, <code>.env.example</code>, <code>playwright.config.ts</code></div>
            <div><strong>Folders</strong></div>
            <div><code>tests/api</code>, <code>reports</code></div>
            <div><strong>Optional</strong></div>
            <div>
              <template v-if="bootstrap.createEnvFile">
                Also creates <code>.env</code> if it is missing.
              </template>
              <template v-else>
                Skips <code>.env</code> creation for now.
              </template>
            </div>
          </div>

          <div class="panel panel-embedded">
            <span class="section-title">Then</span>
            <h2>Next commands</h2>
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
              <span class="section-title">General</span>
              <h2>Project defaults</h2>
              <p>Choose the primary environment and where tests and reports should live.</p>
            </div>
          </div>

          <div class="stack">
            <div class="grid three">
              <div class="field">
                <label for="default-env">Default environment</label>
                <select id="default-env" v-model="form.defaultEnv">
                  <option
                    v-for="env in form.envs"
                    :key="`${env.id}-default`"
                    :value="env.name"
                  >
                    {{ env.name || 'env' }}
                  </option>
                </select>
              </div>
              <div class="field">
                <label for="test-dir">Test directory</label>
                <input id="test-dir" v-model="form.testDir" />
              </div>
              <div class="field">
                <label for="report-dir">Report directory</label>
                <input id="report-dir" v-model="form.reportDir" />
              </div>
            </div>

            <div class="field">
              <label for="global-headers">Global headers</label>
              <textarea
                id="global-headers"
                v-model="form.globalHeadersText"
                placeholder="Content-Type=application/json&#10;Accept=application/json"
              ></textarea>
              <div class="hint">
                One header per line. Use either <code>key=value</code> or <code>key: value</code>.
              </div>
            </div>

            <div class="panel panel-embedded">
              <div class="toolbar">
                <div>
                  <span class="section-title">Environments</span>
                  <h2>Targets and authentication</h2>
                  <p>Each environment can have its own base URL, headers, and auth workflow.</p>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" @click="addEnvironment">Add environment</button>
                </div>
              </div>

              <div v-if="!form.envs.length" class="empty-note">
                No environments yet. Add one to point omni-qa at a target API.
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
                  <span class="section-title">Notifications</span>
                  <h2>Alerts after a test run</h2>
                  <p>Wire up DingTalk or email channels for automated results.</p>
                </div>
                <div class="actions">
                  <button type="button" class="secondary" @click="addNotification">Add notification</button>
                </div>
              </div>

              <div v-if="!form.notifications.length" class="empty-note">
                No notification channels configured. Add DingTalk or email when you want push alerts.
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
              <label for="env-text">Environment variables (.env)</label>
              <textarea
                id="env-text"
                v-model="form.envText"
                style="min-height: 220px;"
                placeholder="API_KEY=...&#10;USERNAME=...&#10;PASSWORD=..."
              ></textarea>
              <div class="hint">
                The values here are saved into <code>.env</code>. Keep secrets referenced from the config instead of hardcoding them.
              </div>
            </div>
          </div>
        </div>

        <div class="side-stack">
          <div class="panel">
            <span class="section-title">Import</span>
            <h2>Generate tests from OpenAPI</h2>
            <div class="stack">
              <div class="field">
                <label for="import-source">Source URL or file path</label>
                <input
                  id="import-source"
                  v-model="importForm.source"
                  placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                />
              </div>

              <div class="field">
                <label for="import-out-dir">Output directory</label>
                <input
                  id="import-out-dir"
                  v-model="importForm.outDir"
                  placeholder="tests/api"
                />
              </div>

              <div class="field">
                <label for="import-tags">Filter tags</label>
                <textarea
                  id="import-tags"
                  v-model="importForm.tagsText"
                  style="min-height: 96px;"
                  placeholder="users, orders"
                ></textarea>
                <div class="hint">
                  Optional. Separate multiple tags with commas or new lines.
                </div>
              </div>

              <label class="toggle-card compact">
                <input v-model="importForm.force" type="checkbox" />
                <div>
                  <strong>Overwrite generated files</strong>
                  <span>Use this when you want to regenerate files that already exist.</span>
                </div>
              </label>

              <button class="primary" :disabled="isBusy" @click="importFromSource">
                {{ importing ? 'Generating tests...' : 'Import and generate tests' }}
              </button>

              <div v-if="importResult" class="result-card">
                <div class="result-summary">
                  <strong>{{ importResult.apiTitle }}</strong>
                  <span>v{{ importResult.apiVersion }} · {{ importResult.endpointCount }} endpoints</span>
                </div>
                <div class="checklist compact">
                  <div><strong>Output</strong></div>
                  <div><code>{{ importResult.outDir }}</code></div>
                  <div><strong>Generated</strong></div>
                  <div>{{ importResult.generatedFiles.length }} file(s)</div>
                </div>

                <div v-if="importResult.groups.length" class="result-list">
                  <div class="section-title">Groups</div>
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
                  <div class="section-title">Files</div>
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
            <span class="section-title">Runbook</span>
            <h2>Next commands</h2>
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
      Tip: keep this terminal open while the studio is running. Press Ctrl+C to stop the local server.
    </div>
  </div>
</template>
