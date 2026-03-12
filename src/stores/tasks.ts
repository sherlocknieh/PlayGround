import { supabase } from '@/lib/supabase'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Task, TaskNode, TaskMap, IndentedTask, Payload } from './tasks.types'


export const useTasksStore = defineStore('tasks', () => {

  // 任务列表 (唯一数据源)
  const tasks = ref<Task[]>([])

  // 辅助变量
  const _isLoading = ref(false)
  const _isInitialized = ref(false)

  const taskMetadata = computed(() => {
    const map: TaskMap = {}
    
    // 1. 构建 Map (同时也是构建了内存中的引用树)
    // 第一遍：创建所有节点的拷贝（加上 children 容器）
    // 使用浅拷贝 {...t} 确保修改 Map 不会意外污染原始 tasks 数组
    tasks.value.forEach(t => {
      map[t.id] = { ...t, children: [] }
    })
    
    // 2. 建立父子引用关系
    tasks.value.forEach(t => {
      if (t.parent_id && map[t.parent_id]) {
        map[t.parent_id].children.push(map[t.id])
      }
      // else {
      //   rootIds.push(t.id)
      // }
    })
    
    
    // 对每一层的 children 进行排序 (基于 sort_order)
    // Object.values(map).forEach(node => {
    //   node.children.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    // })

    // 3. 只提取出“根节点”作为渲染入口
    const rootTasks = Object.values(map).filter(node => !node.parent_id)
  
    return { map, rootTasks }
  })
  
  // 暴露给外部使用
  const tasksById = computed(() => taskMetadata.value.map)
  const rootTasks = computed(() => taskMetadata.value.rootTasks)


  // 扁平缩进列表：用于虚拟滚动或简单列表渲染
  const indentTaskList = computed<IndentedTask[]>(() => {
    const list: IndentedTask[] = []
    
    function dfs(nodes: TaskNode[], depth: number) {
      nodes.forEach((node, index) => {
        list.push({
          ...node,
          depth,
          hasChildren: node.children.length > 0,
          isLastChild: index === nodes.length - 1
        })
        if (node.children.length > 0) {
          dfs(node.children, depth + 1)
        }
      })
    }

    dfs(rootTasks.value, 0)
    return list
  })


  // --- ACTIONS ---
  // 1. Fetch all tasks from Supabase
  async function fetchAllTasks() {
    _isLoading.value = true
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })

    _isLoading.value = false
    if (error) return console.error('Fetch error:', error)

    tasks.value = data || []
    _isInitialized.value = true
  }

  // 2. 开启数据库变化监听 (基于 WebSocket, 需要后端开启 Supabase Realtime)
  function initRealtime() {
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, _handlePayload)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }

  function _upsertTask(incoming: Task) {
    const index = tasks.value.findIndex(t => t.id === incoming.id)

    if (index === -1) {
      // 1. Insert: Just push to the array
      tasks.value.push(incoming)
    } else {
      // 2. Update: Conflict Resolution Logic
      const current = tasks.value[index]
      const currentTs = new Date(current.updated_at).getTime()
      const incomingTs = new Date(incoming.updated_at).getTime()

      // If incoming data is older than local data, ignore it (Stale update)
      if (incomingTs < currentTs) return

      // Reactive update at the specific index
      tasks.value[index] = { ...current, ...incoming }
    }
  }

  function _handlePayload(payload: Payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (newRecord) _upsertTask(newRecord as Task)
        break
      case 'DELETE':
        if (oldRecord?.id) {
          tasks.value = tasks.value.filter(t => t.id !== oldRecord.id)
        }
        break
    }
  }

  // --- MUTATIONS ---

  async function deleteTask(taskId: string, hardDelete: boolean = true) {
    if (hardDelete) {
      await supabase.from('tasks').delete().eq('id', taskId)
    } else {
      await supabase.rpc('soft_delete_tasks', { task_ids: [taskId] })
    }
    // Note: Realtime will handle the local state removal via _handlePayload
  }

  return {
    tasks,
    tasksById,
    isInitialized: computed(() => _isInitialized.value),
    fetchAllTasks,
    initRealtime,
    deleteTask
  }
})