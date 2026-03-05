-- 基本 Todo 表结构，支持树形结构、状态管理、排序等功能
CREATE TABLE public.todos (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id   BIGINT REFERENCES todos(id) ON DELETE CASCADE,            -- 父任务 ID，用于构建树形结构
    
    title       TEXT NOT NULL DEFAULT '',   -- 任务标题
    description TEXT,                       -- 任务详情
    status      TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    deadline    TIMESTAMPTZ,              -- 截止时间
    start_date  TIMESTAMPTZ,              -- 开始时间

    created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 创建时间
    updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,     -- 最后更新时间
    deleted_at  TIMESTAMPTZ,              -- 软删除
    
    sort_order   BIGINT DEFAULT 0,        -- 排序键，用于自定义任务顺序
    -- 扩展性字段
    metadata    JSONB DEFAULT '{}'::JSONB, -- 通用扩展字段
);

-- 行级安全策略 (RLS)
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
-- 允许用户操作自己的任务（包括查看、更新、删除），不允许访问其他用户的任务
CREATE POLICY "Users can operate own todos" ON public.todos FOR ALL USING ((select auth.uid()) = user_id);


-- 索引 (暂不处理, 后台开启索引优化建议，后续根据实际查询情况添加索引)



-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();