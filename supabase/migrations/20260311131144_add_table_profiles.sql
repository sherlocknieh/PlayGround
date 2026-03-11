
-- 创建用户配置表
CREATE TABLE IF NOT EXISTS public.profiles (
  -- 主键，直接引用 auth.users，级联删除
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  display_name text,     -- [可选] 昵称
  avatar_url text,       -- [可选] 头像 URL
  user_name text UNIQUE, -- [可选] 唯一用户名
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,  -- 最后更新时间
  settings JSONB DEFAULT '{}'::jsonb              -- 其它设置
);


-- 行级安全策略 (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 允许所有人查看用户配置（如昵称和头像）
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
-- 允许用户更新自己的配置 (无需设置插入和删除权限，因为会随着用户的创建和删除自动维护)
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);


-- 触发器: 新用户注册后，自动添加用户配置行
CREATE OR REPLACE FUNCTION public.add_user_profile()
RETURNS trigger         -- RETURN 语句必须紧接函数名
SECURITY DEFINER        -- 以函数创建者权限执行，确保权限足够创建配置行
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  -- 插入新用户配置行
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  -- 如用户已存在则忽略
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 关联到 auth.users 表的 INSERT 事件
DROP TRIGGER IF EXISTS trigger_on_user_created ON auth.users; -- 删除旧的同名触发器
CREATE TRIGGER trigger_on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION add_user_profile();


-- 触发器: 用户配置被修改时，自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION public.update_profile_timestamp()
RETURNS trigger 
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  -- 修改 updated_at 字段为当前时间
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 关联到 profiles 表的 UPDATE 事件
DROP TRIGGER IF EXISTS trigger_update_profile_timestamp ON public.profiles;
CREATE TRIGGER trigger_update_profile_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  -- 只有当新旧行数据不一致时，才更新时间戳
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION update_profile_timestamp();


-- RPC函数: 删除账号
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
SECURITY DEFINER        -- 以函数创建者权限执行，确保有权限操作 auth.users
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  -- 从 auth.users 表中删除当前用户
  DELETE FROM auth.users WHERE ((SELECT auth.uid()) = id);
END;
$$ LANGUAGE plpgsql;