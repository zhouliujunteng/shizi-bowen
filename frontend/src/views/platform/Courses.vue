<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>课程内容管理</b>
        <el-button type="primary" @click="openLessonDialog()">新建课节</el-button>
      </div>
    </template>

    <el-tabs v-model="activeCourseId" v-loading="loading">
      <el-tab-pane v-for="c in courses" :key="c.id" :label="`${c.course_type} · ${c.course_name}`" :name="c.id">
        <div class="muted course-desc">{{ c.description || '园所按此顺序上课：完成前一节才解锁后一节，已完成可随时复习。' }}</div>
        <el-table :data="c.lessons" stripe>
          <el-table-column label="顺序" width="70" align="center">
            <template #default="{ row }">{{ row.sort_order }}</template>
          </el-table-column>
          <el-table-column prop="lesson_name" label="课节名称" min-width="220" />
          <el-table-column prop="topic" label="主题" width="140" />
          <el-table-column label="教学内容" width="110" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.items.length ? 'success' : 'info'">{{ row.items.length ? row.items.length + ' 项' : '未绑定' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="330" align="center">
            <template #default="{ row, $index }">
              <el-button link type="primary" size="small" :disabled="$index === 0" @click="moveUp(c, $index)">上移</el-button>
              <el-button link type="primary" size="small" :disabled="$index === c.lessons.length - 1" @click="moveDown(c, $index)">下移</el-button>
              <el-button link type="primary" size="small" @click="openItemsDialog(row)">内容绑定</el-button>
              <el-button link type="primary" size="small" @click="openLessonDialog(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDeleteLesson(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- ============ 课节编辑 ============ -->
    <el-dialog v-model="lessonDialog.visible" :title="lessonDialog.form.id ? '编辑课节' : '新建课节'" width="560px">
      <el-form :model="lessonDialog.form" label-width="90px">
        <el-form-item label="所属课程">
          <el-select v-model="lessonDialog.form.course_id" style="width: 100%">
            <el-option v-for="c in courses" :key="c.id" :label="`${c.course_type} · ${c.course_name}`" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课节名称" required>
          <el-input v-model="lessonDialog.form.lesson_name" placeholder="如：第5课 会意字（上）" />
        </el-form-item>
        <el-form-item label="主题">
          <el-input v-model="lessonDialog.form.topic" />
        </el-form-item>
        <el-form-item label="教学大纲">
          <el-input v-model="lessonDialog.form.outline" type="textarea" :rows="4" placeholder="这节课教什么、怎么教——老师上课前会看到" />
        </el-form-item>
        <el-form-item label="顺序">
          <el-input-number v-model="lessonDialog.form.sort_order" :min="1" :max="99" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lessonDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveLesson">保存</el-button>
      </template>
    </el-dialog>

    <!-- ============ 内容绑定 ============ -->
    <el-dialog v-model="itemsDialog.visible" width="720px" top="4vh" :title="`内容绑定 · ${itemsDialog.lesson?.lesson_name || ''}`">
      <div class="bind-add">
        <el-select v-model="itemsDialog.pickId" filterable remote :remote-method="searchItems" :loading="itemsDialog.searching" placeholder="搜索字 / 偏旁 / 字母 / 单词" style="width: 320px">
          <el-option v-for="it in itemsDialog.searchResult" :key="it.id" :value="it.id" :label="`${it.content} ${it.pinyin || ''}`">
            <b style="font-family: 'Kaiti SC', KaiTi, serif">{{ it.content }}</b>
            <span class="muted" style="margin-left: 8px">{{ it.pinyin }} · {{ it.item_type }}</span>
          </el-option>
        </el-select>
        <el-button type="primary" plain :disabled="!itemsDialog.pickId" @click="addItem">添加</el-button>
        <span class="muted">按此顺序教学，可上下调整</span>
      </div>
      <el-table :data="itemsDialog.items" size="small" :border="true" max-height="380" empty-text="尚未绑定内容，从上方搜索添加">
        <el-table-column label="#" width="50" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="内容" width="120">
          <template #default="{ row }">
            <b style="font-size: 16px">{{ row.item.content }}</b>
            <span class="muted" style="margin-left: 6px">{{ row.item.pinyin }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.item.item_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="item.meaning" label="释义" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ $index }">
            <el-button link size="small" :disabled="$index === 0" @click="moveItem($index, -1)">上移</el-button>
            <el-button link size="small" :disabled="$index === itemsDialog.items.length - 1" @click="moveItem($index, 1)">下移</el-button>
            <el-button link type="danger" size="small" @click="itemsDialog.items.splice($index, 1)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="itemsDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveItems">保存绑定</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchCoursesFull, saveLesson, deleteLesson, swapLessonOrder, saveLessonItems } from '../../api/data'
