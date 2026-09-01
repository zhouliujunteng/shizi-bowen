<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>孩子档案</b>
        <div class="actions">
          <el-input v-model="keyword" placeholder="搜索姓名" clearable style="width: 200px" @input="debouncedLoad" />
          <el-button type="primary" @click="openDialog()">录入孩子</el-button>
        </div>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="gender" label="性别" width="60" align="center" />
      <el-table-column label="出生日期" width="110">
        <template #default="{ row }">{{ row.birth_date || '-' }}</template>
      </el-table-column>
      <el-table-column label="班级" width="100">
        <template #default="{ row }">{{ row.class?.class_name || '未分班' }}</template>
      </el-table-column>
      <el-table-column prop="parent_name" label="家长" width="80" />
      <el-table-column prop="parent_phone" label="家长电话" width="130" />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '在读' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link :type="row.status === '在读' ? 'danger' : 'success'" size="small" @click="toggleStatus(row)">
            {{ row.status === '在读' ? '离园' : '恢复在读' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑孩子' : '录入孩子'" width="480px">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="dialog.form.name" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="dialog.form.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="出生日期">
          <el-date-picker v-model="dialog.form.birth_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="班级">
          <el-select v-model="dialog.form.class_id" clearable placeholder="选择班级" style="width: 100%">
            <el-option v-for="c in classes" :key="c.id" :label="c.class_name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="家长姓名">
          <el-input v-model="dialog.form.parent_name" />
        </el-form-item>
        <el-form-item label="家长电话">
          <el-input v-model="dialog.form.parent_phone" maxlength="11" />
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
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchChildren, saveChild, fetchClasses } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const classes = ref([])
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({
  visible: false,
  form: {},
})

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchChildren(kgId.value, keyword.value.trim())
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.form = row
    ? { ...row, class_id: row.class_id }
    : { id: null, name: '', gender: '男', birth_date: null, class_id: null, parent_name: '', parent_phone: '', remark: '' }
  dialog.visible = true
}

async function handleSave() {
  if (!dialog.form.name?.trim()) {
    ElMessage.warning('请输入孩子姓名')
    return
  }
  saving.value = true
  try {
    const f = dialog.form
    const payload = {
      name: f.name.trim(),
      gender: f.gender || null,
      birth_date: f.birth_date || null,
      class_id: f.class_id || null,
      parent_name: f.parent_name || null,
      parent_phone: f.parent_phone || null,
      remark: f.remark || null,
      ...(f.id ? {} : { status: '在读', kindergarten_id: kgId.value }),
    }
    await saveChild(payload, f.id)
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
  const next = row.status === '在读' ? '离园' : '在读'
  await ElMessageBox.confirm(`确认将「${row.name}」标记为${next}？`, '确认操作', { type: 'warning' })
  try {
    await saveChild({ status: next }, row.id)
    ElMessage.success(`已${next}`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(async () => {
  await Promise.all([load(), fetchClasses(kgId.value).then((d) => (classes.value = d))])
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.actions { display: flex; gap: 12px; }
</style>
