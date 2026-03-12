import type { Tables } from '@/lib/database.types'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'


// 1. 基础数据库模型 (从 Supabase 自动生成)
export type Task = Tables<'tasks'>

// 2. 树形节点结构 (用于递归组件和逻辑关联)
export interface TaskNode extends Task {
  children: TaskNode[]
}

// 3. 索引表结构 (用于 O(1) 复杂度的快速查找)
export type TaskMap = Record<string, TaskNode>

// 4. 扁平缩进任务结构 (用于虚拟列表或高性能渲染)
export interface IndentedTask extends TaskNode {
  depth: number
  hasChildren: boolean
  isExpanded: boolean // 从 metadata 解析
}

// 5. 实时变化负载类型
export type Payload = RealtimePostgresChangesPayload<Task>