
-- 1.创建用户配置表
CREATE TABLE IF NOT EXISTS profiles (
  -- 主键，直接引用 auth.users，级联删除
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  -- 昵称和头像URL
  display_name text,
  avatar_url text,
  -- 默认当前时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);


-- 2. 行级安全策略 (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = (SELECT auth.uid()));
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (id = (SELECT auth.uid()));


-- 3.初始化函数：注册新用户时【创建配置】并【清理僵尸用户】
CREATE OR REPLACE FUNCTION handle_new_user_setup()
RETURNS trigger AS $$
BEGIN
  -- 【被动清理】新注册时有 10% 的概率执行僵尸用户清理 (超 24h 未验证的用户)
  IF random() < 0.1 THEN
    DELETE FROM auth.users 
    WHERE email_confirmed_at IS NULL 
      AND created_at < NOW() - INTERVAL '24 hours';
  END IF;

  -- 【创建配置】为新用户插入配置行
  INSERT INTO profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 auth.users
-- 注意：如果之前创建过，建议先 DROP 以防冲突
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_setup();


-- 4. 时间戳更新函数：用户配置变化时更新
CREATE OR REPLACE FUNCTION sync_user_profile_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器到 profiles
DROP TRIGGER IF EXISTS tr_update_user_profile_timestamp ON profiles;
CREATE TRIGGER tr_update_user_profile_timestamp
  BEFORE UPDATE ON profiles 
  FOR EACH ROW
  -- 只有当新旧行数据不一致时，才更新时间戳
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION sync_user_profile_timestamp();


-- 5.创建索引
-- 不需要额外为 id 创建索引，因为 PRIMARY KEY 已经自动创建了唯一索引。

