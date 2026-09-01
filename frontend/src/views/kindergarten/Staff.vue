<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>员工管理</b>
        <el-button type="primary" @click="openDialog()">添加员工</el-button>
      </div>
    </template>

    <el-alert type="info" :closable="false" class="tip"
      title="添加员工时设置初始密码即完成开户，员工用「手机号 + 初始密码」即可登录，登录后可自行修改密码。" />

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="phone" label="手机号" width="140" />
      <el-table-column prop="role" label="角色" width="110" />
      <el-table-column label="登录状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.account_id ? 'success' : 'info'" size="small">{{ row.account_id ? '已注册' : '未注册' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '在职' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link :type="row.status === '在职' ? 'danger' : 'success'" size="small" @click="toggleStatus(row)">
            {{ row.status === '在职' ? '停用' : '恢复' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑员工' : '添加员工'" width="440px">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="dialog.form.name" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="dialog.form.phone" maxlength="11" :disabled="!!dialog.form.id" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="dialog.form.role" style="width: 100%">
            <el-option label="老师" value="老师" />
            <el-option label="园所管理员" value="园所管理员" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="!dialog.form.id" label="初始密码" required>
          <el-input v-model="dialog.form.password" show-password placeholder="至少8位，员工首次登录使用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchStaff, saveStaff, createStaffWithAccount } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({
  visible: false,
  form: { id: null, name: '', phone: '', role: '老师', password: '' },
})

async function load() {
  loading.value = true
  try {
    list.value = await fetchStaff(kgId.value)
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.form = row ? { id: row.id, name: row.name, phone: row.phone, role: row.role, password: '' } : { id: null, name: '', phone: '', role: '老师', password: '' }
  dialog.visible = true
}

async function handleSave() {
  const f = dialog.form
  if (!f.name?.trim() || !f.phone?.trim()) {
    ElMessage.warning('请填写姓名和手机号')
    return
  }
  if (!/^1\d{10}$/.test(f.phone)) {
    ElMessage.warning('手机号格式不正确')
    return
  }
  if (!f.id && f.password.length < 8) {
    ElMessage.warning('初始密码至少 8 位')
    return
  }
  saving.value = true
  try {
    if (f.id) {
      await saveStaff({ name: f.name.trim(), role: f.role }, f.id)
      ElMessage.success('已保存')
    } else {
      await createStaffWithAccount({
        name: f.name.trim(),
        phone: f.phone.trim(),
        role: f.role,
        kindergarten_id: kgId.value,
        password: f.password,
      })
      ElMessage.success('开户成功，员工可用「手机号 + 初始密码」登录')
    }
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row) {
  const next = row.status === '在职' ? '停用' : '在职'
  await ElMessageBox.confirm(`确认${next}「${row.name}」？`, '确认操作', { type: 'warning' })
  try {
    await saveStaff({ status: next }, row.id)
    ElMessage.success(`已${next}`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.tip { margin-bottom: 16px; }
</style>
