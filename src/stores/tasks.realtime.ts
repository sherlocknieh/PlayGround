import type { Ref } from 'vue'
import { ref } from 'vue'

import { supabase } from '@/lib/supabase'
import { createLogger } from '@/utils/logger'
import type { Task, Payload } from './tasks.types'

interface UseRealtimeOptions {
  tasks: Ref<Task[]>
  isRealtimeActive: Ref<boolean>
  fetchAllTasks: () => Promise<void>
}

export function useRealtime(options: UseRealtimeOptions) {
  const logger = createLogger('TaskRealtime', { namespace: 'Realtime' })
  const { tasks, isRealtimeActive, fetchAllTasks } = options
  const channelRef = ref<any | null>(null)
  const manuallyClosed = ref(false)
  const reconnectTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = 2000
  const reconnectableStatuses = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])

  function clearReconnectTimer() {
    if (reconnectTimer.value) {
      clearTimeout(reconnectTimer.value)
      reconnectTimer.value = null
    }
  }

  async function closeChannel() {
    if (!channelRef.value) return

    const current = channelRef.value
    channelRef.value = null
    logger.log('Closing current realtime channel')
    await supabase.removeChannel(current)
  }

  function handleRealtimePayload(payload: Payload) {
    switch (payload.eventType) {
      case 'INSERT': {
        const task = payload.new as Task
        if (!task.deleted_at && !tasks.value.some(t => t.id === task.id)) {
          tasks.value.unshift(task)
        }
        return
      }
      case 'UPDATE': {
        const task = payload.new as Task
        const idx = tasks.value.findIndex(t => t.id === task.id)
        if (idx >= 0) {
          tasks.value[idx] = task
        } else {
          tasks.value.unshift(task)
        }
        return
      }
      case 'DELETE': {
        const task = payload.old as Task
        tasks.value = tasks.value.filter(t => t.id !== task.id)
      }
    }
  }

  function scheduleReconnect() {
    if (
      manuallyClosed.value ||
      reconnectTimer.value ||
      isRealtimeActive.value
    ) {
      return
    }

    logger.warn(`Retry in ${reconnectDelay}ms`)
    reconnectTimer.value = setTimeout(() => {
      reconnectTimer.value = null
      if (!manuallyClosed.value) {
        void openRealtimeChannel(true)
      }
    }, reconnectDelay)
  }

  async function openRealtimeChannel(fromReconnect = false) {
    manuallyClosed.value = false
    clearReconnectTimer()

    await closeChannel()

    channelRef.value = supabase
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
        isRealtimeActive.value = status === 'SUBSCRIBED'

        if (status === 'SUBSCRIBED') {
          logger.log('Realtime subscribed successfully')
          if (fromReconnect) {
            void fetchAllTasks()
          }
          return
        }

        if (reconnectableStatuses.has(status)) {
          scheduleReconnect()
        }
      })
  }

  function closeRealtimeChannel() {
    manuallyClosed.value = true
    clearReconnectTimer()
    void closeChannel()
    isRealtimeActive.value = false
  }

  return {
    openRealtimeChannel,
    closeRealtimeChannel
  }
}