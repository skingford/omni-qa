<script setup lang="ts">
import type { EnvFormItem } from '../types'

const props = defineProps<{
  env: EnvFormItem
  index: number
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()
</script>

<template>
  <section class="env-card">
    <div class="card-head">
      <div>
        <h3>Environment #{{ props.index + 1 }}</h3>
        <small>Give each target a short stable name like dev or staging.</small>
      </div>
      <button type="button" class="ghost" @click="emit('remove', props.index)">Remove</button>
    </div>

    <div class="grid two">
      <div class="field">
        <label>Name</label>
        <input v-model="props.env.name" placeholder="dev" />
      </div>
      <div class="field">
        <label>Base URL</label>
        <input v-model="props.env.baseURL" placeholder="https://api.example.com" />
      </div>
    </div>

    <div class="field">
      <label>Environment headers</label>
      <textarea v-model="props.env.headersText" placeholder="X-Project=omni-qa"></textarea>
    </div>

    <div class="grid two">
      <div class="field">
        <label>Authentication</label>
        <select v-model="props.env.authType">
          <option value="none">None</option>
          <option value="header">Static headers</option>
          <option value="bearer">Login and fetch bearer token</option>
        </select>
      </div>
    </div>

    <div v-if="props.env.authType === 'header'" class="field">
      <label>Auth headers</label>
      <textarea v-model="props.env.authHeadersText" placeholder="Authorization=Bearer TOKEN"></textarea>
    </div>

    <template v-else-if="props.env.authType === 'bearer'">
      <div class="grid three">
        <div class="field">
          <label>Login URL</label>
          <input v-model="props.env.loginUrl" placeholder="/auth/login" />
        </div>
        <div class="field">
          <label>Method</label>
          <select v-model="props.env.loginMethod">
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        </div>
        <div class="field">
          <label>Token path</label>
          <input v-model="props.env.tokenPath" placeholder="data.access_token" />
        </div>
      </div>

      <div class="field">
        <label>Login body</label>
        <textarea
          v-model="props.env.loginBodyText"
          placeholder="username=demo&#10;password=123456"
        ></textarea>
      </div>
    </template>

    <div v-else class="hint">
      No auth selected. Requests run with only global/environment headers.
    </div>
  </section>
</template>
