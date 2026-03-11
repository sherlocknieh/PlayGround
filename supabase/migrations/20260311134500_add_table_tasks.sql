-- 任务表 (tasks)
CREATE TABLE public.tasks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id   UUID REFERENCES tasks(id) ON DELETE CASCADE,            -- 父任务 ID，用于构建树形结构
    
    title       TEXT NOT NULL DEFAULT '',   -- 任务标题
    description TEXT,                       -- 任务详情
    status      TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    deadline    TIMESTAMPTZ,              -- 截止时间
    start_time  TIMESTAMPTZ,              -- 开始时间

    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 创建时间
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 最后更新时间
    deleted_at  TIMESTAMPTZ,                            -- 软删除
    
    sort_order   REAL DEFAULT 0,          -- 排序键，用于自定义任务顺序
    metadata    JSONB DEFAULT '{}'::JSONB -- 通用扩展字段
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
  -- 若未指定 sort_order 值，则根据当前父任务下的最大 sort_order 生成新值
  IF NEW.sort_order IS NULL THEN
    SELECT COALESCE(MAX(sort_order), 0) + 65536.0 
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