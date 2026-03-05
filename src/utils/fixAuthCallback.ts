/**
 * @module fixAuthCallback
 * 
 * [问题来由] 
 * 
 * Supabase 的认证流程中，用户注册后会通过回调 URL 将 access_token 和 refresh_token 传回应用。
 * 正常情况下回调链接类似: /#access_token=... , 能被 Supabase SDK 自动处理
 * 但是本应用使用 Vue Router 的 Hash 路由模式，回调 URL 会自动变成 /#/access_token...
 * 导致 SDK 无法正确解析，同时 Vue Router 也不能匹配到正确的路由，最终显示 404 页面。
 *
 * [模块功能]
 * 
 * 1. 拦截回调 URL，主动提取 access_token 和各种参数, 写入本地 session。
 * 2. 重新进行路由跳转。
 *
 * [使用方法]
 * 
 * // main.ts
 * import { fixAuthCallback } from '@/utils/fixAuthCallback'
 * await fixAuthCallback() // 处理认证回调URL
 */


// 回调 URL 示例（magic link/email confirmation）：
// https://www.example.com/#/access_token=...&expires_at=1772025904&expires_in=3600&refresh_token=...&token_type=bearer&type=signup
// https://www.example.com/#/error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=

import { supabase } from '@/lib/supabase'

// 直接解析
export async function fixAuthCallback() {
  const hash = window.location.hash
  // 提取 '#/access_token=...' 部分

  if (hash.includes('access_token')) {
    // 移除 '#/' 前缀
    const cleaned = hash.startsWith('#/') ? hash.slice(2) : hash.slice(1)
    // 使用 URLSearchParams 解析参数
    const params = new URLSearchParams(cleaned)
    // 提取 access_token 和 refresh_token
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    // 调用 Supabase SDK 写入会话
    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({access_token,refresh_token})
      if (error) {
        console.error('Error setting Supabase session:', error)
      } else {
        console.log('Success setting Supabase session:', data)
      }
    }
  }
  // 清空 URL 中的哈希参数，避免重复处理
  window.location.hash = ''
}