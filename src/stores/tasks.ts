import { supabase } from '@/lib/supabase'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { Task, TaskUpdate } from './tasks.types'
import { createLogger } from '@/utils/logger'
import { useRealtime } from './tasks.realtime'

// 极简任务管理
export const useTasksStore = defineStore('tasks', () => {
  const logger = createLogger('TasksStore', { namespace: 'Realtime' })

  /* States */

  // 任务列表
  const tasks = ref<Task[]>([])
  // 辅助状态
  const isLoading = ref(false)
  const isRealtimeActive = ref(false)
  const currentUserId = ref<string | null>(null)

  /* Getters */

  const active = computed(() => tasks.value.filter(t => !t.deleted_at))
  const todo = computed(() => tasks.value.filter(t => t.status === 'todo'))
  const doing = computed(() => tasks.value.filter(t => t.status === 'doing'))
  const done = computed(() => tasks.value.filter(t => t.status === 'done'))
  const deleted = computed(() => tasks.value.filter(t => t.deleted_at !== null))

  /* Actions */

  async function fetchAllTasks(userId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    tasks.value = (data as Task[]) || []
  }

  const realtime = useRealtime({
    tasks,
    isRealtimeActive,
    currentUserId,
    fetchAllTasks
  })

  // 初始化：加载任务 + 启动 Realtime 订阅
  async function initialize() {
    logger.log('Initializing store...')
    isLoading.value = true

    try {
      // 获取当前用户
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('用户未登录')
      }
      currentUserId.value = userData.user.id
      logger.log('Current user:', currentUserId.value)

      // 加载任务
      await fetchAllTasks(currentUserId.value)
      logger.log(`Loaded ${tasks.value.length} tasks from database`)

      // 启动 Realtime 订阅（只监听当前用户的任务）
      void realtime.openRealtimeChannel(currentUserId.value)

      logger.log(`Store initialized with ${tasks.value.length} tasks`)
    } catch (err) {
      logger.error('Initialize failed:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  // 新建任务
  async function createTask(title: string, description?: string) {
    logger.log('Creating task:', { title, description })

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      logger.error('Create task failed: user not logged in')
      throw new Error('用户未登录')
    }

    logger.log('Create task: inserting to database...')
    const { error } = await supabase.from('tasks').insert({
      user_id: userData.user.id,
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
    // 数据操作
    createTask,
    deleteTask,
    restoreTask,
    updateTask
  }
})
