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
  const lastError = ref<unknown>(null)
  const realtimeChannel = ref<ReturnType<typeof supabase.channel> | null>(null)

  const ROOT_ID = 'root'

  function normalizeParentId(parentId: string | null | undefined) {
    return parentId || ROOT_ID
  }

  function resetIndexes() {
    Object.keys(allTasks).forEach((key) => delete allTasks[key])
    Object.keys(subTasks).forEach((key) => delete subTasks[key])
    Object.keys(metadata).forEach((key) => delete metadata[key])
  }

  function ensureMetadata(taskId: string) {
    metadata[taskId] ??= { isExpanded: false }
  }

  function addChild(parentId: string | null | undefined, childId: string) {
    const key = normalizeParentId(parentId)
    subTasks[key] ??= []
    if (!subTasks[key].includes(childId)) {
      subTasks[key].push(childId)
    }
  }

  function removeChild(parentId: string | null | undefined, childId: string) {
    const key = normalizeParentId(parentId)
    const list = subTasks[key]
    if (!list?.length) { return }
    subTasks[key] = list.filter(id => id !== childId)
    if (subTasks[key].length === 0 && key !== ROOT_ID) {
      delete subTasks[key]
    }
  }

  function removeTaskFromAllParents(taskId: string) {
    Object.keys(subTasks).forEach((parentId) => {
      removeChild(parentId, taskId)
    })
  }

  // 初始化: 加载初始数据 + 启动订阅
  async function initialize() {
    if (isInitialized.value) { return }
    isLoading.value = true

    try {
      lastError.value = null
      await fetchAllTasks() // 加载初始数据
      openRealtimeChannel() // 启动 Realtime 订阅
      isInitialized.value = true
      console.log('[TasksStore] Initialized')
    }
    catch (error) {
      lastError.value = error
      throw error
    }
    finally {
      isLoading.value = false
    }
  }
  // 加载所有任务
  async function fetchAllTasks() {
    // 查询数据库, 获取所有任务
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error

    resetIndexes()

    // 一遍扫描, 构建索引数据
    data?.forEach(task => {
      // 填充任务索引表
      allTasks[task.id] = task
      // 填充元数据索引表
      ensureMetadata(task.id)
      // 填充子任务索引表
      addChild(task.parent_id, task.id)
    })
    console.log(`[Tasks] 从数据库加载了 ${data?.length || 0} 个任务`)
  }
  // 启动 Realtime 订阅
  function openRealtimeChannel() {
    if (realtimeChannel.value) { return }

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
        if (status === 'CLOSED') {
          realtimeChannel.value = null
        }
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
        ensureMetadata(taskId)
        // 处理父子关系
        removeTaskFromAllParents(taskId)
        addChild(payload.new.parent_id, payload.new.id)
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
        ensureMetadata(taskId)
        // 处理父任务变更
        const newParentId = normalizeParentId(newData?.parent_id)
        const oldParentId = normalizeParentId(payload.old?.parent_id || oldData?.parent_id)
        if (newParentId !== oldParentId) {
          // 从旧父任务的子任务列表中移除
          removeTaskFromAllParents(taskId)
          // 添加到新父任务的子任务列表中
          addChild(newParentId, taskId)
        }
        else {
          // 防御性去重, 避免重放/乱序事件导致同父节点重复挂载
          addChild(newParentId, taskId)
        }
        break
      }
      case 'DELETE': {
        console.log('[Realtime] 收到 DELETE 事件:', payload.old)
        // 处理删除事件
        const taskId = payload.old.id as string
        removeTaskFromAllParents(taskId)
        delete allTasks[taskId]
        delete metadata[taskId]
        delete subTasks[taskId]
        break
      }
    }
  }
  // 关闭 Realtime 订阅
  function closeRealtimeChannel() {
    const channel = realtimeChannel.value
    if (channel) {
      channel.unsubscribe()
      realtimeChannel.value = null
    }
    isRealtimeActive.value = false
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
    isInitialized,
    isRealtimeActive,
    lastError,
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
