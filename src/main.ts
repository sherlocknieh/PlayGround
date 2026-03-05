import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import '@/style.css'

// 处理认证回调URL
import { fixAuthCallback } from '@/utils/fixAuthCallback'
await fixAuthCallback()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')
