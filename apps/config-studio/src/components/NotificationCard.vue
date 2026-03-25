<script setup lang="ts">
import type { NotificationFormItem } from '../types'
import { t } from '../lib/i18n'

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
        <h3>{{ t('notificationCard.title', { index: props.index + 1 }) }}</h3>
        <small>{{ t('notificationCard.description') }}</small>
      </div>
      <button type="button" class="ghost" @click="emit('remove', props.index)">
        {{ t('common.remove') }}
      </button>
    </div>

    <div v-if="props.notify.type === 'dingtalk'" class="grid two">
      <div class="field">
        <label>{{ t('notificationCard.type') }}</label>
        <select v-model="props.notify.type">
          <option value="dingtalk">{{ t('notificationCard.dingtalk') }}</option>
          <option value="email">{{ t('notificationCard.email') }}</option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('notificationCard.webhook') }}</label>
        <input v-model="props.notify.webhook" placeholder="https://oapi.dingtalk.com/..." />
      </div>
    </div>

    <template v-else>
      <div class="grid two">
        <div class="field">
          <label>{{ t('notificationCard.type') }}</label>
          <select v-model="props.notify.type">
            <option value="dingtalk">{{ t('notificationCard.dingtalk') }}</option>
            <option value="email">{{ t('notificationCard.email') }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('notificationCard.recipients') }}</label>
          <input v-model="props.notify.recipientsText" placeholder="qa@example.com, team@example.com" />
        </div>
      </div>

      <div class="grid three">
        <div class="field">
          <label>{{ t('notificationCard.smtpHost') }}</label>
          <input v-model="props.notify.smtpHost" placeholder="smtp.example.com" />
        </div>
        <div class="field">
          <label>{{ t('notificationCard.smtpPort') }}</label>
          <input v-model="props.notify.smtpPort" type="number" />
        </div>
        <div class="field">
          <label>{{ t('notificationCard.secure') }}</label>
          <select v-model="props.notify.smtpSecure">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label>{{ t('notificationCard.smtpUser') }}</label>
          <input v-model="props.notify.smtpUser" placeholder="qa@example.com" />
        </div>
        <div class="field">
          <label>{{ t('notificationCard.smtpPassword') }}</label>
          <input v-model="props.notify.smtpPass" placeholder="app-password" />
        </div>
      </div>
    </template>
  </section>
</template>
