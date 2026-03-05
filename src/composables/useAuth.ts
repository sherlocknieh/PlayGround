// @/composables/useAuth.ts
// 简易认证状态管理

import { ref, computed } from 'vue'

// 本地储存的认证状态结构 (简易示例)
interface Session {
  username: string
  expires_at: string
}


// 认证状态跟踪变量
const session = ref<Session | null>(null)

// 辅助变量
let _initialized = false


// 初始化
async function initAuth() {
  // 防止重复初始化 (针对在路由守卫中调用的情况, 防止每次路由变化都执行初始化逻辑)
  if (_initialized) return

  await new Promise(resolve => setTimeout(resolve, 500))  // 模拟网络请求延迟

  // 将 localStorage 中的认证状态同步到内存中 (只需在应用启动时执行一次, 可在 main.ts 或路由守卫中调用)
  session.value = JSON.parse(localStorage.getItem('session') || 'null')

  // 初始化完成
  _initialized = true
  console.log('认证状态初始化完成')
}


// 打包导出
export function useAuth() {

  // 登录
  async function signIn(username: string) {
    await new Promise(resolve => setTimeout(resolve, 500))  // 模拟网络请求延迟
    // 模拟登录成功后获取的用户信息和过期时间 (实际应用中应调用后端 API 获取)
    session.value = {
      username,
      expires_at: '2026-12-31T23:59:59.999Z',
    }
    // 将认证状态保存到 localStorage (实际应用中, 客户端 API 通常会自动执行此操作)
    localStorage.setItem('session', JSON.stringify(session.value))
    return true  // 登录成功
  }

  // 登出
  async function signOut() {
    await new Promise(resolve => setTimeout(resolve, 500))  // 模拟网络请求延迟
    session.value = null                // 从内存中清除认证状态
    localStorage.removeItem('session')  // 从 localStorage 中清除认证状态
  }

  // 导出
  return {
    // 状态 (使用 computed 包装成只读Ref)
    isAuthed: computed(() => !!session.value?.username),        // 是否已认证 (根据是否存在用户名判断)
    userName: computed(() => session.value?.username ?? null),  // 当前用户名
    // 操作
    initAuth,
    signIn,
    signOut,
  }
}


// 使用方法


// 在路由守卫中 (@/routers/index.ts)
// import { useAuth } from '@/composables/useAuth'
// ...
// router.beforeEach(async (to, _from) => {
//   const { initAuth, isAuthed } = useAuth()
//   await initAuth()  // 初始化认证状态
//   if (to.meta.requiresAuth && !isAuthed.value) {
//     return { name: 'login' }  // 重定向到登录页
//   }
// })


// 在组件中 (@/components/Login.vue)
// import { useAuth } from '@/composables/useAuth'
// ...
// const { signIn } = useAuth()
// ...
// await signIn('exampleUser')  // 模拟登录