import { ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

import type { TaskInsert, TaskUpdate, TaskMap, SubTaskMap, MetaDataMap, Payload } from './tasks.types'

// 常量
const ROOT_ID = 'root'
const REALTIME_ACK_TIMEOUT_MS = 5000

type MutationKind = 'insert' | 'update' | 'delete'

type RealtimeMutation = {
  kind: MutationKind
  taskId: string
  resolve: () => void
  timeoutId: ReturnType<typeof setTimeout>
}

type PendingMutationState = Record<string, MutationKind | undefined>

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
  const _pendingMutations = reactive<PendingMutationState>({})
  const _mutationWaiters = new Map<string, RealtimeMutation>()

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
        _resolveRealtimeMutation('insert', taskId)
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
        _resolveRealtimeMutation('update', taskId)
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
        _resolveRealtimeMutation('delete', taskId)
        break
      }
    }
  }
  // 等待对应的 Realtime 响应
  function _waitForRealtimeMutation(kind: MutationKind, taskId: string) {
    const key = `${kind}:${taskId}`

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error('等待 Realtime 响应超时')
        delete _pendingMutations[key]
        _mutationWaiters.delete(key)
        reject(error)
      }, REALTIME_ACK_TIMEOUT_MS)

      _pendingMutations[key] = kind
      _mutationWaiters.set(key, { kind, taskId, resolve, timeoutId })
    })
  }
  // 取消指定的 Realtime 等待
  function _cancelRealtimeMutation(kind: MutationKind, taskId: string) {
    const key = `${kind}:${taskId}`
    const pending = _mutationWaiters.get(key)
    if (!pending) { return }

    clearTimeout(pending.timeoutId)
    delete _pendingMutations[key]
    _mutationWaiters.delete(key)
  }
  // 处理 Realtime 响应，解除对应等待
  function _resolveRealtimeMutation(kind: MutationKind, taskId: string) {
    const key = `${kind}:${taskId}`
    const pending = _mutationWaiters.get(key)
    if (!pending) { return }

    clearTimeout(pending.timeoutId)
    delete _pendingMutations[key]
    _mutationWaiters.delete(key)
    pending.resolve()
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
    const taskId = data.id || crypto.randomUUID()
    const waitForInsert = _waitForRealtimeMutation('insert', taskId)
    const { error } = await supabase.from('tasks').insert({ ...data, id: taskId })
    if (error) {
      console.error('[Tasks] Create task failed: database insert error', error)
      _cancelRealtimeMutation('insert', taskId)
      throw error
    }

    await waitForInsert
    console.log('[Tasks] 任务创建已收到 Realtime 响应', taskId)
  }
  // 删除任务
  async function deleteTask(taskId: string, method: 'soft' | 'hard' = 'soft') {
    const mutationKind: MutationKind = method === 'hard' ? 'delete' : 'update'
    const waitForMutation = _waitForRealtimeMutation(mutationKind, taskId)

    // 硬删除
    if (method === 'hard') {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) {
        console.error('[Tasks] 任务删除失败:', error)
        _cancelRealtimeMutation(mutationKind, taskId)
        throw error
      }
    }
    // 软删除
    if (method === 'soft') {
      const { error } = await supabase.rpc('soft_delete_tasks', { task_ids: [taskId] })
      if (error) {
        console.error('[Tasks] 任务软删除失败:', error)
        _cancelRealtimeMutation(mutationKind, taskId)
        throw error
      }
    }

    await waitForMutation
    console.log('[Tasks] 任务删除已收到 Realtime 响应', taskId)
  }
  // 更新任务
  async function updateTask(taskId: string, updates: TaskUpdate) {
    const waitForUpdate = _waitForRealtimeMutation('update', taskId)

    const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)
    if (error) {
      console.error('[Tasks] 任务更新失败:', error)
      _cancelRealtimeMutation('update', taskId)
      throw error
    }

    await waitForUpdate
    console.log('[Tasks] 任务更新已收到 Realtime 响应', taskId)
  }
  return {
    // 只读状态:
    lastError: computed(() => lastError.value),
    isLoading: computed(() => isLoading.value),
    realtimeActive: computed(() => realtimeActive.value),
    // 数据:
    metadata,
    isTaskMutating: (taskId: string, kind?: MutationKind) => {
      if (kind) { return _pendingMutations[`${kind}:${taskId}`] === kind }
      return Object.keys(_pendingMutations).some(key => key.endsWith(`:${taskId}`))
    },
    active: computed(() => Object.values(allTasks).filter(t => !t.deleted_at && t.status !== 'done')),
    completed: computed(() => Object.values(allTasks).filter(t => !t.deleted_at && t.status === 'done')),
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
