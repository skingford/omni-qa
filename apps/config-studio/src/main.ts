import { createApp } from 'vue'
import App from './App.vue'
import { initializeI18n } from './lib/i18n'
import './style.css'

initializeI18n()

createApp(App).mount('#app')
