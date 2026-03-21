<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import RecycleBin from '@/components/RecycleBin.vue'

const tasks = useTasksStore()
const newTaskTitle = ref('')
const newTaskDesc = ref('')
const creatingTask = ref(false)
const deletingId = ref<string | null>(null)

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
  if (!newTaskTitle.value.trim()) return

  creatingTask.value = true
  try {
    await tasks.createTask(newTaskTitle.value, newTaskDesc.value || undefined)
    newTaskTitle.value = ''
    newTaskDesc.value = ''
  } catch (err) {
    console.error('创建失败:', err)
  } finally {
    creatingTask.value = false
  }
}

// 切换状态
async function toggleStatus(taskId: string, currentStatus: string) {
  const newStatus = currentStatus === 'todo' ? 'done' : 'todo'
  try {
    await tasks.updateTask(taskId, { status: newStatus as any })
  } catch (err) {
    console.error('更新失败:', err)
  }
}

// 删除任务
async function removeTask(taskId: string) {

  deletingId.value = taskId
  try {
    await tasks.deleteTask(taskId) // 软删除
  } catch (err) {
    console.error('删除失败:', err)
  } finally {
    deletingId.value = null
  }
}

// 获取状态样式
function getStatusClass(status: string) {
  return status === 'done' ? 'line-through opacity-50' : ''
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
          :disabled="!newTaskTitle.trim() || creatingTask"
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

    <!-- 任务列表 -->
    <div v-else class="space-y-3">
      <h2 class="text-lg font-semibold mb-4 dark:text-white">任务列表（共 {{ tasks.active.length }} 个）</h2>

      <div
        v-if="tasks.active.length === 0"
        class="p-6 text-center border-2 border-dashed rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
      >
        <p class="text-gray-500 dark:text-gray-400">暂无任务</p>
      </div>

      <div
        v-for="task in tasks.active"
        :key="task.id"
        class="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 dark:bg-gray-800 transition"
      >
        <!-- 状态复选框 -->
        <button
          @click="toggleStatus(task.id, task.status)"
          :class="[
            'mt-1 w-5 h-5 border-2 rounded flex items-center justify-center shrink-0',
            task.status === 'done'
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-500'
          ]"
          :title="`切换状态：${task.status}`"
        >
          <span v-if="task.status === 'done'" class="text-white text-xs">✓</span>
        </button>

        <!-- 任务内容 -->
        <div class="flex-1 min-w-0">
          <p :class="['font-medium dark:text-white', getStatusClass(task.status)]">
            {{ task.title }}
          </p>
          <p
            v-if="task.description"
            :class="['text-sm text-gray-600 dark:text-gray-400 mt-1', getStatusClass(task.status)]"
          >
            {{ task.description }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
            创建于：{{ new Date(task.created_at).toLocaleString('zh-CN') }}
          </p>
        </div>

        <!-- 删除按钮 -->
        <button
          @click="removeTask(task.id)"
          :disabled="deletingId === task.id"
          class="px-3 py-1 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {{ deletingId === task.id ? '删除中...' : '删除' }}
        </button>
      </div>
    </div>

    <RecycleBin />
  </div>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>