<template>
  <div class="home">
    <header class="home-header">
      <div>
        <h1>平台管理端</h1>
        <p>{{ auth.profile?.name }} · {{ auth.profile?.phone }}</p>
      </div>
      <el-button @click="handleLogout">退出登录</el-button>
    </header>

    <main class="home-body">
      <el-empty description="园所管理 / 全量数据看板 · 开发中" />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.home { min-height: 100vh; display: flex; flex-direction: column; }
.home-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 32px; background: #fff; border-bottom: 1px solid var(--bw-border);
}
.home-header h1 { font-size: 20px; margin: 0 0 4px; }
.home-header p { color: var(--bw-muted); margin: 0; font-size: 13px; }
.home-body { flex: 1; display: flex; align-items: center; justify-content: center; }
</style>
