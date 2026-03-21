<script setup lang="ts">
import { ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'

const tasksStore = useTasksStore()
const hardDeletingId = ref<string | null>(null)
const restoringId = ref<string | null>(null)

async function restoreTask(taskId: string) {
  restoringId.value = taskId
  try {
    await tasksStore.restoreTask(taskId)
  } catch (err) {
    console.error('还原失败:', err)
  } finally {
    restoringId.value = null
  }
}

async function hardDeleteTask(taskId: string) {
  hardDeletingId.value = taskId
  try {
    await tasksStore.deleteTask(taskId, 'hard')
  } catch (err) {
    console.error('彻底删除失败:', err)
  } finally {
    hardDeletingId.value = null
  }
}
</script>

<template>
  <section class="mt-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
    <h2 class="text-lg font-semibold mb-4 dark:text-white">
      回收站（{{ tasksStore.deleted.length }}）
    </h2>

    <div
      v-if="tasksStore.deleted.length === 0"
      class="p-4 text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed rounded dark:border-gray-700"
    >
      回收站为空
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="task in tasksStore.deleted"
        :key="task.id"
        class="flex items-start gap-3 p-3 border rounded bg-white dark:bg-gray-800 dark:border-gray-700"
      >
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-800 dark:text-gray-100">
            {{ task.title }}
          </p>
          <p v-if="task.description" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ task.description }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
            删除于：{{ task.deleted_at ? new Date(task.deleted_at).toLocaleString('zh-CN') : '-' }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="restoreTask(task.id)"
            :disabled="restoringId === task.id || hardDeletingId === task.id"
            class="px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ restoringId === task.id ? '还原中...' : '还原' }}
          </button>

          <button
            @click="hardDeleteTask(task.id)"
            :disabled="hardDeletingId === task.id || restoringId === task.id"
            class="px-3 py-1 text-sm text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ hardDeletingId === task.id ? '删除中...' : '彻底删除' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
