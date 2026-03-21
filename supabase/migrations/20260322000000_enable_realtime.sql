-- 为 tasks 表开启 Realtime 功能

-- 1. 将 tasks 表添加到 supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
-- 检验: SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 2. 允许认证用户接收 realtime 消息
CREATE POLICY "authenticated_users_can_receive" ON realtime.messages
  FOR SELECT TO authenticated USING (true);

-- 3. 允许认证用户发送 realtime 消息
CREATE POLICY "authenticated_users_can_send" ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4. 确保能收到 DELETE 事件消息
ALTER TABLE tasks REPLICA IDENTITY FULL;
-- Realtime 消息源于数据库日志;
-- 默认情况下 DELETE 事件日志非常精简, 只包含被删除行的主键, 即 id 字段
-- 我们的行级安全策略使用了 user_id 字段过滤数据, 故 DELETE 日志被过滤掉了
-- 设置 REPLICA IDENTITY FULL 开启详细日志, 就能正常接收 DELETE 事件消息了