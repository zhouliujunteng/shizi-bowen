<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>课程组合管理</b>
        <el-button type="primary" @click="openDialog()">新建组合</el-button>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="package_name" label="组合名称" min-width="140" />
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column label="课节数" width="80" align="center">
        <template #default="{ row }">{{ row.items.length }}</template>
      </el-table-column>
      <el-table-column label="涉及课程" min-width="140">
        <template #default="{ row }">
          <el-tag v-for="t in courseTypesOf(row)" :key="t" size="small" class="tag-gap">{{ t }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '启用' ? 'success' : 'info'" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link :type="row.status === '启用' ? 'warning' : 'success'" size="small" @click="toggleStatus(row)">
            {{ row.status === '启用' ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog.visible" :title="dialog.id ? '编辑组合' : '新建组合'" width="860px" top="5vh">
      <el-form :model="dialog.form" label-width="80px">
        <el-form-item label="组合名称" required>
          <el-input v-model="dialog.form.name" placeholder="如：识字启蒙周计划" maxlength="30" show-word-limit style="width: 360px" />
        </el-form-item>
        <el-form-item label="组合说明">
          <el-input v-model="dialog.form.description" type="textarea" :rows="2" placeholder="面向什么阶段的孩子、预期效果等，园所排课时可见" />
        </el-form-item>
      </el-form>

      <div class="items-header">
        <b>组合明细（课节安排）</b>
        <el-button size="small" @click="addItem">+ 添加课节</el-button>
      </div>
      <el-table :data="dialog.items" size="small" :border="true" empty-text="暂无课节，点击右上角添加">
        <el-table-column label="#" type="index" width="40" align="center" />
        <el-table-column label="课程板块" width="120">
          <template #default="{ row }">
            {{ courseOfLesson(row.lessonId)?.course_type || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="课节" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row.lessonId" placeholder="选择课节" size="small" filterable style="width: 100%">
              <el-option-group v-for="c in courses" :key="c.id" :label="c.course_type">
                <el-option v-for="l in c.lessons" :key="l.id" :label="l.lesson_name" :value="l.id" />
              </el-option-group>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="周几" width="100">
          <template #default="{ row }">
            <el-select v-model="row.dayOfWeek" size="small">
              <el-option v-for="(d, i) in WEEKS" :key="i" :label="d" :value="i + 1" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="建议时间" width="120">
          <template #default="{ row }">
            <el-time-picker v-model="row.startTime" format="HH:mm" value-format="HH:mm:ss" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="时长" width="110">
          <template #default="{ row }">
            <el-input-number v-model="row.duration" :min="15" :max="120" :step="5" size="small" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="dialog.items.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存组合</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchPackages, savePackage, savePackageItems, deletePackage, fetchCourses } from '../../api/data'

const WEEKS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const list = ref([])
const courses = ref([])
const loading = ref(false)
const saving = ref(false)

const dialog = reactive({
  visible: false,
  id: null,
  form: { name: '', description: '' },
  items: [],
})

const lessonMap = computed(() => {
  const m = {}
  for (const c of courses.value) for (const l of c.lessons) m[l.id] = { ...l, course_type: c.course_type }
  return m
})

function courseOfLesson(lessonId) {
  return lessonMap.value[lessonId]
}

function courseTypesOf(row) {
  return [...new Set(row.items.map((it) => it.lesson?.course?.course_type).filter(Boolean))]
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchPackages()
  } catch (e) {
    // 表未就绪时静默降级为空列表（数据库表部署前）
    list.value = []
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  dialog.id = row?.id || null
  dialog.form = { name: row?.package_name || '', description: row?.description || '' }
  dialog.items = row
    ? row.items.map((it) => ({
        lessonId: it.lesson?.id,
        dayOfWeek: it.day_of_week,
        startTime: it.start_time?.slice(0, 8) || '09:30:00',
        duration: it.duration_minutes || 30,
      }))
    : []
  dialog.visible = true
}

function addItem() {
  dialog.items.push({ lessonId: null, dayOfWeek: 1, startTime: '09:30:00', duration: 30 })
}

async function handleSave() {
  if (!dialog.form.name.trim()) return ElMessage.warning('请填写组合名称')
  const validItems = dialog.items.filter((it) => it.lessonId && it.startTime)
  if (validItems.length === 0) return ElMessage.warning('请至少配置一个完整课节（含课节和时间）')
  if (dialog.items.length > validItems.length) {
    await ElMessageBox.confirm(`有 ${dialog.items.length - validItems.length} 行未选课节，保存时将忽略。继续？`, '提示', { type: 'warning' })
  }
  saving.value = true
  try {
    let pid = dialog.id
    const payload = { package_name: dialog.form.name.trim(), description: dialog.form.description || null }
    if (!pid) {
      const res = await savePackage(payload)
      pid = res.insert_course_package_one.id
    } else {
      await savePackage(payload, pid)
    }
    await savePackageItems(pid, validItems)
    ElMessage.success('组合已保存')
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
  try {
    await savePackage({ status: next }, row.id)
    ElMessage.success(`已${next}`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确认删除组合「${row.package_name}」？其下 ${row.items.length} 条课节安排将一并删除，不影响已生成的排课。`, '确认删除', { type: 'warning' })
  try {
    await deletePackage(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([load(), fetchCourses().then((d) => (courses.value = d))])
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.tag-gap { margin-right: 6px; }
.items-header { display: flex; justify-content: space-between; align-items: center; margin: 12px 0 8px; }
</style>
