-- 创建任务状态枚举类型
CREATE TYPE public.task_status AS ENUM ('todo', 'doing', 'done');

-- 任务表 (tasks)
CREATE TABLE public.tasks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES tasks(id) ON DELETE CASCADE,            -- 父任务 ID，用于构建树形结构
    
    title       TEXT NOT NULL DEFAULT '',   -- 任务标题
    description TEXT,                       -- 任务详情
    status      task_status NOT NULL DEFAULT 'todo', -- 任务状态

    deadline    TIMESTAMPTZ,              -- 截止时间
    start_time  TIMESTAMPTZ,              -- 开始时间
    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 创建时间
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 最后更新时间
    deleted_at  TIMESTAMPTZ,                            -- 软删除
    
    sort_order   REAL,                     -- 排序键，用于自定义任务顺序
    metadata     JSONB DEFAULT '{}'::JSONB -- 通用扩展字段
);


-- 行级安全策略 (RLS)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
-- 允许用户操作自己的任务（包括查看、更新、删除），不允许访问其他用户的任务
CREATE POLICY "Users can operate own tasks" ON public.tasks FOR ALL 
USING ((select auth.uid()) = user_id)       -- 针对表中已有数据的检查
WITH CHECK ((select auth.uid()) = user_id); -- 针对刚插入的新数据的检查


-- 索引：加速树形结构展示和 RLS 过滤
CREATE INDEX idx_tasks_user_parent ON public.tasks(user_id, parent_id) WHERE deleted_at IS NULL;
-- 其它索引等 Supabase 提出索引优化建议后再添加


-- 触发器：自动更新 updated_at 时间戳
CREATE OR REPLACE FUNCTION public.update_task_timestamp()
RETURNS TRIGGER
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
   -- 修改 updated_at 字段为当前时间
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 创建触发器，在 tasks 表的 UPDATE 操作前执行
CREATE TRIGGER trigger_update_task_timestamp
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_task_timestamp();

-- 触发器：自动设置 sort_order，确保同一父任务下的子任务有序
CREATE OR REPLACE FUNCTION public.set_default_sort_order()
RETURNS TRIGGER
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  -- 若用户未指定 sort_order 值，则根据当前父任务下的最大 sort_order 生成新值
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1
    INTO NEW.sort_order
    FROM public.tasks
    WHERE user_id = NEW.user_id 
      AND (parent_id = NEW.parent_id OR (parent_id IS NULL AND NEW.parent_id IS NULL));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 创建触发器，在 tasks 表的 INSERT 操作前执行
CREATE TRIGGER trigger_set_sort_order
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_default_sort_order();


-- RPC 函数：软删除任务 (及其子任务)
CREATE OR REPLACE FUNCTION public.soft_delete_tasks(
  task_ids UUID[]           -- 传入要删除的任务 ID 列表
)
RETURNS SETOF public.tasks  -- 返回被删除的任务列表
SET search_path = ''        -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
SECURITY INVOKER            -- 以调用者权限执行，确保只能删除自己的任务
AS $$
DECLARE
  target_ids UUID[];                    -- 最终要软删除的任务 ID 集合
  deleted_at_now TIMESTAMPTZ := NOW();  -- 统一删除时间，保证同一批记录时间一致
BEGIN
  -- task_ids 为 NULL 或空数组时，不做任何更新
  IF task_ids IS NULL OR array_length(task_ids, 1) IS NULL THEN
    RETURN;  -- 返回空结果集
  END IF;

  -- 递归收集根任务 + 所有后代任务

  -- 定义递归表 task_tree
  WITH RECURSIVE task_tree AS (
  -- 它会不断用上一轮的查询结果参与下一轮查询, 直到没有新增的结果为止

    -- 初始查询：找到参数中 ID 所指定的任务（根任务）
    SELECT t.id FROM public.tasks t
    WHERE t.id = ANY(task_ids)      -- 找到参数中ID所指定的任务
      AND t.user_id = auth.uid()    -- 排除不属于当前用户的任务
      AND t.deleted_at IS NULL      -- 排除已经被软删除的任务

    UNION                           -- 把递归查询结果并入结果中

    -- 递归查询：用初始查询的结果继续查找子任务
    SELECT c.id FROM public.tasks c JOIN task_tree tt
    ON c.parent_id = tt.id          -- 找到 task_tree 中任务的所有子任务
    WHERE c.user_id = auth.uid()    -- 继续限制为当前用户
      AND c.deleted_at IS NULL      -- 排除已软删除的任务
  )

  -- 将递归结果汇总 (array_agg) 为数组, 存入 target_ids 变量
  -- COALESCE 用于把 NULL 结果转化为空数组 []::UUID[]
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
  INTO target_ids FROM task_tree;

  -- 是空数组则直接返回
  IF array_length(target_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- 执行软删除：把 deleted_at 置为统一时间戳
  RETURN QUERY
  UPDATE public.tasks t
  SET deleted_at = deleted_at_now
  WHERE t.id = ANY(target_ids)
    AND t.user_id = auth.uid()

  -- 返回所有被更新的任务记录
  RETURNING t.*;
END;
$$ LANGUAGE plpgsql;

-- 用法示例：

-- SELECT * FROM public.soft_delete_tasks(ARRAY[UUID1]);
-- SELECT * FROM public.soft_delete_tasks(ARRAY[UUID1, UUID2]);

-- 前端调用:
-- const result = await supabase.rpc('soft_delete_tasks', { task_ids: [UUID1, UUID2] });
