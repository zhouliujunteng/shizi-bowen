<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <h2>{{ auth.profile?.kindergartenName || '园所端' }}</h2>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item index="/kindergarten">
          <el-icon><Monitor /></el-icon><span>工作台</span>
        </el-menu-item>
        <template v-if="auth.isKindergartenAdmin">
          <el-menu-item index="/kindergarten/staff">
            <el-icon><User /></el-icon><span>员工管理</span>
          </el-menu-item>
          <el-menu-item index="/kindergarten/children">
            <el-icon><Star /></el-icon><span>孩子档案</span>
          </el-menu-item>
          <el-menu-item index="/kindergarten/classes">
            <el-icon><Grid /></el-icon><span>班级管理</span>
          </el-menu-item>
          <el-menu-item index="/kindergarten/groups">
            <el-icon><Share /></el-icon><span>课程分组</span>
          </el-menu-item>
        </template>
        <el-menu-item index="/kindergarten/schedules">
          <el-icon><Calendar /></el-icon><span>{{ auth.isTeacher ? '我的课表' : '排课管理' }}</span>
        </el-menu-item>
        <el-menu-item index="/kindergarten/records">
          <el-icon><EditPen /></el-icon><span>课后记录</span>
        </el-menu-item>
        <el-menu-item index="/kindergarten/assessments">
          <el-icon><DataAnalysis /></el-icon><span>月度考核</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div></div>
        <div class="user-info">
          <span>{{ auth.profile?.name }}（{{ auth.profile?.role }}）</span>
          <el-button link type="primary" @click="pwdRef?.open()">修改密码</el-button>
          <el-button link type="danger" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
    <ChangePasswordDialog ref="pwdRef" :phone="auth.profile?.phone || ''" />
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import ChangePasswordDialog from '../components/ChangePasswordDialog.vue'
import { Monitor, User, Star, Grid, Share, Calendar, EditPen, DataAnalysis } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const pwdRef = ref(null)

const activeMenu = computed(() => route.path)

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #fff; border-right: 1px solid var(--bw-border); display: flex; flex-direction: column; }
.logo { padding: 20px 16px; border-bottom: 1px solid var(--bw-border); }
.logo h2 { font-size: 16px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu { border-right: none; flex: 1; padding: 8px; }
.header {
  background: #fff; border-bottom: 1px solid var(--bw-border);
  display: flex; align-items: center; justify-content: space-between; height: 56px;
}
.user-info { display: flex; align-items: center; gap: 12px; color: var(--bw-muted); font-size: 14px; }
.main { background: var(--bw-bg); padding: 20px; overflow-y: auto; }
</style>
