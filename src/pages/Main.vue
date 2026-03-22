<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import TaskTree from '@/components/TaskTree.vue'

const tasks = useTasksStore()
const auth = useAuthStore()
const newTaskTitle = ref('')
const newTaskDesc = ref('')
const creatingTask = ref(false)

// 初始化
onMounted(async () => {
  try {
    await tasks.initialize()
  } catch (err) {
    console.error('初始化失败:', err)
  }
})

// 清理
onBeforeUnmount(() => {
  tasks.closeRealtimeChannel()
})

// 添加任务
async function addTask() {
  const userId = auth.user?.id
  if (!newTaskTitle.value.trim()) return
  if (!userId) {
    console.error('创建失败: 未登录或用户信息不可用')
    return
  }

  creatingTask.value = true
  try {
    await tasks.createTask({
      user_id: userId,
      title: newTaskTitle.value,
      description: newTaskDesc.value || null,
      parent_id: null,
    })
    newTaskTitle.value = ''
    newTaskDesc.value = ''
  } catch (err) {
    console.error('创建失败:', err)
  } finally {
    creatingTask.value = false
  }
}


</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <!-- 头部信息 -->
    <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        Realtime 状态：
        <span
          v-if="tasks.isRealtimeActive"
          class="inline-flex items-center gap-1 ml-2 px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-medium"
        >
          <span class="w-2 h-2 bg-green-600 rounded-full"></span>
          已连接
        </span>
        <span v-else class="inline-flex items-center gap-1 ml-2 px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs font-medium">
          <span class="w-2 h-2 bg-gray-600 rounded-full"></span>
          未连接
        </span>
      </p>
      <span v-if="tasks.isRealtimeActive" class="text-sm text-gray-600 dark:text-gray-300">
      <button @click="tasks.closeRealtimeChannel" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
        断开连接
      </button>
      </span>
      <span v-else class="text-sm text-gray-600 dark:text-gray-300">
         <button @click="tasks.openRealtimeChannel" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          连接
        </button>
      </span>
    </div>

    <!-- 新增任务表单 -->
    <div class="mb-6 p-4 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
      <h2 class="text-lg font-semibold mb-3 dark:text-white">新增任务</h2>
      <div class="space-y-3">
        <input
          v-model="newTaskTitle"
          type="text"
          placeholder="任务标题（必填）"
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        <textarea
          v-model="newTaskDesc"
          placeholder="任务描述（可选）"
          rows="2"
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        ></textarea>
        <button
          @click="addTask"
          :disabled="!newTaskTitle.trim() || creatingTask || !auth.user"
          class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ creatingTask ? '创建中...' : '创建' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="tasks.isLoading" class="text-center py-8">
      <p class="text-gray-600 dark:text-gray-400">加载中...</p>
    </div>

    <div
      v-else-if="tasks.lastError"
      class="mb-6 p-4 rounded border border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
    >
      初始化失败，请稍后重试。
    </div>

    <!-- 任务列表 -->
    <div v-else class="space-y-3">
      <h2 class="text-lg font-semibold mb-4 dark:text-white">任务列表（共 {{ tasks.active.length }} 个）</h2>

      <div
        v-if="tasks.active.length === 0"
        class="p-6 text-center border-2 border-dashed rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
      >
        <p class="text-gray-500 dark:text-gray-400">暂无任务</p>
      </div>

      <div v-else class="space-y-2 border rounded-lg p-4 dark:border-gray-600 dark:bg-gray-800">
        <TaskTree
          v-for="task in tasks.active"
          :key="task.id"
          :task="task"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>