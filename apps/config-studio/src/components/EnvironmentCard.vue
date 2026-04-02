<script setup lang="ts">
import { computed } from 'vue'
import type { EnvFormItem } from '../types'
import { t } from '../lib/i18n'

const props = defineProps<{
  env: EnvFormItem
  index: number
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()

const cardTitle = computed(
  () => props.env.name.trim() || t('environmentCard.title', { index: props.index + 1 }),
)

const authTypeLabel = computed(() => {
  if (props.env.authType === 'header') {
    return t('environmentCard.staticHeaders')
  }

  if (props.env.authType === 'bearer') {
    return t('environmentCard.loginBearer')
  }

  return t('environmentCard.none')
})
</script>

<template>
  <section class="env-card">
    <div class="card-head">
      <div class="card-title-block">
        <span class="card-index">{{ props.index + 1 }}</span>
        <div>
          <h3>{{ cardTitle }}</h3>
          <small>{{ t('environmentCard.description') }}</small>
        </div>
      </div>
      <div class="card-head-actions">
        <span class="card-badge">{{ authTypeLabel }}</span>
        <button type="button" class="ghost" @click="emit('remove', props.index)">
          {{ t('common.remove') }}
        </button>
      </div>
    </div>

    <div class="card-section">
      <div class="grid two">
        <div class="field">
          <label>{{ t('environmentCard.name') }}</label>
          <input v-model="props.env.name" placeholder="dev" />
        </div>
        <div class="field">
          <label>{{ t('environmentCard.baseUrl') }}</label>
          <input v-model="props.env.baseURL" placeholder="https://api.example.com" />
        </div>
      </div>
    </div>

    <div class="card-section">
      <div class="field">
        <label>{{ t('environmentCard.headers') }}</label>
        <textarea v-model="props.env.headersText" placeholder="X-Project=omni-qa"></textarea>
      </div>
    </div>

    <div class="card-section card-section-subtle">
      <div class="grid two">
        <div class="field">
          <label>{{ t('environmentCard.auth') }}</label>
          <select v-model="props.env.authType">
            <option value="none">{{ t('environmentCard.none') }}</option>
            <option value="header">{{ t('environmentCard.staticHeaders') }}</option>
            <option value="bearer">{{ t('environmentCard.loginBearer') }}</option>
          </select>
        </div>
      </div>

      <div v-if="props.env.authType === 'header'" class="field">
        <label>{{ t('environmentCard.authHeaders') }}</label>
        <textarea v-model="props.env.authHeadersText" placeholder="Authorization=Bearer TOKEN"></textarea>
      </div>

      <template v-else-if="props.env.authType === 'bearer'">
        <div class="grid three">
          <div class="field">
            <label>{{ t('environmentCard.loginUrl') }}</label>
            <input v-model="props.env.loginUrl" placeholder="/auth/login" />
          </div>
          <div class="field">
            <label>{{ t('environmentCard.method') }}</label>
            <select v-model="props.env.loginMethod">
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
          </div>
          <div class="field">
            <label>{{ t('environmentCard.tokenPath') }}</label>
            <input v-model="props.env.tokenPath" placeholder="data.access_token" />
          </div>
        </div>

        <div class="field">
          <label>{{ t('environmentCard.loginBody') }}</label>
          <textarea
            v-model="props.env.loginBodyText"
            placeholder="username=demo&#10;password=123456"
          ></textarea>
        </div>
      </template>

      <div v-else class="hint card-inline-hint">
        {{ t('environmentCard.noAuthHint') }}
      </div>
    </div>
  </section>
</template>
