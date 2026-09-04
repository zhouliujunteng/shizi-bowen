<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>课后记录</b>
        <el-radio-group v-model="filter.done" @change="applyFilter">
          <el-radio-button :value="false">待填写</el-radio-button>
          <el-radio-button :value="true">已填写</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <el-table :data="filtered" v-loading="loading" stripe>
      <el-table-column prop="lesson_date" label="日期" width="110" />
      <el-table-column label="时间" width="90">
        <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="课程" min-width="170">
        <template #default="{ row }">{{ row.lesson?.lesson_name }}</template>
      </el-table-column>
      <el-table-column label="分组" width="110">
        <template #default="{ row }">{{ row.study_group?.group_name }}</template>
      </el-table-column>
      <el-table-column label="学员" width="70" align="center">
        <template #default="{ row }">{{ row.students.length }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.lesson_record ? 'success' : 'warning'" size="small">
            {{ row.lesson_record ? '已填写' : '待填写' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openFill(row)">
            {{ row.lesson_record ? '查看/修改' : '填写记录' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="fill.visible" :title="fillTitle" width="640px" top="6vh">
      <div class="fill-meta muted">
        {{ fill.schedule?.lesson_date }} {{ fmtTime(fill.schedule?.start_time) }} ·
        {{ fill.schedule?.lesson?.course?.course_type }} · {{ fill.schedule?.study_group?.group_name }}
      </div>
      <el-collapse class="outline-box">
        <el-collapse-item title="授课大纲（点击展开）">
          <pre class="outline">{{ fill.schedule?.lesson?.outline || '暂无大纲' }}</pre>
        </el-collapse-item>
      </el-collapse>

      <h4>学员出勤与表现</h4>
      <div class="student-list">
        <div v-for="s in fill.students" :key="s.id" class="student-row">
          <span class="s-name">{{ s.name }}</span>
          <el-radio-group v-model="s.attendance" size="small">
            <el-radio-button value="出勤">出勤</el-radio-button>
            <el-radio-button value="缺勤">缺勤</el-radio-button>
            <el-radio-button value="请假">请假</el-radio-button>
          </el-radio-group>
          <el-input v-model="s.performance" placeholder="课堂表现（可选）" size="small" class="s-perf" />
        </div>
      </div>

      <h4>整体课堂情况</h4>
      <el-input v-model="fill.summary" type="textarea" :rows="4" placeholder="本节课整体授课情况、进度、注意事项等" />

      <template #footer>
        <el-button @click="fill.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存记录</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchSchedules, saveLessonRecord } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const filter = reactive({ done: false })

const fill = reactive({ visible: false, schedule: null, students: [], summary: '' })

const filtered = computed(() => list.value.filter((s) => !!s.lesson_record === filter.done))

const fillTitle = computed(() => {
  const s = fill.schedule
  return s ? `${s.lesson_date} 课后记录` : '课后记录'
})

async function load() {
  loading.value = true
  try {
    const filters = {}
    if (auth.isTeacher) filters.teacherId = auth.profile.userId
    list.value = await fetchSchedules(kgId.value, filters)
  } finally {
    loading.value = false
  }
}

function applyFilter() {
  /* computed 自动响应 */
}

function fmtTime(t) {
  return t ? t.slice(0, 5) : ''
}

function openFill(row) {
  fill.schedule = row
  fill.students = row.students.map((s) => ({
    id: s.id,
    child_id: s.child_id,
    name: s.child.name,
    attendance: s.attendance || '出勤',
    performance: s.performance || '',
  }))
  fill.summary = row.lesson_record?.overall_summary || ''
  fill.visible = true
}

async function handleSave() {
  saving.value = true
  try {
    const updates = fill.students.map((s) => ({
      where: { id: { _eq: s.id } },
      _set: { attendance: s.attendance, performance: s.performance || null },
    }))
    await saveLessonRecord(fill.schedule.id, fill.summary || null, updates, auth.profile.userId)
    ElMessage.success('课后记录已保存')
    fill.visible = false
    await load()
    filter.done = true
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.muted { color: var(--bw-muted); font-size: 13px; }
.fill-meta { margin-bottom: 12px; }
.outline-box { margin-bottom: 16px; }
.outline { white-space: pre-wrap; font-size: 13px; color: var(--bw-ink); margin: 0; font-family: inherit; }
h4 { margin: 16px 0 8px; }
.student-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.student-row { display: flex; align-items: center; gap: 12px; }
.s-name { width: 70px; flex-shrink: 0; }
.s-perf { flex: 1; }
</style>
