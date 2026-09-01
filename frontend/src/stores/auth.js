import { defineStore } from 'pinia'
import { fetchMyProfile, logout as apiLogout, getToken } from '../api/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    profile: null, // { status, userId, name, role, phone, kindergartenId, kindergartenName }
    loading: false,
  }),
  getters: {
    isLoggedIn: () => !!getToken(),
    role: (s) => s.profile?.role || null,
    isPlatformAdmin: (s) => s.profile?.role === '平台管理员',
    isKindergartenAdmin: (s) => s.profile?.role === '园所管理员',
    isTeacher: (s) => s.profile?.role === '老师',
    profileReady: (s) => !!s.profile,
  },
  actions: {
    /** 拉取当前用户资料（登录后调用） */
    async loadProfile() {
      this.loading = true
      try {
        this.profile = await fetchMyProfile()
        return this.profile
      } finally {
        this.loading = false
      }
    },
    logout() {
      apiLogout()
      this.profile = null
    },
  },
})
