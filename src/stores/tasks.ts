import { supabase } from '@/lib/supabase'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { Task, TaskUpdate } from './tasks.types'
import { createLogger } from '@/utils/logger'
import { useRealtime } from './tasks.realtime'

const logger = createLogger('TasksStore', 'Realtime')

// 极简任务管理
export const useTasksStore = defineStore('tasks', () => {

  /* States */

  // 任务列表
  const tasks = ref<Task[]>([])
  // 辅助状态
  const isLoading = ref(false)
  const isRealtimeActive = ref(false)

  /* Getters */

  const active = computed(() => tasks.value.filter(t => !t.deleted_at))
  const todo = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const doing = computed(() => tasks.value.filter(t => t.status === 'doing'))
  const done = computed(() => tasks.value.filter(t => t.status === 'done'))
  const deleted = computed(() => tasks.value.filter(t => t.deleted_at !== null))
  const realtime = useRealtime({
    tasks,
    isRealtimeActive,
    fetchAllTasks
  })

  /* Actions */

  async function fetchAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    tasks.value = (data as Task[]) || []
  }

  // 初始化：加载任务 + 启动 Realtime 订阅
  async function initialize() {
    isLoading.value = true
    logger.log('Initializing store...')

    await fetchAllTasks()
    logger.log(`Loaded ${tasks.value.length} tasks from database`)

    void realtime.openRealtimeChannel()
    logger.log(`Store initialized with ${tasks.value.length} tasks`)

    isLoading.value = false
  }
  // 新建任务
  async function createTask(title: string, description?: string) {
    logger.log('Creating task:', { title, description })

    // 获取当前认证用户的 ID
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    logger.log('Create task: inserting to database...')
    const { error } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: title.trim(),
      description: description || null,
      status: 'todo',
      deleted_at: null
    })

    if (error) {
      logger.error('Create task failed: database insert error', error)
      throw error
    }

    logger.log('Create task request sent, waiting for Realtime response...')
  }
  // 删除任务
  async function deleteTask(taskId: string, method: 'soft' | 'hard' = 'soft') {
    logger.log('Deleting task:', taskId)

    if (method === 'hard') {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) {
        logger.error('Delete task failed:', error)
        throw error
      }
    } else {
      const { error } = await supabase.rpc('soft_delete_tasks', { task_ids: [taskId] })
      if (error) {
        logger.error('Soft delete task failed:', error)
        throw error
      }
    }

    logger.log('Delete request sent, waiting for Realtime response...')
  }
  // 还原任务（从回收站恢复）
  async function restoreTask(taskId: string) {
    logger.log('Restoring task:', taskId)

    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: null })
      .eq('id', taskId)

    if (error) {
      logger.error('Restore task failed:', error)
      throw error
    }

    logger.log('Restore request sent, waiting for Realtime response...')
  }
  // 更新任务
  async function updateTask(taskId: string, updates: TaskUpdate) {
    logger.log('Updating task:', { taskId, updates })

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)

    if (error) {
      logger.error('Update task failed:', error)
      throw error
    }

    logger.log('Update request sent, waiting for Realtime response...')
  }

  return {
    // 状态
    isLoading,
    isRealtimeActive,
    // 计算属性
    active,
    todo,
    doing,
    done,
    deleted,
    // 生命周期
    initialize,
    closeRealtimeChannel: realtime.closeRealtimeChannel,
    realtime,
    // 数据操作
    createTask,
    deleteTask,
    restoreTask,
    updateTask
  }
})
