
-- 创建用户配置表

CREATE TABLE IF NOT EXISTS public.profiles (
  -- 主键，直接引用 auth.users，级联删除
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  display_name text,     -- [可选] 昵称
  avatar_url text,       -- [可选] 头像 URL
  user_name text UNIQUE, -- [可选] 唯一用户名
  -- 最后更新时间
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 行级安全策略 (RLS)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- 允许所有人查看用户配置（如昵称和头像）
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
-- 允许用户更新自己的配置 (无需设置插入和删除权限，因为会随着用户的创建和删除自动维护)
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);


-- 索引
-- 不需要额外创建索引，因为此表基本只用 id 进行查询, id 作为主键已经自动包含索引。


-- 触发器: 新用户注册后，自动创建配置行

CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS trigger         -- RETURN 语句必须紧接函数名
SECURITY DEFINER        -- 以函数创建者权限执行，确保有权限操作 auth.users 表
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  -- 【被动清理】新注册时有 10% 的概率执行僵尸用户清理 (超 24h 未验证的用户)
  -- IF random() < 0.1 THEN
  --   DELETE FROM auth.users 
  --   WHERE email_confirmed_at IS NULL 
  --     AND created_at < pg_catalog.NOW() - INTERVAL '24 hours';
  -- END IF;

  -- 【创建配置】为新用户插入配置行
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 绑定触发器到 auth.users 的 AFTER INSERT 事件
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; -- 删除旧的同名触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_setup();


-- 触发器: 用户配置被修改时，自动更新 updated_at 字段

CREATE OR REPLACE FUNCTION public.sync_user_profile_timestamp()
RETURNS trigger 
SET search_path = ''    -- 设置 search_path, 避免 Function Search Path Mutable 安全警告
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 绑定触发器到 profiles
DROP TRIGGER IF EXISTS tr_update_user_profile_timestamp ON public.profiles;
CREATE TRIGGER tr_update_user_profile_timestamp
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW
  -- 只有当新旧行数据不一致时，才更新时间戳
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION sync_user_profile_timestamp();


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