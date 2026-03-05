# PlayGround

项目试验场

# 后端

- 初始化: `supabase init`

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
