<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EnvironmentCard from './components/EnvironmentCard.vue'
import NotificationCard from './components/NotificationCard.vue'
import { loadConfigStudioState, saveConfigStudioState } from './lib/api'
import {
  buildSavePayload,
  createBlankEnvironment,
  createBlankNotification,
  createEmptyForm,
  createSuggestedEnvName,
  toStudioForm,
} from './lib/config-form'
import type { ConfigStudioPaths, StatusType, StudioFormState } from './types'

const loading = ref(true)
const saving = ref(false)
const form = ref<StudioFormState>(createEmptyForm())
const paths = ref<ConfigStudioPaths>({
  configPath: '',
  envPath: '',
})
const status = ref<{ message: string; type: StatusType }>({
  message: '',
  type: 'success',
})

const effectiveDefaultEnv = computed(() => {
  const configured = form.value.defaultEnv.trim()
  if (configured) {
    return configured
  }
  return form.value.envs[0]?.name.trim() || 'dev'
})

function setStatus(message: string, type: StatusType = 'success') {
  status.value = { message, type }
}

function applyState(payload: Awaited<ReturnType<typeof loadConfigStudioState>>) {
  form.value = toStudioForm(payload)
  paths.value = payload.paths ?? { configPath: '', envPath: '' }
}

async function fetchState(isReload = false) {
  loading.value = true
  setStatus(isReload ? 'Reloading configuration from disk...' : 'Loading configuration studio...')

  try {
    const payload = await loadConfigStudioState()
    applyState(payload)
    setStatus('Configuration loaded. Adjust the form and save when ready.', 'success')
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

async function saveState() {
  saving.value = true
  setStatus('Saving configuration...')

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
          Use this page to edit environments, auth flows, notifications, and secret placeholders
          without hand-editing multiple files.
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
      <button class="secondary" :disabled="loading || saving" @click="fetchState(true)">Reload from disk</button>
      <button class="primary" :disabled="loading || saving" @click="saveState">
        {{ saving ? 'Saving...' : 'Save configuration' }}
      </button>
    </div>

    <div v-if="status.message" class="status" :class="status.type">
      {{ status.message }}
    </div>

    <main>
      <div v-if="loading" class="panel loading-note">Loading configuration studio...</div>

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

        <div class="panel">
          <span class="section-title">Runbook</span>
          <h2>Next commands</h2>
          <div class="command-list">
            <code>bun run dev -- import https://your-api.example.com/openapi.json</code>
            <code>bun run dev -- run --env {{ effectiveDefaultEnv }}</code>
            <code>bun run dev -- report</code>
          </div>
        </div>
      </template>
    </main>

    <div class="footer-note">
      Tip: keep this terminal open while the studio is running. Press Ctrl+C to stop the local server.
    </div>
  </div>
</template>
