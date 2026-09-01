<template>
  <div class="pending-page">
    <el-card class="pending-card" shadow="never">
      <h1>账号待开通</h1>
      <p class="desc">
        {{ statusText }}
      </p>
      <p class="desc muted">
        如有疑问，请联系您所在园所的管理员，或联系平台运营方。
      </p>
      <el-button type="primary" @click="handleLogout">返回登录</el-button>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const statusText = computed(() => {
  const s = auth.profile?.status
  if (s === 'disabled') return '您的账号已被停用，请联系园所管理员。'
  if (s === 'kg_disabled') return '您所在的园所已被平台停用，请联系平台运营方。'
  return '您的手机号尚未被园所管理员录入系统。注册已完成，请联系管理员录入您的手机号后重新登录。'
})

function handleLogout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.pending-page {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 24px; background: var(--bw-bg);
}
.pending-card {
  width: 420px; max-width: 100%;
  text-align: center; border: 1px solid var(--bw-border); border-radius: 16px;
}
.pending-card h1 { font-size: 22px; margin: 8px 0 16px; }
.desc { line-height: 1.8; margin: 0 0 8px; }
.muted { color: var(--bw-muted); font-size: 13px; margin-bottom: 24px; }
</style>
