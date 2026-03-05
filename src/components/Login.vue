<script setup lang="ts">
// 登录窗口组件
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import router from '@/router'

const auth = useAuth()

const username = ref('')

const handleLogin = async () => {
  const success = await auth.signIn(username.value)
  if (success) {
    console.log('登录成功:', username.value);
    router.push({ name: 'app' }) // 登录成功后跳转到应用页
  } else {
    console.error('登录失败');
    alert('登录失败，请重试！')
  }
}
</script>


<template>
  <!-- 登录表单 -->
  <form @submit.prevent="handleLogin" class="flex items-center gap-2 p-6 border rounded shadow-md">
    <!-- 输入框 -->
    <input v-model="username" type="text" id="username" name="username" placeholder="Username" class="p-1 w-full border rounded" required />
    <!-- 登录按钮 -->
    <button type="submit" class="px-4 p-1 border rounded whitespace-nowrap hover:bg-gray-200">登录</button>
  </form>
</template>