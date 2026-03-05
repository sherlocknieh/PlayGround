<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import router from './router'

const auth = useAuthStore()

const logoutLoading = ref(false)

const handleLogout = async () => {
  logoutLoading.value = true
  await auth.signOut()
  logoutLoading.value = false
  router.push({ name: 'home' }) // 登出后跳转到首页
}
</script>


<template>
  <header class="border-b flex justify-between items-center px-4 py-2">
    <!-- 顶栏左侧 -->
    <div class="flex items-center">
      <RouterLink to="/" class="underline">Home</RouterLink>
    </div>
    <!-- 顶栏中部 -->
    <div class="grow flex justify-center items-center">
      {{ $route.meta.title || 'My App' }}
    </div>
    <!-- 顶栏右侧 -->
     <div class="flex items-center">
      <RouterLink v-if="!auth.isAuthenticated" to="/login" class="underline">登录</RouterLink>
      <!-- 退出登录按钮 -->
      <button v-if="auth.isAuthenticated" @click="handleLogout" class="underline cursor-pointer flex items-center">
        <!-- 登出加载动画 -->
        <div v-if="logoutLoading" class="animate-spin w-5 h-5 border-t-2 rounded-full"></div>
        <div v-else>退出登录</div>
      </button>
     </div>
  </header>

  <main class="grow flex flex-col justify-center items-center">
    <RouterView />
  </main>

  <footer class="border-t flex justify-between">
    <div>当前路由: {{ $route.path }}</div>
    <div>登录状态: {{ auth.isAuthenticated ? '[🟢已登录]' : '[🔴未登录]' }}</div>
  </footer>
</template>


<style>
/* 跟随浏览器切换夜间模式 */
:root { color-scheme: light dark; }

/* 使用柔和的边框颜色 */
* { border-color: grey;}

/* 根元素 Flex 布局 */
#app {
  /* 启用 flexbox 纵向布局 */
  display: flex;
  flex-direction: column;
  /* 占满视口高度 */
  min-height: 100vh;
}
</style>