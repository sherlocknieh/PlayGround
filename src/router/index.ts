import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

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
  // 获取认证状态
  const { initAuth, isAuthed } = useAuth();
  await initAuth();  // 初始化认证状态
  // 未登录时: 访问需要认证的页面 -> 重定向到登录页
  if (to.meta.requiresAuth && !isAuthed.value) {
    return { name: 'login' };
  }
  // 已登录时: 访问登录页 -> 重定向到应用页
  if (to.name === 'login' && isAuthed.value) {
    return { name: 'app' };
  }
});

export default router;