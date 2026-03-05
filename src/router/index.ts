import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// 路由定义
const router = createRouter({
  history: createWebHashHistory(),  // 使用哈希模式:  /#/login
  routes: [
    {
      path: '/',
      alias: '/home', // 增加别名，支持 /home 跳转
      name: 'home',
      component: () => import('@/pages/Home.vue'),
      meta: { title: '主页' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/Login.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/app',
      name: 'app',
      component: () => import('@/pages/Main.vue'),
      meta: { title: '应用', requiresAuth: true }  // 需要认证才能访问,
    },
    {
      path: '/:pathMatch(.*)*',
      name: '404',
      component: () => import('@/pages/404.vue'),
      meta: { title: '404' }
    }
  ]
});

// 路由跳转后处理
router.afterEach((to) => {
  // 修改页面标题
  document.title = String(to.meta.title || to.name);
});

// 路由重定向配置
router.beforeEach(async (to, _from) => {

  const auth = useAuthStore() // 导入认证管理器
  await auth.initAuth()       // 初始化认证状态

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'app' }
  }
})

export default router;