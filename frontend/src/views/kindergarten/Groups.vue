<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>课程分组</b>
        <el-button type="primary" @click="openDialog()">新建分组</el-button>
      </div>
    </template>

    <el-alert type="info" :closable="false" class="tip"
      title="按课程板块分组：一个孩子可同时属于识字A组、英语B组等多个分组，排课时按组选择孩子。" />

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="group_name" label="分组名称" min-width="130" />
      <el-table-column prop="course_type" label="课程板块" width="110" />
      <el-table-column label="组内孩子" min-width="200">
        <template #default="{ row }">
          <template v-if="row.members.length">
            <el-tag v-for="m in row.members" :key="m.id" size="small" class="member-tag">{{ m.child.name }}</el-tag>
          </template>
          <span v-else class="muted">暂无</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openMembers(row)">管理成员</el-button>
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.form.id ? '编辑分组' : '新建分组'" width="420px">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="分组名称" required>
          <el-input v-model="dialog.form.group_name" placeholder="如：识字A组" />
        </el-form-item>
        <el-form-item label="课程板块" required>
          <el-select v-model="dialog.form.course_type" style="width: 100%">
            <el-option label="识字" value="识字" />
            <el-option label="脑力训练" value="脑力训练" />
            <el-option label="英语" value="英语" />
          </el-select>
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

    <el-dialog v-model="members.visible" :title="`管理成员 - ${members.group?.group_name || ''}`" width="480px">
      <el-checkbox-group v-model="members.selected">
        <div class="member-list">
          <el-checkbox v-for="c in children" :key="c.id" :value="c.id" :label="c.name" :disabled="c.status !== '在读'">
            {{ c.name }}<span class="muted">（{{ c.class?.class_name || '未分班' }}）</span>
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="members.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveMembers">保存成员</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchGroups, saveGroup, deleteGroup, setGroupMembers, fetchChildren } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const children = ref([])
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({ visible: false, form: {} })
const members = reactive({ visible: false, group: null, selected: [] })

async function load() {
  loading.value = true
  try {
    list.value = await fetchGroups(kgId.value)
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.form = row ? { ...row } : { id: null, group_name: '', course_type: '识字', remark: '' }
  dialog.visible = true
}

async function handleSave() {
  if (!dialog.form.group_name?.trim()) {
    ElMessage.warning('请输入分组名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      group_name: dialog.form.group_name.trim(),
      course_type: dialog.form.course_type,
      remark: dialog.form.remark || null,
      ...(dialog.form.id ? {} : { status: '启用', kindergarten_id: kgId.value }),
    }
    await saveGroup(payload, dialog.form.id)
    ElMessage.success('已保存')
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openMembers(group) {
  members.group = group
  members.selected = group.members.map((m) => m.child_id)
  members.visible = true
}

async function handleSaveMembers() {
  saving.value = true
  try {
    await setGroupMembers(members.group.id, members.selected)
    ElMessage.success('成员已更新')
    members.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确认删除分组「${row.group_name}」？组内 ${row.members.length} 个成员关系将一并删除。`, '确认删除', { type: 'warning' })
  try {
    await deleteGroup(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([load(), fetchChildren(kgId.value).then((d) => (children.value = d))])
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.tip { margin-bottom: 16px; }
.member-tag { margin: 2px 4px 2px 0; }
.muted { color: var(--bw-muted); font-size: 12px; }
.member-list { max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
</style>
