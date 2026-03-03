<script setup lang="ts">
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
      <RouterLink to="/login" class="underline">Login</RouterLink>
    </div>
  </header>

  <main class="grow flex flex-col justify-center items-center">
    <RouterView />
  </main>

  <footer class="border-t text-center">
    当前路由: {{ $route.path }}
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