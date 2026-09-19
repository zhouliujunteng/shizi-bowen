<template>
  <div class="login-page">
    <div class="brand">
      <h1>博闻幼儿园 · 教学服务平台</h1>
      <p>识字 · 脑力训练 · 英语</p>
    </div>

    <el-card class="login-card" shadow="never">
      <el-form :model="form" @keyup.enter="handleLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="请输入手机号（登录账号）" size="large" :disabled="loading" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" show-password placeholder="请输入密码（至少8位）" size="large" :disabled="loading" />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
      <p class="tip">账号由管理员统一开通，如需帮助请联系园所管理员</p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authenticateWithUsername, fetchMyProfile } from '../api/auth'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ username: '', password: '' })
const loading = ref(false)

/** 登录后按角色分流 */
async function redirectByProfile() {
  auth.profile = await fetchMyProfile()
  const { status, role } = auth.profile

  if (status === 'no_profile' || status === 'disabled' || status === 'kg_disabled') {
    return router.push({ name: 'pending' })
  }
  if (role === '平台管理员') {
    return router.push(route.query.redirect?.startsWith('/platform') ? route.query.redirect : '/platform')
  }
  if (role === '素材员' || role === '审核员') {
    return router.push(route.query.redirect?.startsWith('/platform/literacy') ? route.query.redirect : '/platform/literacy')
  }
  if (role === '园所管理员' || role === '老师') {
    return router.push(route.query.redirect?.startsWith('/kindergarten') ? route.query.redirect : '/kindergarten')
  }
  return router.push({ name: 'pending' })
}

async function handleLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入手机号和密码')
    return
  }
  loading.value = true
  try {
    await authenticateWithUsername(form.username.trim(), form.password, false)
    await redirectByProfile()
  } catch (e) {
    const msg = e?.extensions?.classification === 'ACCOUNT_DOES_NOT_EXIST' ? '账号不存在，请联系管理员开通' : e.message || '登录失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bw-bg);
}
.brand { text-align: center; margin-bottom: 32px; }
.brand h1 { font-size: 28px; font-weight: 700; margin: 0 0 8px; }
.brand p { color: var(--bw-muted); margin: 0; letter-spacing: 2px; }
.login-card {
  width: 400px;
  max-width: 100%;
  border: 1px solid var(--bw-border);
  border-radius: 16px;
}
.login-btn { width: 100%; height: 48px; margin: 4px 0; }
.tip { font-size: 13px; color: var(--bw-muted); text-align: center; margin: 12px 0 0; line-height: 1.6; }
@media (max-width: 480px) {
  .brand h1 { font-size: 22px; }
}
</style>
