<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo"><h2>{{ auth.isPlatformAdmin ? '平台管理端' : '素材工作台' }}</h2></div>
      <el-menu :default-active="activeMenu" router class="menu">
        <template v-if="auth.isPlatformAdmin">
        <el-menu-item index="/platform">
          <el-icon><DataLine /></el-icon><span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/platform/kindergartens">
          <el-icon><OfficeBuilding /></el-icon><span>园所管理</span>
        </el-menu-item>
        <el-menu-item index="/platform/packages">
          <el-icon><Grid /></el-icon><span>课程组合</span>
        </el-menu-item>
        <el-menu-item index="/platform/courses">
          <el-icon><Collection /></el-icon><span>课程内容</span>
        </el-menu-item>
        </template>
        <el-menu-item index="/platform/literacy">
          <el-icon><Reading /></el-icon><span>字库课件</span>
        </el-menu-item>
        <el-menu-item v-if="auth.profile?.role === '素材员'" index="/platform/my-tasks">
          <el-icon><Tickets /></el-icon><span>我的任务</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isPlatformAdmin" index="/platform/accounts">
          <el-icon><User /></el-icon><span>素材账号</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div></div>
        <div class="user-info">
          <span>{{ auth.profile?.name }}</span>
          <el-button link type="primary" @click="pwdRef?.open()">修改密码</el-button>
          <el-button link type="danger" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
    <ChangePasswordDialog ref="pwdRef" :phone="auth.profile?.phone || ''" />
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import ChangePasswordDialog from '../components/ChangePasswordDialog.vue'
import { DataLine, OfficeBuilding, Grid, Reading, Collection, User, Tickets } from '@element-plus/icons-vue'

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
.aside { background: #fff; border-right: 1px solid var(--bw-border); }
.logo { padding: 20px 16px; border-bottom: 1px solid var(--bw-border); }
.logo h2 { font-size: 16px; margin: 0; }
.menu { border-right: none; padding: 8px; }
.header { background: #fff; border-bottom: 1px solid var(--bw-border); display: flex; align-items: center; justify-content: space-between; height: 56px; }
.user-info { display: flex; align-items: center; gap: 12px; color: var(--bw-muted); font-size: 14px; }
.main { background: var(--bw-bg); padding: 20px; overflow-y: auto; }
</style>
