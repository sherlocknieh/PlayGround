# PlayGround

项目试验场


# 后端管理命令

## 连接项目
  - 登录到 Supabase 账户: `npx supabase login [--no-browser]` 
  - 连接到 Supabase 项目: `npx supabase link` 

### 数据库迁移
  - 创建迁移脚本: `npx supabase migration new <title>`
  - 推送到远程: `npx supabase db push`
  - 重置数据库: `npx supabase db reset --linked`

### 边缘函数开发 [(官方教程)](https://supabase.com/docs/guides/functions/quickstart);
  - 创建边缘函数: `npx supabase functions new hello-world`
  - 部署边缘函数: `npx supabase functions deploy hello-world`
  - 取消部署函数: `npx supabase functions delete hello-world`
