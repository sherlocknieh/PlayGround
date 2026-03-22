import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'


// 1. 基础数据类型 (Supabase)

// 后端任务表结构 (Supabase "tasks" 表)
export type Task = Tables<'tasks'>
export type TaskInsert = TablesInsert<'tasks'>
export type TaskUpdate = TablesUpdate<'tasks'>
export type TaskStatus = Enums<'task_status'>

// Realtime 负载 (Supabase)
export type Payload = RealtimePostgresChangesPayload<Task>

// 任务元数据 (UI状态等非核心数据)
export type MetaData = {
  isExpanded: boolean,
}

// 2. 存储层 (Pinia State)

// 任务索引表
export type TaskMap = Record<string, Task>
// 层级索引表
export type SubTaskMap = Record<string, string[]>
// 任务元数据索引表
export type MetaDataMap = Record<string, MetaData>


// 3. 视图层 (UI Composition)

// 扁平化节点列表
export interface TaskNode {
  task: Task              // 引用 Pinia 中的原始响应式对象
  depth: number           // 层级深度
  hasChildren: boolean    // 是否有子节点
  isExpanded: boolean     // 展开状态
  childIds: string[]      // 子节点 ID 列表
}