import { gql } from '../../api/graphql'

const courses = ref([])
const activeCourseId = ref(null)
const loading = ref(false)
const saving = ref(false)

const lessonDialog = reactive({ visible: false, form: {} })
const itemsDialog = reactive({ visible: false, lesson: null, items: [], pickId: null, searchResult: [], searching: false })

async function load() {
  loading.value = true
  try {
    courses.value = await fetchCoursesFull()
    if (!activeCourseId.value && courses.value.length) activeCourseId.value = courses.value[0].id
  } finally {
    loading.value = false
  }
}

/* ---------- 课节 ---------- */
function openLessonDialog(row) {
  lessonDialog.form = row
    ? { id: row.id, course_id: activeCourseId.value, lesson_name: row.lesson_name, topic: row.topic, outline: row.outline, sort_order: row.sort_order }
    : { id: null, course_id: activeCourseId.value, lesson_name: '', topic: '', outline: '', sort_order: nextSort() }
  lessonDialog.visible = true
}

function nextSort() {
  const c = courses.value.find((c) => c.id === activeCourseId.value)
  return c && c.lessons.length ? Math.max(...c.lessons.map((l) => l.sort_order)) + 1 : 1
}

async function handleSaveLesson() {
  const f = lessonDialog.form
  if (!f.lesson_name?.trim()) return ElMessage.warning('请填写课节名称')
  saving.value = true
  try {
    const { id, ...payload } = { ...f, status: '启用' }
    await saveLesson(payload, id)
    ElMessage.success('已保存')
    lessonDialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDeleteLesson(row) {
  await ElMessageBox.confirm(`确认删除「${row.lesson_name}」？其内容绑定将一并删除，已有排课不受影响但会丢失内容关联。`, '确认删除', { type: 'warning' })
  try {
    await deleteLesson(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function moveUp(course, idx) {
  const a = course.lessons[idx]
  const b = course.lessons[idx - 1]
  await swapLessonOrder(a.id, a.sort_order, b.id, b.sort_order)
  await load()
}
async function moveDown(course, idx) {
  const a = course.lessons[idx]
  const b = course.lessons[idx + 1]
  await swapLessonOrder(a.id, a.sort_order, b.id, b.sort_order)
  await load()
}

/* ---------- 内容绑定 ---------- */
function openItemsDialog(lesson) {
  itemsDialog.lesson = lesson
  itemsDialog.items = lesson.items.map((li) => ({ item_id: li.item.id, item: li.item, teaching_note: li.teaching_note }))
  itemsDialog.pickId = null
  itemsDialog.searchResult = []
  itemsDialog.visible = true
  searchItems('')
}

async function searchItems(kw) {
  itemsDialog.searching = true
  try {
    const where = kw ? { content: { _ilike: `%${kw}%` } } : {}
    const d = await gql(
      `query ($where: literacy_item_bool_exp) {
        literacy_item(where: $where, order_by: { level: asc, sort_order: asc }, limit: 30) {
          id content pinyin meaning item_type level
        }
      }`,
      { where },
    )
    itemsDialog.searchResult = d.literacy_item
  } finally {
    itemsDialog.searching = false
  }
}

function addItem() {
  const it = itemsDialog.searchResult.find((i) => i.id === itemsDialog.pickId)
  if (!it) return
  if (itemsDialog.items.some((r) => r.item_id === it.id)) {
    ElMessage.warning('该内容已在列表中')
    return
  }
  itemsDialog.items.push({ item_id: it.id, item: it, teaching_note: null })
  itemsDialog.pickId = null
}

function moveItem(idx, delta) {
  const arr = itemsDialog.items
  const [row] = arr.splice(idx, 1)
  arr.splice(idx + delta, 0, row)
}

async function handleSaveItems() {
  saving.value = true
  try {
    await saveLessonItems(itemsDialog.lesson.id, itemsDialog.items)
    ElMessage.success('绑定已保存')
    itemsDialog.visible = false
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
.course-desc { margin-bottom: 10px; }
.bind-add { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.muted { color: var(--bw-muted); font-size: 12px; }
</style>
