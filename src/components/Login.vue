<script setup lang="ts">
// 登录窗口组件
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useRouter } from 'vue-router'

const router = useRouter()
const auth = useAuth()

const username = ref('') // 默认用户名
const password = ref('') // 默认密码

const showPassword = ref(false) // 密码显示开关

const signInLoading = ref(false)
const registerLoading = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | ''>('')

const handleSignIn = async () => {
  signInLoading.value = true
  message.value = ''
  messageType.value = ''
  try {
    await auth.signInWithPassword(username.value, password.value)
    message.value = '登录成功'
    messageType.value = 'success'
    router.push({ name: 'app' }) // 登录成功后跳转到应用页
  } catch (error: any) {
    message.value = error?.message ?? '登录失败，请重试！'
    messageType.value = 'error'
  } finally {
    signInLoading.value = false
  }
}

const handleSignUp = async () => {
  registerLoading.value = true
  message.value = ''
  messageType.value = ''
  try {
    const { user, session } = await auth.signUp(username.value, password.value)
    if (user && session) {
      message.value = '注册成功，正在登录...'
      messageType.value = 'success'
      router.push({ name: 'app' })
      return
    }
    message.value = '验证邮件已发送, 请前往邮箱获取激活链接'
    messageType.value = 'success'
  } catch (error: any) {
    message.value = error?.message ?? '注册失败，请重试！'
    messageType.value = 'error'
  } finally {
    registerLoading.value = false
  }
}
</script>


<template>
  <!-- 登录表单 -->
  <form @submit.prevent="handleSignIn" class="flex flex-col items-center gap-2 p-6 border rounded shadow-md w-70">
    <!-- 邮箱输入框 -->
    <input v-model="username" type="email" id="email" autocomplete="username" name="email" placeholder="Email" required
      class="p-1 w-full border rounded focus:outline" />
    <!-- 密码输入框 -->
    <div class="w-full flex items-center border rounded focus-within:outline">
      <!-- 真正的密码输入框 -->
      <input v-model="password" :type="showPassword ? 'text' : 'password'" id="password" autocomplete="current-password"
        name="password" placeholder="Password" class="p-1 w-full outline-none" required />
      <!-- 密码显隐按钮 -->
      <button v-if="password.length > 0" type="button" @click="showPassword = !showPassword"
        :aria-pressed="showPassword" :title="showPassword ? '隐藏密码' : '显示密码'"
        :aria-label="showPassword ? '隐藏密码' : '显示密码'"
        class="p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
          <circle cx="12" cy="12" r="3"></circle>
          <path v-if="!showPassword" d="M2 2 l20 20"></path>
        </svg>
      </button>
    </div>
    <!-- 登录/注册按钮 -->
    <div class="w-full flex justify-end gap-2">
      <!-- 登录按钮 -->
      <button type="submit" :disabled="signInLoading"
        class="px-4 p-1 border rounded whitespace-nowrap hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-15">
        <!-- 登录加载动画 -->
        <span v-if="signInLoading" class="animate-spin w-5 h-5 border-t-2 rounded-full"></span>
        <span v-else>登录</span>
      </button>
      <!-- 注册按钮 -->
      <button type="button" @click="handleSignUp" :disabled="registerLoading"
        class="px-4 p-1 border rounded whitespace-nowrap hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-15">
        <!-- 注册加载动画 -->
        <span v-if="registerLoading" class="animate-spin w-5 h-5 border-t-2 rounded-full"></span>
        <span v-else>注册</span>
      </button>
    </div>
    <!-- 提示信息 -->
    <div v-if="message" class="w-full mt-3 text-sm"
      :class="messageType === 'success' ? 'text-green-600' : 'text-red-600'">{{ message }}</div>
  </form>
</template>


<style scoped>
/* 隐藏 Edge 浏览器自带的密码显隐图标 */
input::-ms-reveal {
  display: none;
}
</style>