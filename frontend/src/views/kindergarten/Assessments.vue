<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>月度考核</b>
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择月份" @change="load" />
      </div>
    </template>

    <el-table :data="rows" v-loading="loading" stripe>
      <el-table-column prop="child.name" label="孩子" width="110" fixed />
      <el-table-column label="班级" width="100">
        <template #default="{ row }">{{ row.child.class?.class_name || '未分班' }}</template>
      </el-table-column>
      <el-table-column v-for="c in courses" :key="c.id" :label="c.course_type" min-width="130" align="center">
        <template #default="{ row }">
          <el-button v-if="row.scores[c.id]" link size="small" @click="openFill(row.child, c, row.scores[c.id])">
            <el-tag :type="scoreType(row.scores[c.id].score)" size="small">{{ row.scores[c.id].score }}</el-tag>
          </el-button>
          <el-button v-else link type="primary" size="small" @click="openFill(row.child, c, null)">待评定</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="fill.visible" :title="fillTitle" width="460px">
      <p class="muted">孩子：{{ fill.child?.name }} · 课程：{{ fill.course?.course_type }} · 月份：{{ month }}</p>
      <el-form label-width="70px">
        <el-form-item label="评分" required>
          <el-radio-group v-model="fill.score">
            <el-radio-button value="优秀">优秀</el-radio-button>
            <el-radio-button value="良好">良好</el-radio-button>
            <el-radio-button value="合格">合格</el-radio-button>
            <el-radio-button value="需加强">需加强</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="评语">
          <el-input v-model="fill.comment" type="textarea" :rows="3" placeholder="本月学习情况评语" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fill.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchChildren, fetchCourses, fetchAssessments, saveAssessment } from '../../api/data'

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const children = ref([])
const courses = ref([])
const assessments = ref([])
const loading = ref(false)
const saving = ref(false)

const fill = reactive({ visible: false, child: null, course: null, score: '优秀', comment: '' })

const fillTitle = computed(() => `${month.value} 考核评定`)

/** 矩阵行：每孩子一行，scores[courseId] = 考核记录 */
const rows = computed(() =>
  children.value.map((child) => {
    const scores = {}
    for (const a of assessments.value) {
      if (a.child?.id === child.id && a.course) scores[a.course.id] = a
    }
    return { child, scores }
  }),
)

async function load() {
  if (!month.value) return
  loading.value = true
  try {
    ;[children.value, courses.value, assessments.value] = await Promise.all([
      fetchChildren(kgId.value),
      fetchCourses(),
      fetchAssessments(kgId.value, month.value),
    ])
  } finally {
    loading.value = false
  }
}

function scoreType(s) {
  return s === '优秀' ? 'success' : s === '良好' ? '' : s === '合格' ? 'info' : 'danger'
}

function openFill(child, course, existing) {
  fill.child = child
  fill.course = course
  fill.score = existing?.score || '优秀'
  fill.comment = existing?.comment || ''
  fill.visible = true
}

async function handleSave() {
  saving.value = true
  try {
    await saveAssessment({
      assess_month: month.value,
      score: fill.score,
      comment: fill.comment || null,
      kindergarten_id: kgId.value,
      child_id: fill.child.id,
      course_id: fill.course.id,
      teacher_id: auth.profile.userId,
    })
    ElMessage.success('考核已保存')
    fill.visible = false
    await load()
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
.muted { color: var(--bw-muted); font-size: 13px; margin: 0 0 12px; }
</style>
