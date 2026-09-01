<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>班级管理</b>
        <el-button type="primary" @click="openDialog()">新建班级</el-button>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="class_name" label="班级名称" min-width="140" />
      <el-table-column prop="sort_order" label="排序号" width="90" align="center" />
      <el-table-column label="孩子数" width="90" align="center">
        <template #default="{ row }">{{ row.children_aggregate.aggregate.count }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑班级' : '新建班级'" width="400px">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="班级名称" required>
          <el-input v-model="dialog.form.class_name" placeholder="如：小一班" />
        </el-form-item>
        <el-form-item label="排序号">
          <el-input-number v-model="dialog.form.sort_order" :min="0" :max="999" />
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
import { fetchClasses, saveClass, deleteClass } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({
  visible: false,
  form: {},
})

async function load() {
  loading.value = true
  try {
    list.value = await fetchClasses(kgId.value)
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.form = row ? { ...row } : { id: null, class_name: '', sort_order: list.value.length + 1 }
  dialog.visible = true
}

async function handleSave() {
  if (!dialog.form.class_name?.trim()) {
    ElMessage.warning('请输入班级名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      class_name: dialog.form.class_name.trim(),
      sort_order: dialog.form.sort_order ?? 0,
      ...(dialog.form.id ? {} : { status: '启用', kindergarten_id: kgId.value }),
    }
    await saveClass(payload, dialog.form.id)
    ElMessage.success('已保存')
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  const count = row.children_aggregate.aggregate.count
  await ElMessageBox.confirm(
    count > 0 ? `「${row.class_name}」下还有 ${count} 个孩子，删除后孩子将变为未分班。确认删除？` : `确认删除「${row.class_name}」？`,
    '确认删除',
    { type: 'warning' },
  )
  try {
    await deleteClass(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
