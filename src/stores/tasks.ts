import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

import type { TaskInsert, TaskUpdate, TaskMap, SubTaskMap, MetaDataMap, Payload } from './tasks.types'

// 常量
const ROOT_ID = 'root'

// 基于 Realtime 的任务数据管理
export const useTasksStore = defineStore('tasks', () => {

  // 任务索引表
  const allTasks = reactive<TaskMap>({})
  // 子任务关系表
  const subTasks = reactive<SubTaskMap>({})
  // 元数据索引表
  const metadata = reactive<MetaDataMap>({})

  // 全局状态
  const isLoading = ref(false)
  const realtimeActive = ref(false)
  const lastError = ref<unknown>(null)

  // 内部变量
  let _isInitialized = false
  let _hasSetReconnectEvents = false
  let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null

  // 初始化
  async function initialize() {
    if (_isInitialized) { return }
    isLoading.value = true
    try {
      lastError.value = null
      await _fetchAllTasks() // 加载初始数据
      initRealtime() // 启动 Realtime 订阅
      _isInitialized = true
      console.log('[Tasks] TasksStore 初始化完成')
    }
    catch (error) {
      lastError.value = error
      throw error
    }
    finally {
      isLoading.value = false
    }
  }
  // 启动 Realtime 订阅
  function initRealtime() {
    if (realtimeActive.value) { return }
    _realtimeChannel?.unsubscribe()
    _realtimeChannel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => _handlePayload(payload as Payload)
      )
      .subscribe((status) => {
        // 此处能持续监听后续连接状态变化
        realtimeActive.value = (status === 'SUBSCRIBED')
        if (status !== 'SUBSCRIBED') { _realtimeChannel = null }
        console.log(`[Realtime] Realtime 订阅状态: ${status}`)
      }
      )
    // 设置重连条件
    _setReconnectEvents()
  }
  // 关闭 Realtime 订阅
  function closeRealtime() {
    _realtimeChannel?.unsubscribe()
    _realtimeChannel = null
    realtimeActive.value = false
  }
  // 辅助函数: 加载所有任务
  async function _fetchAllTasks() {
    // 查询数据库, 获取所有任务
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) throw error

    // 重置索引表
    Object.keys(allTasks).forEach((key) => delete allTasks[key])
    Object.keys(subTasks).forEach((key) => delete subTasks[key])
    Object.keys(metadata).forEach((key) => delete metadata[key])

    // 一遍扫描, 构建索引数据
    data?.forEach(task => {
      // 填充任务索引表
      allTasks[task.id] = task
      // 填充元数据索引表
      metadata[task.id] ??= { isExpanded: false }
      // 填充子任务索引表
      addChild(task.parent_id, task.id)
    })
    console.log(`[Tasks] 从数据库取得 ${data?.length || 0} 个任务`)
  }
  // 辅助函数: 在特定事件发生时尝试重连 Realtime
  function _reconnect(event: 'visibilitychange' | 'focus' | 'pageshow') {
    if (!_isInitialized || realtimeActive.value) { return }
    console.log(
      `[Realtime] ${event}: visibility=${typeof document !== 'undefined' ? document.visibilityState : 'unknown'}, initialized=${_isInitialized}, active=${realtimeActive.value}`
    )
    initRealtime()
  }
  // 辅助函数: 特定条件触发 Realtime 重连
  function _setReconnectEvents() {
    if (_hasSetReconnectEvents) { return }
    if (typeof document === 'undefined' || typeof window === 'undefined') { return }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        _reconnect('visibilitychange')
      }
    })

    window.addEventListener('focus', () => {
      _reconnect('focus')
    })

    window.addEventListener('pageshow', () => {
      _reconnect('pageshow')
    })

    _hasSetReconnectEvents = true
  }
  // 处理 Realtime 负载
  function _handlePayload(payload: Payload) {
    switch (payload.eventType) {
      case 'INSERT': {
        console.log('[Realtime] 收到 INSERT 事件:', payload.new)
        // 处理插入事件
        const taskId = payload.new.id
        allTasks[taskId] = payload.new
        // 初始化元数据
        metadata[taskId] ??= { isExpanded: false }
        // 处理父子关系
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
        // 初始化元数据
        metadata[taskId] ??= { isExpanded: false }
        // 处理父任务变更
        const newParentId = newData?.parent_id || ROOT_ID
        const oldParentId = payload.old?.parent_id || oldData?.parent_id || ROOT_ID
        if (newParentId !== oldParentId) {
          // 从旧父任务的子任务列表中移除
          removeChild(oldParentId, taskId)
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
        removeChild(payload.old.parent_id, taskId)
        delete allTasks[taskId]
        delete metadata[taskId]
        delete subTasks[taskId]
        break
      }
    }
  }
  // 辅助函数: 添加子元素关系
  function addChild(parentId: string | null | undefined, childId: string) {
    const key = parentId || ROOT_ID
    subTasks[key] ??= []
    if (!subTasks[key].includes(childId)) {
      subTasks[key].push(childId)
    }
  }
  // 辅助函数: 移除子元素关系
  function removeChild(parentId: string | null | undefined, childId: string) {
    const key = parentId || ROOT_ID
    const list = subTasks[key]
    if (!list?.length) { return }
    subTasks[key] = list.filter(id => id !== childId)
    if (subTasks[key].length === 0 && key !== ROOT_ID) {
      delete subTasks[key]
    }
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
  // 更新任务
  async function updateTask(taskId: string, updates: TaskUpdate) {
    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) {
      console.error('[Tasks] 任务更新失败:', error)
      throw error
    }
    console.log('[Tasks] UPDATE 请求已发送', '等待 Realtime 响应...')
  }
  return {
    // 只读状态:
    lastError: computed(() => lastError.value),
    isLoading: computed(() => isLoading.value),
    realtimeActive: computed(() => realtimeActive.value),
    // 数据:
    metadata,
    active: computed(() => Object.values(allTasks).filter(t => !t.deleted_at)),
    deleted: computed(() => Object.values(allTasks).filter(t => t.deleted_at)),
    // 生命周期管理
    initialize,
    initRealtime,
    closeRealtime,
    // 基本任务管理
    createTask,
    deleteTask,
    updateTask,
  }
})
