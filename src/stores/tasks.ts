import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

import type { TaskInsert, TaskUpdate, TaskMap, SubTaskMap, MetaDataMap, Payload } from './tasks.types'

// 基于 Realtime 的任务数据管理
export const useTasksStore = defineStore('tasks', () => {

  // 任务索引表
  const allTasks = reactive<TaskMap>({})
  // 子任务索引表
  const subTasks = reactive<SubTaskMap>({})
  // 元数据索引表
  const metadata = reactive<MetaDataMap>({})

  // 全局状态
  const isLoading = ref(false)
  const isInitialized = ref(false)
  const isRealtimeActive = ref(false)
  const realtimeChannel = ref<any>(null)

  // 初始化: 加载初始数据 + 启动订阅
  async function initialize() {
    if (isInitialized.value) { return }
    isLoading.value = true

    await fetchAllTasks() // 加载初始数据
    openRealtimeChannel() // 启动 Realtime 订阅

    isLoading.value = false
    isInitialized.value = true
    console.log('[TasksStore] Initialized')
  }
  // 加载所有任务
  async function fetchAllTasks() {
    // 查询数据库, 获取所有任务
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error
    // 一遍扫描, 构建索引数据
    data?.forEach(task => {
      // 填充任务索引表
      allTasks[task.id] = task
      // 填充元数据索引表
      metadata[task.id] = {
        isExpanded: false,
      }
      // 填充子任务索引表
      if (task.parent_id) {
        const parentId = task.parent_id
        subTasks[parentId] ??= []
        subTasks[parentId].push(task.id)
      }
      // 根任务挂在 subTasks['root'] 下
      else {
        subTasks['root'] ??= []
        subTasks['root'].push(task.id)
      }
    })
    console.log(`[Tasks] 从数据库加载了 ${data?.length || 0} 个任务`)
  }
  // 启动 Realtime 订阅
  function openRealtimeChannel() {
    if (isRealtimeActive.value) { return }
    realtimeChannel.value = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => handleRealtimePayload(payload as Payload)
      )
      .subscribe((status) => {
        isRealtimeActive.value = (status === 'SUBSCRIBED')
        console.log(`[Realtime] Realtime 订阅状态: ${status}`)
      }
      )
  }
  // 处理 Realtime 负载
  function handleRealtimePayload(payload: Payload) {
    switch (payload.eventType) {
      case 'INSERT': {
        console.log('[Realtime] 收到 INSERT 事件:', payload.new)
        // 处理插入事件
        const taskId = payload.new.id
        allTasks[taskId] = payload.new
        metadata[taskId] = {
          isExpanded: false
        }
        // 处理父子关系
        const parentId = payload.new.parent_id || 'root'
        subTasks[parentId] ??= []
        subTasks[parentId].push(payload.new.id)
        break
      }
      case 'UPDATE': {
        console.log('[Realtime] 收到 UPDATE 事件:', payload.new)
        // 处理更新事件
        const taskId = payload.new.id
        const newData = payload.new
        const oldData = allTasks[taskId]
        // 更新任务数据
        allTasks[taskId] = newData
        // 处理父任务变更
        const newParentId = newData?.parent_id || 'root'
        const oldParentId = oldData?.parent_id || 'root'
        if (newParentId !== oldParentId) {
          // 从旧父任务的子任务列表中移除
          subTasks[oldParentId] ??= []
          subTasks[oldParentId] = subTasks[oldParentId].filter(id => id !== taskId)
          // 添加到新父任务的子任务列表中
          subTasks[newParentId] ??= []
          subTasks[newParentId].push(taskId)
        }
        break
      }
      case 'DELETE': {
        console.log('[Realtime] 收到 DELETE 事件:', payload.old)
        // 处理删除事件
        const taskId = payload.old.id as string
        const localData = allTasks[taskId]
        if (localData) {
          const parentId = payload.old.parent_id || 'root'
          subTasks[parentId] ??= []
          subTasks[parentId] = subTasks[parentId].filter(id => id !== taskId)
        }
        delete allTasks[taskId]
        delete metadata[taskId]
        delete subTasks[taskId]
        break
      }
    }
  }
  // 关闭 Realtime 订阅
  function closeRealtimeChannel() {
    realtimeChannel.value?.unsubscribe()
    isRealtimeActive.value = false
    console.log('[Realtime] Realtime 订阅已关闭')
  }
  // 新建任务
  async function createTask(data: TaskInsert) {
    const { error } = await supabase.from('tasks').insert(data)
    if (error) {
      console.error('[Tasks] Create task failed: database insert error', error)
      throw error
    }
    console.log('[Tasks] 已发送任务创建请求', data, '等待 Realtime 响应...')
  }
  // 删除任务
  async function deleteTask(taskId: string, method: 'soft' | 'hard' = 'soft') {
    // 硬删除
    if (method === 'hard') {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) {
        console.error('[Tasks] 任务删除失败:', error)
        throw error
      }
    }
    // 软删除
    if (method === 'soft') {
      const { error } = await supabase.rpc('soft_delete_tasks', { task_ids: [taskId] })
      if (error) {
        console.error('[Tasks] 任务软删除失败:', error)
        throw error
      }
    }
    console.log('[Tasks] 已发送任务删除请求', taskId, '等待 Realtime 响应...')
  }
  // 还原任务
  async function restoreTask(taskId: string) {
    const { error } = await supabase.from('tasks').update({ deleted_at: null }).eq('id', taskId)
    if (error) {
      console.error('[Tasks] 任务还原失败:', error)
      throw error
    }
    console.log('[Tasks] 任务还原请求已发送', taskId, '等待 Realtime 响应...')
  }
  // 更新任务
  async function updateTask(taskId: string, updates: TaskUpdate) {
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) {
      console.error('[Tasks] 任务更新失败:', error)
      throw error
    }
    console.log('[Tasks] 任务更新请求已发送', taskId, '等待 Realtime 响应...')
  }


  return {
    // 状态
    isLoading,
    isRealtimeActive,
    metadata,
    // 只读数据:
    // 活跃任务表
    active: computed(() => Object.values(allTasks).filter(t => !t.deleted_at)),
    // 生命周期管理
    initialize,
    openRealtimeChannel,
    closeRealtimeChannel,
    // 基本任务管理
    createTask,
    deleteTask,
    restoreTask,
    updateTask,
  }
})
