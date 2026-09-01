<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>园所管理</b>
        <el-button type="primary" @click="openDialog()">开通新园所</el-button>
      </div>
    </template>

    <el-table :data="kgs" v-loading="loading" stripe>
      <el-table-column prop="name" label="园所名称" min-width="140" />
      <el-table-column prop="contact_name" label="联系人" width="100" />
      <el-table-column prop="contact_phone" label="联系电话" width="130" />
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '启用' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="230" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="primary" size="small" @click="openAdminDialog(row)">园长账号</el-button>
          <el-button link :type="row.status === '启用' ? 'danger' : 'success'" size="small" @click="toggleStatus(row)">
            {{ row.status === '启用' ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑园所' : '开通新园所'" width="480px">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="园所名称" required>
          <el-input v-model="dialog.form.name" placeholder="如：博闻幼儿园" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="dialog.form.contact_name" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="dialog.form.contact_phone" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="dialog.form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 开通园长账号 ============ -->
    <el-dialog v-model="adminDialog.visible" :title="`开通园长账号 · ${adminDialog.kgName}`" width="440px">
      <el-form :model="adminDialog.form" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="adminDialog.form.name" placeholder="园长姓名" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="adminDialog.form.phone" maxlength="11" placeholder="即登录账号" />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input v-model="adminDialog.form.password" show-password placeholder="至少8位，园长首次登录使用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adminDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreateAdmin">开通</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchKindergartens, saveKindergarten, createStaffWithAccount } from '../../api/data'

const kgs = ref([])
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({
  visible: false,
  form: { id: null, name: '', contact_name: '', contact_phone: '', remark: '' },
})

const adminDialog = reactive({
  visible: false,
  kgId: null,
  kgName: '',
  form: { name: '', phone: '', password: '' },
})

function openAdminDialog(row) {
  adminDialog.kgId = row.id
  adminDialog.kgName = row.name
  adminDialog.form = { name: '', phone: '', password: '' }
  adminDialog.visible = true
}

async function handleCreateAdmin() {
  const f = adminDialog.form
  if (!f.name?.trim()) return ElMessage.warning('请填写园长姓名')
  if (!/^1\d{10}$/.test(f.phone)) return ElMessage.warning('手机号格式不正确')
  if (f.password.length < 8) return ElMessage.warning('初始密码至少 8 位')
  saving.value = true
  try {
    await createStaffWithAccount({
      name: f.name.trim(),
      phone: f.phone.trim(),
      role: '园所管理员',
      kindergarten_id: adminDialog.kgId,
      password: f.password,
    })
    ElMessage.success('园长账号已开通，可用「手机号 + 初始密码」登录')
    adminDialog.visible = false
  } catch (e) {
    ElMessage.error(e.message || '开通失败')
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    kgs.value = await fetchKindergartens()
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.form = row
    ? { ...row }
    : { id: null, name: '', contact_name: '', contact_phone: '', remark: '' }
  dialog.visible = true
}

async function handleSave() {
  if (!dialog.form.name?.trim()) {
    ElMessage.warning('请输入园所名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: dialog.form.name.trim(),
      contact_name: dialog.form.contact_name || null,
      contact_phone: dialog.form.contact_phone || null,
      remark: dialog.form.remark || null,
      ...(dialog.form.id ? {} : { status: '启用' }),
    }
    await saveKindergarten(payload, dialog.form.id)
    ElMessage.success('已保存')
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row) {
  const next = row.status === '启用' ? '停用' : '启用'
  await ElMessageBox.confirm(`确认${next}「${row.name}」？${next === '停用' ? '停用后该园所所有账号将无法登录。' : ''}`, '确认操作', { type: 'warning' })
  try {
    await saveKindergarten({ status: next }, row.id)
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
</style>
