import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  // 全局认证状态
  const _session = ref<Session | null>(null)
  // 辅助变量
  const _initialized = ref(false)
  const _loading = ref(true)

  // 初始化认证状态
  async function initAuth() {
    if (_initialized.value) return

    // 获取当前会话
    const { data: { session } } = await supabase.auth.getSession()
    _session.value = session
    _loading.value = false

    // 监听认证状态变化
    supabase.auth.onAuthStateChange((event, session) => {
      _session.value = session
      _loading.value = false
      console.log('Auth State Change:', event)
    })

    _initialized.value = true
  }

  // 注册新用户
  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/PlayGround/`, // 注册成功后重定向的 URL
      },
    })
    if (error) throw error
    return data
  }

  // 密码登录
  async function signInWithPassword(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // 退出登录
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // 账户删除
  async function deleteAccount() {
    const { error } = await supabase.rpc('delete_account')
    if (error) throw error
  }

  // 导出状态、计算属性和方法
  return {
    // state
    _session,
    _initialized,
    _loading,
    // getters
    isAuthenticated: computed(() => !!_session.value?.user),
    user: computed<User | null>(() => _session.value?.user ?? null),
    // actions
    initAuth,
    signUp,
    signInWithPassword,
    signOut,
    deleteAccount,
  }
})
