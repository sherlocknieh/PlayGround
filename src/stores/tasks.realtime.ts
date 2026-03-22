import type { Ref } from 'vue'
import { ref } from 'vue'

import { supabase } from '@/lib/supabase'
import { createLogger } from '@/utils/logger'
import type { Task, Payload } from './tasks.types'

interface UseRealtimeOptions {
  tasks: Ref<Task[]>
  isRealtimeActive: Ref<boolean>
  currentUserId: Ref<string | null>
  fetchAllTasks: (userId: string) => Promise<void>
}

export function useRealtime(options: UseRealtimeOptions) {
  const logger = createLogger('TaskRealtime', { namespace: 'Realtime' })

  const { tasks, isRealtimeActive, currentUserId, fetchAllTasks } = options
  const reconnectableStatuses = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

  // 开启 Realtime 订阅, 并维护连接状态
  async function openRealtimeChannel(userId: string, fromReconnect = false) {
    isManuallyClosed.value = false
    clearReconnectTimer()
    await closeChannel()

    logger.log('Opening realtime channel for user:', userId)
    logger.log('Starting subscription with filter: user_id=eq.' + userId)

    const channel = supabase
      .channel('tasks-realtime-' + userId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`
        },
        (payload) => handleRealtimePayload(payload as Payload)
      )
      .subscribe((status) => {
        logger.log(`Subscription status: ${status}`)
        isRealtimeActive.value = status === 'SUBSCRIBED'

        if (status === 'SUBSCRIBED') {
          resetReconnectAttempts()
          logger.log('Realtime subscribed successfully')
          if (fromReconnect) {
            // 重连成功后补拉，避免离线窗口内漏事件。
            void fetchAllTasks(userId)
          }
          return
        }

        if (reconnectableStatuses.has(status)) {
          scheduleReconnect()
        } else {
          logger.warn('Realtime subscription status:', status)
        }
      })

    channelRef.value = channel
  }

  // 处理 Realtime 事件，保持状态更新路径单一
  function handleRealtimePayload(payload: Payload) {
    const eventType = payload.eventType
    const taskId = getPayloadTaskId(payload)
    logger.log(`Event ${eventType} - Task ${taskId}`, payload)

    switch (eventType) {
      case 'INSERT':
        handleInsertEvent(payload.new as Task)
        return
      case 'UPDATE':
        handleUpdateEvent(payload.new as Task)
        return
      case 'DELETE':
        handleDeleteEvent(payload.old as Task)
        return
      default:
        logger.warn('Unhandled realtime event type:', eventType)
    }
  }

  // 关闭 Realtime 订阅, 清理重连状态
  function closeRealtimeChannel() {
    logger.log('Cleaning up Realtime channel...')
    markManualClosed()
    disposeReconnect()
    void closeChannel()
    isRealtimeActive.value = false
    logger.log('Store disposed')
  }

  // Realtime channel 与重连状态
  const channelRef = ref<any | null>(null)
  const isManuallyClosed = ref(false)
  const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = ref(0)

  // 指数退避参数
  const baseDelay = 1000
  const maxDelay = 30000

  // 手动关闭时不触发自动重连
  function markManualClosed() {
    isManuallyClosed.value = true
  }

  function clearReconnectTimer() {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
  }

  function resetReconnectAttempts() {
    reconnectAttempts.value = 0
  }

  // 统一关闭旧 channel，避免重复订阅
  async function closeChannel() {
    if (!channelRef.value) return

    const current = channelRef.value
    channelRef.value = null
    logger.log('Closing current realtime channel')
    await supabase.removeChannel(current)
  }

  function getPayloadTaskId(payload: Payload) {
    return (
      (payload.new as Partial<Task> | null)?.id ||
      (payload.old as Partial<Task> | null)?.id ||
      'unknown'
    )
  }

  function handleInsertEvent(newTask: Task) {
    if (!newTask.deleted_at && !tasks.value.find(t => t.id === newTask.id)) {
      tasks.value.unshift(newTask)
      logger.log(`Insert added task (${newTask.id}): "${newTask.title}"`)
      return
    }

    if (newTask.deleted_at) {
      logger.warn(`Insert skipped deleted task (${newTask.id})`)
      return
    }

    logger.warn(`Insert skipped existing task (${newTask.id})`)
  }

  function handleUpdateEvent(updated: Task) {
    const idx = tasks.value.findIndex(t => t.id === updated.id)
    logger.log(`Update task ${updated.id} at index ${idx}`)

    if (updated.deleted_at) {
      if (idx >= 0) {
        tasks.value[idx] = updated
        logger.log(`Soft delete moved task to recycle bin (${updated.id})`)
      } else {
        tasks.value.unshift(updated)
        logger.log(`Soft delete added task to recycle bin (${updated.id})`)
      }
      return
    }

    if (idx >= 0) {
      tasks.value[idx] = updated
      logger.log(`Updated task (${updated.id}): "${updated.title}" - status: ${updated.status}`)
      return
    }

    tasks.value.unshift(updated)
    logger.log(`Recovered task and added (${updated.id}): "${updated.title}"`)
  }

  function handleDeleteEvent(deleted: Task) {
    const initialCount = tasks.value.length
    tasks.value = tasks.value.filter(t => t.id !== deleted.id)

    if (tasks.value.length < initialCount) {
      logger.log(`Hard delete removed task from list (${deleted.id})`)
    } else {
      logger.log(`Hard delete task not in list (${deleted.id})`)
    }
  }

  // 订阅断开后执行指数退避重连
  function scheduleReconnect() {
    if (
      isManuallyClosed.value ||
      reconnectTimer.value ||
      isRealtimeActive.value ||
      !currentUserId.value
    ) {
      return
    }

    reconnectAttempts.value += 1
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttempts.value - 1) + Math.floor(Math.random() * 500),
      maxDelay
    )

    logger.warn(`Attempt ${reconnectAttempts.value}, retry in ${delay}ms`)
    reconnectTimer.value = setTimeout(() => {
      reconnectTimer.value = null
      const userId = currentUserId.value
      if (!isManuallyClosed.value && userId) {
        void openRealtimeChannel(userId, true)
      }
    }, delay)
  }

  function disposeReconnect() {
    clearReconnectTimer()
    resetReconnectAttempts()
  }

  return {
    openRealtimeChannel,
    closeRealtimeChannel,
    handleRealtimePayload
  }
}