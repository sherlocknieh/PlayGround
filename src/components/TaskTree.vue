<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks.types'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const store = useTasksStore()
const isDeleting = ref(false)
const isTogglingStatus = computed(() => store.isTaskMutating(props.task.id, 'update'))

// 切换任务状态
async function toggleStatus(e: Event) {
  e.stopPropagation()
  if (isTogglingStatus.value) return

  const newStatus = props.task.status === 'todo' ? 'done' : 'todo'
  try {
    await store.updateTask(props.task.id, { status: newStatus as any })
  } catch (err) {
    console.error('更新任务状态失败:', err)
  }
}

// 删除任务
async function deleteTask(e: Event) {
  e.stopPropagation()
  if (isDeleting.value) return

  isDeleting.value = true
  try {
    await store.deleteTask(props.task.id)
  } catch (err) {
    console.error('删除任务失败:', err)
  } finally {
    isDeleting.value = false
  }
}

// 获取状态样式
function getStatusClass(status: string) {
  return status === 'done' ? 'line-through opacity-50' : ''
}

const titleClass = computed(() => [
  'font-medium dark:text-gray-100 break-all',
  getStatusClass(props.task.status),
])
</script>

<template>
  <div class="task-tree">
    <!-- 任务项 -->
    <div
      class="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
    >
      <!-- 状态复选框 -->
      <button
        @click="toggleStatus"
        :disabled="isTogglingStatus"
        :class="[
          'mt-1 w-5 h-5 border-2 rounded flex items-center justify-center shrink-0',
          task.status === 'done'
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 hover:border-green-500'
        ]"
        :title="isTogglingStatus ? '更新中...' : `当前状态：${task.status}`"
      >
        <span
          v-if="isTogglingStatus"
          class="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"
        />
        <span v-else-if="task.status === 'done'" class="text-white text-xs">✓</span>
      </button>

      <!-- 任务信息 -->
      <div class="flex-1 min-w-0">
        <h3 :class="titleClass">
          {{ task.title }}
        </h3>
        <p v-if="task.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1 break-all">
          {{ task.description }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-1">
        <!-- 删除按钮 -->
        <button
          @click="deleteTask"
          :disabled="isDeleting"
          class="mt-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded dark:text-red-400 dark:hover:bg-red-950 shrink-0"
          :class="isDeleting ? 'opacity-50 cursor-not-allowed' : ''"
          title="删除任务"
        >
          {{ isDeleting ? '删除中...' : '删除' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-tree {
  width: 100%;
}
</style>
