<script setup lang="ts">
import Hello from './components/HelloWorld.vue';
</script>


<template>
  <header class="border-b flex justify-between items-center px-4 py-2">
    <!-- 顶栏左侧 -->
    <div class="flex items-center">顶栏左侧</div>
    <!-- 顶栏中部 -->
    <div class="grow flex justify-center items-center">顶栏中部</div>
    <!-- 顶栏右侧 -->
     <div class="flex items-center">顶栏右侧</div>
  </header>

  <main class="grow flex flex-col justify-center items-center">
    <Hello msg="Hello, Tailwind CSS" />
  </main>

  <footer class="border-t text-center">
    状态栏
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