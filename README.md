# PlayGround

项目试验场

# 后端

- 初始化: `supabase init`

### 连接项目
  - 登录账户: `npx supabase login [--no-browser]` 
  - 连接项目: `npx supabase link` 

### 数据库管理
  - 创建迁移脚本: `npx supabase migration new <title>`
  - 推送更改到远程: `npx supabase db push`
  - 重置远程数据库: `npx supabase db reset --linked`

### 边缘函数管理
  - 创建边缘函数: `npx supabase functions new hello-world`
  - 部署边缘函数: `npx supabase functions deploy hello-world`
  - 取消部署函数: `npx supabase functions delete hello-world`
  - [访问官方教程](https://supabase.com/docs/guides/functions/quickstart);


### 客户端接入准备
- 获取 `Project URL` 和 `Publishable Key`:
  - 在项目主页顶部 `Connect` 按钮中 `API Keys` 子选项卡获取
  - 填入 .env 文件: (遵循 Vite 项目规范, 以 `VITE_` 开头)
    ```
    VITE_SUPABASE_URL=<Project URL>
    VITE_SUPABASE_KEY=<Publishable Key>
    ```
- 关闭 `Confirm email` 选项:
  - 在 `<项目主页>/auth/providers` 中关闭
  - 可简化注册流程, 并避免回调 URL 与哈希路由不兼容的问题

- 配置注册回调 URL:
  - 在 `<项目主页>/auth/url-configuration` 的 `Redirect URLs` 区域添加:
  - `http://localhost:*/**`  (本地开发)
  - `https://*.github.io/**` (生产环境)
  - 客户端注册时要指定回调 URL:
    ```ts
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/PlayGround/`, // 注册成功后重定向的 URL
      },
    })
    ```
  - 完成这些配置后, 才建议开启 `Confirm email` 功能, 否则用户注册成功后无法正确回到应用, 会以为注册失败.

# 前端

- 初始化: `npm create vite@latest`
  - Project name: `.`
  - Package name: `playground`
  - Framework: `Vue`
  - Language: `TypeScript`
- 引入第三方库:
  - tailwindcss: `npm install tailwindcss @tailwindcss/vite`
  - vue-router: `npm install vue-router@4`
  - supabase-js: `npm install @supabase/supabase-js`
  - pinia: `npm install pinia`