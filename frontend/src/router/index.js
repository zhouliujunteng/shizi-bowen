import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from '../api/graphql'
import { useAuthStore } from '../stores/auth'

const routes = [
  { path: '/', name: 'login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/platform',
    component: () => import('../views/PlatformLayout.vue'),
    meta: { roles: ['平台管理员', '素材员', '审核员'] },
    children: [
      { path: '', name: 'platform-dashboard', component: () => import('../views/platform/Dashboard.vue'), meta: { roles: ['平台管理员'] } },
      { path: 'kindergartens', name: 'platform-kgs', component: () => import('../views/platform/Kindergartens.vue'), meta: { roles: ['平台管理员'] } },
      { path: 'packages', name: 'platform-packages', component: () => import('../views/platform/Packages.vue'), meta: { roles: ['平台管理员'] } },
      { path: 'literacy', name: 'platform-literacy', component: () => import('../views/platform/Literacy.vue') },
      { path: 'courses', name: 'platform-courses', component: () => import('../views/platform/Courses.vue'), meta: { roles: ['平台管理员'] } },
      { path: 'accounts', name: 'platform-accounts', component: () => import('../views/platform/Accounts.vue'), meta: { roles: ['平台管理员'] } },
    ],
  },
  {
    path: '/kindergarten',
    component: () => import('../views/KindergartenLayout.vue'),
    meta: { roles: ['园所管理员', '老师'] },
    children: [
      { path: '', name: 'kg-home', component: () => import('../views/kindergarten/Home.vue') },
      { path: 'staff', name: 'kg-staff', component: () => import('../views/kindergarten/Staff.vue'), meta: { roles: ['园所管理员'] } },
      { path: 'children', name: 'kg-children', component: () => import('../views/kindergarten/Children.vue'), meta: { roles: ['园所管理员'] } },
      { path: 'classes', name: 'kg-classes', component: () => import('../views/kindergarten/Classes.vue'), meta: { roles: ['园所管理员'] } },
      { path: 'groups', name: 'kg-groups', component: () => import('../views/kindergarten/Groups.vue'), meta: { roles: ['园所管理员'] } },
      { path: 'schedules', name: 'kg-schedules', component: () => import('../views/kindergarten/Schedules.vue') },
      { path: 'records', name: 'kg-records', component: () => import('../views/kindergarten/Records.vue') },
      { path: 'assessments', name: 'kg-assessments', component: () => import('../views/kindergarten/Assessments.vue') },
    ],
  },
  { path: '/pending', name: 'pending', component: () => import('../views/Pending.vue'), meta: { auth: true } },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  // 命中叶子路由的角色限制（子路由角色与父路由取并集判断）
  const matchedRoles = to.matched.flatMap((r) => r.meta?.roles || [])
  const leaf = to.matched[to.matched.length - 1]
  const merged = { ...to.meta, roles: matchedRoles.length ? matchedRoles : leaf.meta?.roles }

  if (to.meta.public) return true

  if (!getToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const auth = useAuthStore()
  if (!auth.profileReady) {
    try {
      await auth.loadProfile()
    } catch (e) {
      auth.logout()
      return { name: 'login' }
    }
  }

  const status = auth.profile?.status
  if (['no_profile', 'disabled', 'kg_disabled'].includes(status)) {
    return to.name === 'pending' ? true : { name: 'pending' }
  }

  if (merged.roles && !merged.roles.includes(auth.role)) {
    if (auth.isPlatformAdmin) return { name: 'platform-dashboard' }
    if (['素材员', '审核员'].includes(auth.role)) return { name: 'platform-literacy' }
    return { name: 'kg-home' }
  }
  return true
})
