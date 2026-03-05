// @/composables/useAuth.ts
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'   // supabase 客户端
import { type Session, type User } from '@supabase/supabase-js'


// supabase 会话信息
const _session = ref<Session | null>(null)

// 辅助变量
const _initialized = ref(false)   // 初始化完成标志, 防止重复初始化
const _loading = ref(true)        // 认证进行中标志, 防止状态获取延迟导致两次跳转(闪烁)

// 初始化
async function initAuth() {
  // 避免重复初始化
  if (_initialized.value) return

  // 手动获取一次认证数据
  const { data } = await supabase.auth.getSession()
  _session.value = data.session

  // 跟踪后续认证状态变化 ( 各种 supabase.auth.xxx 动作都会触发此事件 )
  supabase.auth.onAuthStateChange((event, session) => {
    _session.value = session
    _loading.value = false
    console.log('Auth State Change:', event)
  })

  // 初始化完成
  _initialized.value = true
}

// 打包导出
export function useAuth() {
  // 注册 (邮箱+密码)
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  // 登录 (邮箱+密码)
  async function signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // 登出
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // 导出需要对外暴露的状态和函数
  return {
    // 状态 (使用 computed 包装成只读Ref)
    isAuthed: computed(() => !!_session.value?.user),          // 是否已认证 (根据是否存在用户信息判断)
    user: computed<User | null>(() => _session.value?.user ?? null),  // 用户信息
    loading: computed(() => _loading.value),                          // 认证进行中
    // 函数
    initAuth,
    signUp,
    signOut,
    signInWithPassword,
    // 可继续扩展 signInWithOAuth 等
  }
}


// 用法示例

// 路由守卫 // @/router/index.ts
//
// import { useAuth } from '@/composables/useAuth'
// ...
// router.beforeEach(async (to, from) => {
// // 获取认证状态
// const { initAuth, isAuthed } = useAuth();
// await initAuth();  // 初始化认证状态
// // 未登录时: 访问需要认证的页面 -> 重定向到登录页
// if (to.meta.requiresAuth && !isAuthed.value) {
//   return { name: 'login' };
// }
// // 已登录时: 访问登录页 -> 重定向到应用页
// if (to.name === 'login' && isAuthed.value) {
//   return { name: 'app' };
// }

// 根组件 // @/App.vue
// import { useAuth } from '@/composables/useAuth'
// const auth = useAuth()
// ...
// const handleLogout = async () => {
//   await auth.signOut()
//   ...
// }

// 登录组件 // @/components/Login.vue
//
// import { useAuth } from '@/composables/useAuth'
// const { signUp } = useAuth()
// ...
// async function handleSignUp() {
//   const { user, session } = await auth.signUp(email, password)
//   if ( user && session ) {
//     // 注册成功, 可直接登录状态管理
//   } else {
//     // 可能需要邮箱验证, 提示用户检查邮箱
//   }
// }