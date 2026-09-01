<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>{{ auth.isTeacher ? '我的课表' : '排课管理' }}</b>
        <div class="actions">
          <el-select v-model="filter.status" clearable placeholder="全部状态" style="width: 120px" @change="load">
            <el-option label="待上课" value="待上课" />
            <el-option label="已完成" value="已完成" />
            <el-option label="已取消" value="已取消" />
          </el-select>
          <template v-if="!auth.isTeacher">
            <el-button type="primary" plain @click="openDialog()">新建排课</el-button>
            <el-button type="primary" @click="openPackageDialog()">按组合排课</el-button>
          </template>
        </div>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="lesson_date" label="日期" width="110" />
      <el-table-column label="时间" width="90">
        <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="时长" width="70" align="center">
        <template #default="{ row }">{{ row.duration_minutes ? row.duration_minutes + '分' : '-' }}</template>
      </el-table-column>
      <el-table-column label="课程 / 主题" min-width="180">
        <template #default="{ row }">
          <div>{{ row.lesson?.lesson_name }}</div>
          <div class="muted">{{ row.lesson?.course?.course_type }} · {{ row.lesson?.topic || '无主题' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="分组" width="110">
        <template #default="{ row }">{{ row.study_group?.group_name }}</template>
      </el-table-column>
      <el-table-column label="老师" width="90">
        <template #default="{ row }">{{ row.teacher?.name }}</template>
      </el-table-column>
      <el-table-column label="学员" width="70" align="center">
        <template #default="{ row }">{{ row.students.length }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="课件" width="80" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openCourseware(row)">课件</el-button>
        </template>
      </el-table-column>
      <el-table-column v-if="!auth.isTeacher" label="操作" width="220" align="center">
        <template #default="{ row }">
          <template v-if="row.status === '待上课'">
            <el-button link type="primary" size="small" @click="openDialog(row)">调整</el-button>
            <el-button link type="danger" size="small" @click="setStatus(row, '已取消')">取消</el-button>
            <el-button link type="success" size="small" @click="setStatus(row, '已完成')">完成</el-button>
          </template>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- ================= 单节排课（新建 / 调整复用） ================= -->
    <el-dialog v-model="dialog.visible" :title="dialog.editingId ? '调整排课' : '新建排课'" width="560px">
      <el-form :model="dialog.form" label-width="90px">
        <el-form-item label="课程板块" required>
          <el-select v-model="dialog.form.courseId" placeholder="选择课程板块" style="width: 100%" @change="dialog.form.lessonId = null; autoAssignLesson()">
            <el-option v-for="c in courses" :key="c.id" :label="`${c.course_type} · ${c.course_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课节" required>
          <el-select v-model="dialog.form.lessonId" placeholder="选择课节（授课内容）" style="width: 100%">
            <el-option
              v-for="l in lessonOptions"
              :key="l.id"
              :label="l.lesson_name + (l._current ? '（当前课节）' : l._locked ? '（未解锁）' : l._done ? '（已完成·复习）' : l._next ? '（下一节）' : '')"
              :value="l.id"
              :disabled="l._locked" />
          </el-select>
          <div class="muted">按顺序解锁：完成前一节才开放下一节；已完成的课节可再次排课复习</div>
          <div v-if="currentLesson?.outline" class="outline muted">{{ currentLesson.outline }}</div>
        </el-form-item>
        <el-form-item label="授课分组" required>
          <el-select v-model="dialog.form.groupId" placeholder="选择分组" style="width: 100%" @change="autoAssignLesson">
            <el-option
              v-for="g in groups.filter((g) => g.course_type === currentCourse?.course_type)"
              :key="g.id"
              :label="`${g.group_name}（${g.members.length}人）`"
              :value="g.id" />
          </el-select>
          <div class="muted">{{ dialog.editingId ? '更换分组后，学员名单将按新分组重新快照' : '将按分组当前成员快照学员名单' }}</div>
        </el-form-item>
        <el-form-item label="授课老师" required>
          <el-select v-model="dialog.form.teacherId" placeholder="选择老师" style="width: 100%">
            <el-option v-for="t in teachers" :key="t.id" :label="`${t.name}（${t.role}）`" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker v-model="dialog.form.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-time-picker v-model="dialog.form.time" format="HH:mm" value-format="HH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="时长(分钟)">
          <el-input-number v-model="dialog.form.duration" :min="15" :max="180" :step="15" />
        </el-form-item>
        <el-form-item label="补充说明">
          <el-input v-model="dialog.form.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">{{ dialog.editingId ? '保存调整' : '创建排课' }}</el-button>
      </template>
    </el-dialog>

    <!-- ================= 按组合排课（新） ================= -->
    <el-dialog v-model="pkg.visible" title="按推荐组合排课" width="920px" top="4vh" class="pkg-dialog">
      <!-- 步骤1：选组合 -->
      <div class="step-title">① 选择推荐组合（平台管理员设置）</div>
      <div v-if="packages.length === 0" class="muted empty-tip">暂无可用组合，请联系平台管理员在「课程组合」中设置。</div>
      <div v-else class="pkg-grid">
        <div
          v-for="p in packages" :key="p.id"
          class="pkg-card" :class="{ active: pkg.selectedId === p.id }"
          @click="selectPackage(p.id)">
          <div class="pkg-name">{{ p.package_name }}</div>
          <div class="pkg-desc">{{ p.description || '暂无说明' }}</div>
          <div class="pkg-meta">{{ p.items.length }} 节课 · 涉及 {{ new Set(p.items.map((i) => i.lesson?.course?.course_type).filter(Boolean)).size }} 个板块</div>
        </div>
      </div>
      <div v-if="selectedPackage" class="pkg-detail">
        <div class="step-sub">组合明细</div>
        <el-table :data="selectedPackage.items" size="small" :border="true" max-height="180">
          <el-table-column label="周几" width="70" align="center">
            <template #default="{ row }">{{ WEEKS[row.day_of_week - 1] }}</template>
          </el-table-column>
          <el-table-column label="建议时间" width="90" align="center">
            <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
          </el-table-column>
          <el-table-column prop="lesson.lesson_name" label="课节" min-width="160" />
          <el-table-column label="板块" width="90">
            <template #default="{ row }">{{ row.lesson?.course?.course_type }}</template>
          </el-table-column>
          <el-table-column label="时长" width="70" align="center">
            <template #default="{ row }">{{ row.duration_minutes }}分</template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 步骤2：配置 -->
      <template v-if="selectedPackage">
        <div class="step-title">② 排课设置</div>
        <el-form label-width="90px" class="pkg-form">
          <div class="cfg-row">
            <el-form-item label="周起始" required>
              <el-date-picker v-model="pkg.weekStart" type="date" value-format="YYYY-MM-DD" :disabled-date="disablePast" style="width: 160px" @change="buildPreview" />
              <div class="muted inline-tip">将从该日期所在周的周一开始生成</div>
            </el-form-item>
            <el-form-item label="默认老师" required>
              <el-select v-model="pkg.teacherId" placeholder="选择老师" style="width: 200px">
                <el-option v-for="t in teachers" :key="t.id" :label="`${t.name}（${t.role}）`" :value="t.id" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item label="分组映射" required>
            <div class="group-mapping">
              <div v-for="ct in packageCourseTypes" :key="ct" class="mapping-row">
                <el-tag size="small">{{ ct }}</el-tag>
                <el-select v-model="pkg.groupMap[ct]" placeholder="选择该板块的授课分组" size="default" style="width: 260px" @change="buildPreview">
                  <el-option
                    v-for="g in groups.filter((g) => g.course_type === ct)"
                    :key="g.id"
                    :label="`${g.group_name}（${g.members.length}人）`"
                    :value="g.id" />
                </el-select>
                <span v-if="pkg.groupMap[ct] && groupMemberCount(pkg.groupMap[ct]) === 0" class="warn-tip">该分组暂无成员，生成时将跳过</span>
              </div>
            </div>
          </el-form-item>
        </el-form>

        <!-- 步骤3：预览 -->
        <div class="step-title">③ 预览与调整 <el-button size="small" text type="primary" @click="buildPreview">重新生成预览</el-button></div>
        <el-table :data="pkg.preview" size="small" :border="true" max-height="260" empty-text="请先完成上方设置">
          <el-table-column label="" width="40" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.checked" />
            </template>
          </el-table-column>
          <el-table-column label="日期" width="130">
            <template #default="{ row }">
              <span>{{ row.date }}（{{ WEEKS[row.dayOfWeek - 1] }}）</span>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="120">
            <template #default="{ row }">
              <el-time-picker v-model="row.time" format="HH:mm" value-format="HH:mm:ss" size="small" style="width: 110px" />
            </template>
          </el-table-column>
          <el-table-column prop="lessonName" label="课节" min-width="150">
            <template #default="{ row }">
              <div>{{ row.lessonName }}</div>
              <div class="muted">{{ row.courseType }}</div>
            </template>
          </el-table-column>
          <el-table-column label="分组" width="130">
            <template #default="{ row }">
              <span v-if="row.groupName">{{ row.groupName }}（{{ row.memberCount }}人）</span>
              <span v-else class="warn-tip">未设置分组</span>
            </template>
          </el-table-column>
          <el-table-column label="老师" width="150">
            <template #default="{ row }">
              <el-select v-model="row.teacherId" size="small" style="width: 130px">
                <el-option v-for="t in teachers" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="pkg.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!canGenerate" @click="handleGenerate">
          生成 {{ checkedCount }} 节排课
        </el-button>
      </template>
    </el-dialog>

    <!-- ================= 识字课件查看 ================= -->
    <el-dialog v-model="cw.visible" width="780px" top="4vh" :title="`课件 · ${cw.lessonName || ''}`" destroy-on-close>
      <div class="cw-picker" v-if="cwReviewLessons.length > 1">
        <span class="muted">复习已完成课节：</span>
        <el-select v-model="cw.viewLessonId" style="width: 280px" @change="loadCwItems">
          <el-option :value="cw.currentLessonId" :label="`本节 · ${cw.lessonName}`" />
          <el-option v-for="l in cwReviewLessons.filter((x) => x.id !== cw.currentLessonId)" :key="l.id" :value="l.id" :label="`复习 · ${l.lesson_name}`" />
        </el-select>
      </div>
      <div v-loading="cw.loading">
        <div v-if="cw.lessonItems.length" class="cw-chips">
          <span
            v-for="li in cw.lessonItems"
            :key="li.id"
            class="cw-chip"
            :class="{ active: cw.selectedItemId === li.item.id }"
            @click="cw.selectedItemId = li.item.id"
          >{{ li.item.content }}</span>
        </div>
        <CoursewareCard v-if="cwSelected" :item="cwSelected" :key="cwSelected.id" />
        <el-empty v-else-if="!cw.loading" description="该课节尚未绑定教学内容，请联系平台管理员配置" :image-size="80" />
      </div>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import {
  fetchSchedules, createSchedule, updateSchedule, deleteSchedule, replaceScheduleStudents,
  fetchGroups, fetchCourses, fetchStaff, fetchPackages, batchCreateSchedules,
  fetchGroupProgress, fetchLessonItems,
} from '../../api/data'
import CoursewareCard from '../../components/CoursewareCard.vue'

const WEEKS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const auth = useAuthStore()
const kgId = computed(() => auth.profile?.kindergartenId)

const list = ref([])
const groups = ref([])
const courses = ref([])
const staff = ref([])
const packages = ref([])
const loading = ref(false)
const saving = ref(false)
const filter = reactive({ status: null })

const dialog = reactive({
  visible: false,
  editingId: null, // null=新建；否则为被调整的排课 id
  originalGroupId: null, // 打开调整弹窗时的分组，用于判断是否需要重新快照学员
  form: { courseId: null, lessonId: null, groupId: null, teacherId: null, date: null, time: null, duration: 30, note: '' },
})

const pkg = reactive({
  visible: false,
  selectedId: null,
  weekStart: null,
  teacherId: null,
  groupMap: {},
  preview: [],
})

/* ---------- 学习进度与解锁 ---------- */
const progressRows = ref([])
/** 每个分组已完成的课节 id 集合 */
const completedByGroup = computed(() => {
  const map = {}
  for (const r of progressRows.value) {
    if (!map[r.study_group_id]) map[r.study_group_id] = new Set()
    map[r.study_group_id].add(r.lesson_id)
  }
  return map
})

/** 课节下拉选项：已完成（复习）+ 下一节 可选，其余锁定；调整排课时当前课节始终可选 */
const lessonOptions = computed(() => {
  const c = currentCourse.value
  if (!c) return []
  const sorted = [...c.lessons].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const done = completedByGroup.value[dialog.form.groupId] || new Set()
  const next = sorted.find((l) => !done.has(l.id))
  return sorted.map((l) => {
    const isCurrent = dialog.editingId && l.id === dialog.form.lessonId
    return {
      ...l,
      _current: !!isCurrent,
      _done: done.has(l.id),
      _next: next?.id === l.id,
      _locked: !isCurrent && !done.has(l.id) && next?.id !== l.id,
    }
  })
})

/** 自动分配下一节未完成的课节（仅新建排课时；调整模式下保留已选课节） */
function autoAssignLesson() {
  if (dialog.editingId) return
  const next = lessonOptions.value.find((l) => l._next)
  dialog.form.lessonId = next ? next.id : null
}

/* ---------- 识字课件查看（课节内容绑定 + 复习） ---------- */
const cw = reactive({
  visible: false,
  groupId: null,
  currentLessonId: null,
  lessonName: '',
  viewLessonId: null, // 当前查看的课节（默认本节课节，可切已完成课节复习）
  lessonItems: [],
  selectedItemId: null,
  loading: false,
})
const cwSelected = computed(() => cw.lessonItems.find((li) => li.item.id === cw.selectedItemId)?.item)
/** 该分组已完成、可复习的课节 */
const cwReviewLessons = computed(() => {
  const done = completedByGroup.value[cw.groupId] || new Set()
  const out = []
  for (const c of courses.value) {
    for (const l of c.lessons) {
      if (done.has(l.id)) out.push({ id: l.id, lesson_name: l.lesson_name, course_type: c.course_type })
    }
  }
  return out.sort((a, b) => a.id - b.id)
})

async function openCourseware(row) {
  cw.groupId = row.study_group?.id
  cw.currentLessonId = row.lesson?.id
  cw.lessonName = row.lesson?.lesson_name || ''
  cw.viewLessonId = row.lesson?.id
  cw.visible = true
  await loadCwItems()
}

async function loadCwItems() {
  cw.loading = true
  cw.lessonItems = []
  cw.selectedItemId = null
  try {
    const rows = await fetchLessonItems(cw.viewLessonId)
    cw.lessonItems = rows
    if (rows.length) cw.selectedItemId = rows[0].item.id
  } catch (e) {
    ElMessage.error(e.message || '课件加载失败')
  } finally {
    cw.loading = false
  }
}

const currentCourse = computed(() => courses.value.find((c) => c.id === dialog.form.courseId))
const currentLesson = computed(() => currentCourse.value?.lessons.find((l) => l.id === dialog.form.lessonId))
const teachers = computed(() => staff.value.filter((s) => s.status === '在职' && s.role !== '平台管理员'))

const selectedPackage = computed(() => packages.value.find((p) => p.id === pkg.selectedId))
const packageCourseTypes = computed(() =>
  [...new Set((selectedPackage.value?.items || []).map((i) => i.lesson?.course?.course_type).filter(Boolean))],
)
const checkedCount = computed(() => pkg.preview.filter((r) => r.checked).length)
const canGenerate = computed(() => checkedCount.value > 0 && pkg.weekStart && pkg.teacherId)

/* ---------- 列表与基础操作 ---------- */
async function load() {
  loading.value = true
  try {
    const filters = {}
    if (auth.isTeacher) filters.teacherId = auth.profile.userId
    if (filter.status) filters.status = filter.status
    list.value = await fetchSchedules(kgId.value, filters)
    fetchGroupProgress(kgId.value).then((d) => (progressRows.value = d)).catch(() => {})
  } finally {
    loading.value = false
  }
}

function fmtTime(t) {
  return t ? t.slice(0, 5) : ''
}

function statusType(s) {
  return s === '已完成' ? 'success' : s === '已取消' ? 'info' : 'warning'
}

function disablePast(d) {
  return d.getTime() < Date.now() - 86400000
}

/* ---------- 单节排课（新建 / 调整复用） ---------- */
function openDialog(row = null) {
  dialog.editingId = row?.id || null
  dialog.originalGroupId = row?.study_group?.id || null
  if (row) {
    dialog.form = {
      courseId: row.lesson?.course?.id || null,
      lessonId: row.lesson?.id || null,
      groupId: row.study_group?.id || null,
      teacherId: row.teacher?.id || null,
      date: row.lesson_date || null,
      time: row.start_time ? row.start_time.slice(0, 8) : null,
      duration: row.duration_minutes || 30,
      note: row.note || '',
    }
  } else {
    dialog.form = { courseId: null, lessonId: null, groupId: null, teacherId: null, date: null, time: null, duration: 30, note: '' }
  }
  dialog.visible = true
}

async function handleSave() {
  const f = dialog.form
  if (!f.courseId || !f.lessonId || !f.groupId || !f.teacherId || !f.date || !f.time) {
    ElMessage.warning('请完整填写排课信息')
    return
  }
  const group = groups.value.find((g) => g.id === f.groupId)
  if (!group || group.members.length === 0) {
    ElMessage.warning('所选分组暂无成员，请先在分组管理中添加孩子')
    return
  }
  saving.value = true
  try {
    const fields = {
      lesson_date: f.date,
      start_time: `${f.time}+08:00`,
      duration_minutes: f.duration,
      note: f.note || null,
      study_group_id: f.groupId,
      lesson_id: f.lessonId,
      teacher_id: f.teacherId,
    }
    if (dialog.editingId) {
      await updateSchedule(dialog.editingId, fields)
      // 分组变更时按新分组重新快照学员名单
      if (f.groupId !== dialog.originalGroupId) {
        await replaceScheduleStudents(dialog.editingId, group.members.map((m) => m.child_id))
      }
      ElMessage.success('已保存调整')
    } else {
      const object = { ...fields, status: '待上课', kindergarten_id: kgId.value }
      const studentIds = group.members.map((m) => m.child_id)
      await createSchedule(object, studentIds)
      ElMessage.success(`排课成功，已快照 ${studentIds.length} 名学员`)
    }
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || (dialog.editingId ? '保存失败' : '创建失败'))
  } finally {
    saving.value = false
  }
}

async function setStatus(row, status) {
  try {
    await updateSchedule(row.id, { status })
    ElMessage.success(`已${status}`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确认删除 ${row.lesson_date} 的排课？学员快照与课后记录将一并删除。`, '确认删除', { type: 'warning' })
  try {
    await deleteSchedule(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

/* ---------- 按组合排课 ---------- */
function openPackageDialog() {
  pkg.selectedId = null
  pkg.weekStart = nextMonday()
  pkg.teacherId = teachers.value.length === 1 ? teachers.value[0].id : null
  pkg.groupMap = {}
  pkg.preview = []
  pkg.visible = true
}

function nextMonday() {
  const d = new Date()
  const day = d.getDay() === 0 ? 7 : d.getDay()
  d.setDate(d.getDate() + (8 - day)) // 下周一
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function selectPackage(id) {
  pkg.selectedId = id
  pkg.groupMap = {}
  // 自动预填：每个板块选第一个可用分组
  const types = [...new Set((selectedPackage.value?.items || []).map((i) => i.lesson?.course?.course_type).filter(Boolean))]
  for (const ct of types) {
    const g = groups.value.find((g) => g.course_type === ct && g.status !== '停用')
    if (g) pkg.groupMap[ct] = g.id
  }
  buildPreview()
}

function groupMemberCount(groupId) {
  return groups.value.find((g) => g.id === groupId)?.members.length ?? 0
}

/** 根据组合明细 + 设置生成预览行 */
function buildPreview() {
  const p = selectedPackage.value
  if (!p || !pkg.weekStart) {
    pkg.preview = []
    return
  }
  // 周起始日期归一化到所在周的周一
  const base = new Date(pkg.weekStart + 'T00:00:00')
  const dow = base.getDay() === 0 ? 7 : base.getDay()
  base.setDate(base.getDate() - (dow - 1))

  pkg.preview = p.items.map((it) => {
    const d = new Date(base)
    d.setDate(base.getDate() + (it.day_of_week - 1))
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const ct = it.lesson?.course?.course_type
    const groupId = pkg.groupMap[ct]
    const group = groups.value.find((g) => g.id === groupId)
    return {
      checked: true,
      date: dateStr,
      dayOfWeek: it.day_of_week,
      time: (it.start_time || '09:30:00').slice(0, 8),
      duration: it.duration_minutes || 30,
      lessonId: it.lesson?.id,
      lessonName: it.lesson?.lesson_name,
      courseType: ct,
      groupId,
      groupName: group?.group_name || null,
      memberCount: group?.members.length ?? 0,
      teacherId: pkg.teacherId,
    }
  })
}

async function handleGenerate() {
  const rows = pkg.preview.filter((r) => r.checked)
  const invalid = rows.find((r) => !r.groupId || !r.teacherId || !r.time)
  if (invalid) {
    ElMessage.warning(`存在未设置分组/老师的课节（${invalid.lessonName}），请调整后再生成`)
    return
  }
  const noMembers = rows.filter((r) => r.memberCount === 0)
  if (noMembers.length) {
    await ElMessageBox.confirm(
      `${noMembers.map((r) => r.groupName).join('、')} 分组暂无成员，对应 ${noMembers.length} 节课将跳过。继续生成其余排课？`,
      '提示',
      { type: 'warning' },
    ).catch(() => Promise.reject('cancel'))
  }
  const validRows = rows.filter((r) => r.memberCount > 0)
  if (validRows.length === 0) return ElMessage.warning('没有可生成的排课')

  saving.value = true
  try {
    const objects = validRows.map((r) => {
      const group = groups.value.find((g) => g.id === r.groupId)
      return {
        lesson_date: r.date,
        start_time: `${r.time}+08:00`,
        duration_minutes: r.duration,
        status: '待上课',
        kindergarten_id: kgId.value,
        study_group_id: r.groupId,
        lesson_id: r.lessonId,
        teacher_id: r.teacherId,
        students: { data: group.members.map((m) => ({ child_id: m.child_id })) },
      }
    })
    const res = await batchCreateSchedules(objects)
    const count = res.insert_schedule?.affected_rows ?? objects.length
    ElMessage.success(`已生成 ${count} 节排课（学员名单已按分组快照）`)
    pkg.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '生成失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([
    load(),
    fetchGroups(kgId.value).then((d) => (groups.value = d)),
    fetchCourses().then((d) => (courses.value = d)),
    fetchStaff(kgId.value).then((d) => (staff.value = d)),
    fetchPackages().then((d) => (packages.value = d.filter((p) => p.status === '启用'))).catch(() => {}),
    fetchGroupProgress(kgId.value).then((d) => (progressRows.value = d)).catch(() => {}),
  ])
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.actions { display: flex; gap: 12px; }
.muted { color: var(--bw-muted); font-size: 12px; line-height: 1.6; }
.outline { white-space: pre-wrap; margin-top: 4px; }
.empty-tip { padding: 12px 0; }
.step-title { font-weight: 600; margin: 14px 0 10px; display: flex; align-items: center; gap: 12px; }
.step-sub { font-size: 13px; color: var(--bw-muted); margin: 10px 0 6px; }
.pkg-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pkg-card { border: 1px solid var(--bw-border); border-radius: 8px; padding: 12px; cursor: pointer; transition: all .15s; }
.pkg-card:hover { border-color: var(--el-color-primary-light-5); }
.pkg-card.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); box-shadow: 0 0 0 1px var(--el-color-primary) inset; }
.pkg-name { font-weight: 600; margin-bottom: 4px; }
.pkg-desc { color: var(--bw-muted); font-size: 12px; line-height: 1.5; height: 36px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pkg-meta { font-size: 12px; color: var(--bw-muted); margin-top: 6px; }
.pkg-detail { margin-top: 12px; }
.cfg-row { display: flex; gap: 24px; }
.inline-tip { margin-left: 8px; }
.group-mapping { display: flex; flex-direction: column; gap: 8px; }
.mapping-row { display: flex; align-items: center; gap: 10px; }
.warn-tip { color: var(--el-color-warning); font-size: 12px; }
.cw-picker { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.cw-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.cw-chip { padding: 6px 12px; border: 1px solid var(--bw-border); border-radius: 6px; cursor: pointer; font-family: 'Kaiti SC', KaiTi, serif; font-size: 18px; background: #fff; transition: all .15s; }
.cw-chip:hover { border-color: var(--el-color-primary); }
.cw-chip.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
</style>
