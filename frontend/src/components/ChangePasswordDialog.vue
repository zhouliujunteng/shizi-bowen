<template>
  <el-dialog v-model="visible" title="修改密码" width="440px" :close-on-click-modal="false" destroy-on-close>
    <el-alert type="info" :closable="false" class="tip">
      验证码将发送到账号绑定的手机号。仅已完成注册（手机号即登录账号）的账户可修改密码。
    </el-alert>
    <el-form label-width="90px" class="form">
      <el-form-item label="手机号">
        <el-input :model-value="phone" disabled />
      </el-form-item>
      <el-form-item label="验证码" required>
        <div class="code-row">
          <el-input v-model="form.code" placeholder="6位短信验证码" maxlength="6" />
          <el-button :disabled="countdown > 0 || sending" :loading="sending" @click="sendCode">
            {{ countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item label="新密码" required>
        <el-input v-model="form.newPassword" type="password" show-password placeholder="至少8位" />
      </el-form-item>
      <el-form-item label="确认密码" required>
        <el-input v-model="form.confirm" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { sendResetPasswordCode, resetPasswordByCode } from '../api/auth'

const props = defineProps({
  phone: { type: String, required: true },
})

const visible = ref(false)
const sending = ref(false)
const submitting = ref(false)
const countdown = ref(0)
const form = reactive({ code: '', newPassword: '', confirm: '' })
let timer = null

function open() {
  form.code = ''
  form.newPassword = ''
  form.confirm = ''
  visible.value = true
}
defineExpose({ open })

async function sendCode() {
  sending.value = true
  try {
    const ok = await sendResetPasswordCode(props.phone)
    if (!ok) throw new Error('发送失败')
    ElMessage.success('验证码已发送，请注意查收短信')
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (e) {
    ElMessage.error(e.message || '验证码发送失败，请确认手机号已注册绑定')
  } finally {
    sending.value = false
  }
}

async function handleSubmit() {
  if (!form.code.trim()) return ElMessage.warning('请输入短信验证码')
  if (form.newPassword.length < 8) return ElMessage.warning('新密码至少 8 位')
  if (form.newPassword !== form.confirm) return ElMessage.warning('两次输入的密码不一致')
  submitting.value = true
  try {
    const account = await resetPasswordByCode(props.phone, form.code.trim(), form.newPassword)
    if (!account) throw new Error('重置失败')
    ElMessage.success('密码已修改，下次登录请使用新密码')
    visible.value = false
  } catch (e) {
    ElMessage.error(e.message || '修改失败：验证码错误或已过期')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.tip { margin-bottom: 16px; }
.code-row { display: flex; gap: 8px; width: 100%; }
.code-row .el-input { flex: 1; }
</style>
