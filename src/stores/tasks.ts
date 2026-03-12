import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// 任务类型定义
export type Task = Tables<'tasks'>
// 数据变更负载类型
export type Payload = RealtimePostgresChangesPayload<Task>
// 缩进列表式任务树
export type IndentTaskTree = (Task & { depth: number })[]

export interface CreateTaskInput {
  userId: string
  title: string
  description?: string | null
  parentId?: string | null
}

// 任务储存管理
export const useTasksStore = defineStore('tasks', () => {
  // 基本数据
  const tasks = ref<Task[]>([])

  // 派生数据
  const todo = computed<Task[]>(() => tasks.value.filter(task => task.status === 'todo'))
  const doing = computed<Task[]>(() => tasks.value.filter(task => task.status === 'doing'))
  const done = computed<Task[]>(() => tasks.value.filter(task => task.status === 'done'))
  const deleted = computed<Task[]>(() => tasks.value.filter(task => task.deleted_at !== null))

  // 内部辅助状态
  const _isLoading = ref(false)
  const _isMutating = ref(false)
  const _isInitialized = ref(false)

  const _upsertTask = (incoming: Task) => {
    const idx = tasks.value.findIndex(t => t.id === incoming.id)
    if (idx === -1) {
      tasks.value.push(incoming)
      return
    }

    const current = tasks.value[idx]!
    const currentTs = Date.parse(current.updated_at)
    const incomingTs = Date.parse(incoming.updated_at)

    // 如果本地版本更新, 忽略回放的旧事件
    if (!Number.isNaN(currentTs) && !Number.isNaN(incomingTs) && incomingTs < currentTs) {
      return
    }

    // 避免相同数据触发二次写入
    if (JSON.stringify(current) === JSON.stringify(incoming)) {
      return
    }

    tasks.value[idx] = incoming
  }
  
  // 操作
  
  // 1. 获取基本数据
  async function fetchAllTasks() {
    _isLoading.value = true
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })

    _isLoading.value = false
    
    if (error) {
      console.error('Error fetching tasks:', error)
      return
    }
    tasks.value = data || []
    _isInitialized.value = true
  }


  // 2. 开启实时监听
  function initRealtime() {
    const channel = supabase
      .channel('tasks-realtime')  // 频道名称可自定义
      .on(
        'postgres_changes',       // 监听 PostgreSQL 变更事件
        { 
          event: '*',
          schema: 'public',       
          table: 'tasks'
        },                        // 监听 public.tasks 表的所有变更
        (payload: Payload) => {
          _handlePayload(payload)  // 调用 _handlePayload 处理变更数据
        }
      )
      .subscribe()                // 开启订阅

    return () => supabase.removeChannel(channel) // 返回卸载函数
  }
  // 处理实时变更数据, 保持本地数据与数据库同步
  const _handlePayload = (payload: Payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    console.log('[Realtime Event]', payload)
    // 处理 INSERT, UPDATE, DELETE 事件
    if (eventType === 'INSERT') {
      _upsertTask(newRecord)
    }
    else if (eventType === 'UPDATE') {
      _upsertTask(newRecord)
    }
    else if (eventType === 'DELETE') {
      const oldId = oldRecord?.id
      if (!oldId) return
      tasks.value = tasks.value.filter(t => t.id !== oldId)
    }
  }

  // 3. 新建任务
  async function createTask(_parentId: Task['parent_id'] = null) {
  }

  // 4. 删除任务
  async function deleteTask(taskId: Task['id'], softDelete: boolean = true) {
    _isMutating.value = true
    if (softDelete) {
      // 软删除, 调用 RPC 函数实现级联软删除
      const result = await supabase
        .rpc('soft_delete_tasks', { task_ids: [taskId] })
      console.log('Soft delete result:', result)
    } else {
      // 硬删除, 直接从数据库删除, 级联删除由数据库外键约束实现
      const result = await supabase
        .from('tasks')
        .delete()
        .match({ id: taskId })
      console.log('Hard delete result:', result)
    }
    _isMutating.value = false
  }

  // 导出访问接口
  return {
    // getters
    isInitialized: computed(() => _isInitialized.value),
    todo,
    doing,
    done,
    deleted,
    // actions
    fetchAllTasks,
    initRealtime,
    createTask,
    deleteTask,
  }
})