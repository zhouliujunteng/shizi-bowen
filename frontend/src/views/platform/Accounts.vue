<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>素材账号管理</b>
        <el-button type="primary" @click="openDialog">添加账号</el-button>
      </div>
    </template>

    <el-alert type="info" :closable="false" class="tip">
      素材员：登录后可编辑字库课件并提交审核；审核员：登录后审核课件（通过/退回）。两类账号登录后直达「字库课件」页。
    </el-alert>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号（登录账号）" min-width="150" />
      <el-table-column label="身份" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.role === '审核员' ? 'warning' : 'primary'" size="small">{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '在职' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账号绑定" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.account_id ? 'success' : 'danger'" size="small">{{ row.account_id ? '已开通' : '未开通' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button
            link
            :type="row.status === '在职' ? 'danger' : 'success'"
            size="small"
            @click="toggleStatus(row)"
          >{{ row.status === '在职' ? '停用' : '启用' }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" title="添加素材账号" width="440px">
      <el-form :model="dialog.form" label-width="90px">
        <el-form-item label="姓名" required>
          <el-input v-model="dialog.form.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="dialog.form.phone" placeholder="11 位手机号，即登录账号" maxlength="11" />
        </el-form-item>
        <el-form-item label="身份" required>
          <el-radio-group v-model="dialog.form.role">
            <el-radio-button value="素材员">素材员</el-radio-button>
            <el-radio-button value="审核员">审核员</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="默认密码" required>
          <div class="pwd-row">
            <el-input v-model="dialog.form.password" placeholder="至少 8 位，建议字母+数字" />
            <el-button @click="genPassword">随机生成</el-button>
          </div>
          <div class="muted pwd-tip">首次登录后可在右上角「修改密码」自行更换</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">创建账号</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPlatformStaff, createStaffWithAccount, setPlatformStaffStatus } from '../../api/data'

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const dialog = reactive({
  visible: false,
  form: { name: '', phone: '', role: '素材员', password: '' },
})

async function load() {
  loading.value = true
  try {
    list.value = await fetchPlatformStaff()
  } finally {
    loading.value = false
  }
}

function openDialog() {
  dialog.form = { name: '', phone: '', role: '素材员', password: '' }
  dialog.visible = true
}

/** 系统生成随机默认密码（3 字母+4 数字+3 字母，好读好记） */
function genPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const pick = (pool, n) => Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]).join('')
  dialog.form.password = pick(letters, 3) + pick(digits, 4) + pick(letters, 3)
}

async function handleSave() {
  const f = dialog.form
  if (!f.name.trim() || !/^1\d{10}$/.test(f.phone) || f.password.length < 8) {
    ElMessage.warning('请完整填写：姓名、11 位手机号、至少 8 位密码')
    return
  }
  saving.value = true
  try {
    await createStaffWithAccount({ name: f.name.trim(), phone: f.phone, role: f.role, kindergarten_id: null, password: f.password })
    ElMessage.success(`${f.role}账号已开通，可凭手机号+密码登录`)
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row) {
  const next = row.status === '在职' ? '停用' : '在职'
  try {
    await setPlatformStaffStatus(row.id, next)
    ElMessage.success(`已${next === '在职' ? '启用' : '停用'}`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.tip { margin-bottom: 14px; }
.pwd-row { display: flex; gap: 8px; width: 100%; }
.pwd-tip { margin-top: 4px; }
.muted { color: var(--bw-muted); font-size: 12px; }
</style>
