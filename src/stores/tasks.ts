import { supabase } from '@/lib/supabase'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Task, TaskUpdate } from './tasks.types'

// 极简任务管理 (基于 Realtime)
export const useTasksStore = defineStore('tasks', () => {

  /* States */

  // 任务列表
  const tasks = ref<Task[]>([])
  // 辅助状态
  const isLoading = ref(false)
  const isRealtimeActive = ref(false)

  /* Actions */

  // 初始化：加载任务 + 启动 Realtime 订阅
  async function initialize() {
    console.log('[📦 Tasks Store] Initializing store...')
    isLoading.value = true

    try {
      // 获取当前用户
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('用户未登录')
      }
      const currentUserId = userData.user.id
      console.log('[👤 User] Current user:', currentUserId)

      // 加载任务
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', currentUserId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      tasks.value = (data as Task[]) || []
      console.log(`[✅ Loaded] ${tasks.value.length} tasks from database`)

      // 启动 Realtime 订阅（只监听当前用户的任务）
      openRealtimeChannel(currentUserId)

      console.log(`[🎉 Ready] Store initialized with ${tasks.value.length} tasks`)
    } catch (err) {
      console.error('[❌ Init Error]', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  // 开启 Realtime 订阅
  function openRealtimeChannel(currentUserId: string) {
    console.log('[🔌 Realtime] Starting subscription with filter: user_id=eq.' + currentUserId)
    supabase
      .channel('tasks-realtime-' + currentUserId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${currentUserId}`
        },
        handleRealtimePayload
      )
      .subscribe((status) => {
        console.log(`[🔗 Subscription Status] ${status}`)
        isRealtimeActive.value = status === 'SUBSCRIBED'
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscribed successfully')
        } else {
          console.warn('⚠️ Realtime subscription status:', status)
        }
      })
  }
  // 处理 Realtime 事件
  function handleRealtimePayload(payload: any) {
    const eventType = payload.eventType
    const taskId = payload.new?.id || payload.old?.id || 'unknown'
    console.log(`[🔔 Realtime Event] ${eventType} - Task: ${taskId}`, payload)

    if (eventType === 'INSERT') {
      const newTask = payload.new as Task
      if (!newTask.deleted_at && !tasks.value.find(t => t.id === newTask.id)) {
        tasks.value.unshift(newTask)
        console.log(`[✨ Insert] Task added to list (${newTask.id}): "${newTask.title}"`)
      } else if (newTask.deleted_at) {
        console.log(`[⚠️ Insert] Task marked as deleted (${newTask.id}), skipped`)
      } else {
        console.log(`[⚠️ Insert] Task already in list (${newTask.id}), skipped`)
      }
      return
    }

    if (eventType === 'UPDATE') {
      const updated = payload.new as Task
      const idx = tasks.value.findIndex(t => t.id === updated.id)
      console.log(`[🔄 Update] Task ${updated.id} found at index ${idx}`)

      if (updated.deleted_at) {
        if (idx >= 0) {
          tasks.value.splice(idx, 1)
          console.log(`[🗑️ Soft Delete] Task removed from list (${updated.id})`)
        } else {
          console.log(`[ℹ️ Soft Delete] Task not in list (${updated.id}), already removed`)
        }
        return
      }

      if (idx >= 0) {
        tasks.value[idx] = updated
        console.log(`[✏️ Updated] Task modified (${updated.id}): "${updated.title}" - Status: ${updated.status}`)
        return
      }

      tasks.value.unshift(updated)
      console.log(`[🔙 Recovered] Task recovered and added (${updated.id}): "${updated.title}"`)
      return
    }

    if (eventType === 'DELETE') {
      const deleted = payload.old as Task
      const initialCount = tasks.value.length
      tasks.value = tasks.value.filter(t => t.id !== deleted.id)
      if (tasks.value.length < initialCount) {
        console.log(`[🗑️ Hard Delete] Task removed from list (${deleted.id})`)
      } else {
        console.log(`[ℹ️ Hard Delete] Task not in list (${deleted.id})`)
      }
    }
  }
  // 取消 Realtime 订阅
  function closeRealtimeChannel() {
    console.log('[🛑 Dispose] Cleaning up Realtime channel...')
    supabase.removeAllChannels()
    isRealtimeActive.value = false
    console.log('[✅ Dispose] Store disposed')
  }
  // 新建任务
  async function createTask(title: string, description?: string) {
    console.log('[📝 Create] Creating task:', { title, description })

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      console.error('[❌ Create Error] User not logged in')
      throw new Error('用户未登录')
    }

    console.log('[📤 Create] Inserting to database...')
    const { error } = await supabase.from('tasks').insert({
      user_id: userData.user.id,
      title: title.trim(),
      description: description || null,
      status: 'todo',
      deleted_at: null
    })

    if (error) {
      console.error('[❌ Create Error] Database insert failed:', error)
      throw error
    }

    console.log('[✅ Create] Task creation request sent, waiting for Realtime response...')
  }
  // 删除任务
  async function deleteTask(taskId: string, method: 'soft' | 'hard' = 'soft') {
    console.log('[🗑️ Delete] Deleting task:', taskId)

    if (method === 'hard') {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)

      if (error) {
        console.error('[❌ Delete Error]', error)
        throw error
      }
    } else {
      const { error } = await supabase.rpc('soft_delete_tasks', { task_ids: [taskId] })
      if (error) {
        console.error('[❌ Delete Error]', error)
        throw error
      }
    }

    console.log('[✅ Delete] Delete request sent, waiting for Realtime response...')
  }
  // 更新任务
  async function updateTask(taskId: string, updates: TaskUpdate) {
    console.log('[🔧 Update] Updating task:', { taskId, updates })

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)

    if (error) {
      console.error('[❌ Update Error]', error)
      throw error
    }

    console.log('[✅ Update] Update request sent, waiting for Realtime response...')
  }

  return {
    // 数据
    tasks,
    // 状态
    isLoading,
    isRealtimeActive,
    // 生命周期
    initialize,
    openRealtimeChannel,
    closeRealtimeChannel,
    // 数据操作
    createTask,
    deleteTask,
    updateTask
  }
})
