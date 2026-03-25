<script setup lang="ts">
import type { NotificationFormItem } from '../types'

const props = defineProps<{
  notify: NotificationFormItem
  index: number
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()
</script>

<template>
  <section class="notify-card">
    <div class="card-head">
      <div>
        <h3>Notification #{{ props.index + 1 }}</h3>
        <small>Push concise run summaries to the right audience.</small>
      </div>
      <button type="button" class="ghost" @click="emit('remove', props.index)">Remove</button>
    </div>

    <div v-if="props.notify.type === 'dingtalk'" class="grid two">
      <div class="field">
        <label>Type</label>
        <select v-model="props.notify.type">
          <option value="dingtalk">DingTalk</option>
          <option value="email">Email</option>
        </select>
      </div>
      <div class="field">
        <label>Webhook</label>
        <input v-model="props.notify.webhook" placeholder="https://oapi.dingtalk.com/..." />
      </div>
    </div>

    <template v-else>
      <div class="grid two">
        <div class="field">
          <label>Type</label>
          <select v-model="props.notify.type">
            <option value="dingtalk">DingTalk</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div class="field">
          <label>Recipients</label>
          <input v-model="props.notify.recipientsText" placeholder="qa@example.com, team@example.com" />
        </div>
      </div>

      <div class="grid three">
        <div class="field">
          <label>SMTP host</label>
          <input v-model="props.notify.smtpHost" placeholder="smtp.example.com" />
        </div>
        <div class="field">
          <label>SMTP port</label>
          <input v-model="props.notify.smtpPort" type="number" />
        </div>
        <div class="field">
          <label>Secure</label>
          <select v-model="props.notify.smtpSecure">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label>SMTP user</label>
          <input v-model="props.notify.smtpUser" placeholder="qa@example.com" />
        </div>
        <div class="field">
          <label>SMTP password</label>
          <input v-model="props.notify.smtpPass" placeholder="app-password" />
        </div>
      </div>
    </template>
  </section>
</template>
