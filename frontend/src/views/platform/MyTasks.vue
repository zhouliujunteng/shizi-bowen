<template>
  <el-card>
    <template #header>
      <div class="card-header">
        <span>我的任务</span>
        <div class="header-actions">
          <el-button
            type="danger" plain size="small"
            :disabled="!selectedCount"
            :loading="releasing"
            @click="handleReleaseSelected"
          >撤销选中（{{ selectedCount }}）</el-button>
          <el-button
            type="danger" size="small"
            :disabled="!revocableCount"
            :loading="releasing"
            @click="handleReleaseAll"
          >全部撤销（{{ revocableCount }}）</el-button>
        </div>
      </div>
    </template>

    <div class="summary muted">
      共领取 {{ rows.length }} 个任务 · 已通过 {{ doneCount }} 个 · 已提交/已通过的不能撤销
    </div>

    <div v-loading="loading">
      <el-empty v-if="!loading && !groups.length" description="还没有领取任务，去「字库课件」领取吧" />
      <div v-for="g in groups" :key="g.key" class="task-group">
        <div class="group-title">
          <span class="group-name">{{ g.label }}</span>
          <span class="muted">{{ g.rows.length }} 个 · 已通过 {{ g.rows.filter((r) => r.reviewStatus === '已通过').length }} 个</span>
        </div>
        <el-table
          :data="g.rows" size="small" border
          @selection-change="(sel) => onSelChange(g.key, sel)"
        >
          <el-table-column type="selection" width="42" :selectable="(row) => revocable(row)" />
          <el-table-column label="内容" width="90" align="center">
            <template #default="{ row }">
              <span class="cell-char">{{ row.content }}</span>
              <span class="muted cell-pinyin">{{ row.pinyin }}</span>
              <el-tag v-if="row.module" size="small" effect="plain" class="module-tag">{{ row.module }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="meaning" label="释义" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="statusType(row.reviewStatus)">{{ statusText(row.reviewStatus) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="领取时间" width="160">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="goEdit(row)">去处理</el-button>
              <el-button
                v-if="revocable(row)" link type="danger" size="small"
                :loading="releasing" @click="handleReleaseOne(row)"
              >撤销</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchLiteracyItems, fetchTaskClaims, releaseTaskClaim, releaseTaskClaims } from '../../api/data'
import { useAuthStore } from '../../stores/auth'

const CATEGORY_ORDER = [
  { key: '偏旁', label: '偏旁部首（先做）' },
  { key: '字根', label: '字根（单字）' },
  { key: '汉字', label: '汉字（单字）' },
  { key: '字母', label: '英文字母' },
  { key: '单词', label: '英语单词' },
]

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const releasing = ref(false)
const rows = ref([])
const selMap = ref({}) // { categoryKey: [row,...] }

const groups = computed(() =>
  CATEGORY_ORDER
    .map((c) => ({ ...c, rows: rows.value.filter((r) => r.category === c.key) }))
    .filter((g) => g.rows.length > 0),
)

const selectedRows = computed(() => Object.values(selMap.value).flat())
const selectedCount = computed(() => selectedRows.value.length)
const revocableCount = computed(() => rows.value.filter((r) => revocable(r)).length)
const doneCount = computed(() => rows.value.filter((r) => r.reviewStatus === '已通过').length)

function revocable(row) {
  return !['待审核', '已通过'].includes(row.reviewStatus)
}
function statusText(s) {
  return s === '已通过' ? '已通过' : s === '待审核' ? '待审核' : s ? '草稿' : '未配置'
}
function statusType(s) {
  return s === '已通过' ? 'success' : s === '待审核' ? 'warning' : 'info'
}
function formatTime(t) {
  return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function onSelChange(key, sel) {
  selMap.value = { ...selMap.value, [key]: sel }
}

async function load() {
  loading.value = true
  try {
    const [its, cls] = await Promise.all([
      fetchLiteracyItems([0, 1, 10, 11]),
      fetchTaskClaims().catch(() => []),
    ])
    const itemMap = Object.fromEntries(its.map((i) => [i.id, i]))
    rows.value = cls
      .filter((c) => c.user_id === auth.profile?.userId)
      .map((c) => {
        const it = itemMap[c.item_id]
        return {
          claimId: c.id,
          itemId: c.item_id,
          category: c.category,
          createdAt: c.created_at,
          content: it?.content ?? '—',
          pinyin: it?.pinyin ?? '',
          meaning: it?.meaning ?? '',
          reviewStatus: it?.courseware?.review_status ?? null,
          sortOrder: it?.sort_order ?? 0,
        }
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } finally {
    loading.value = false
  }
}

function goEdit(row) {
  router.push({ name: 'platform-literacy', query: { tab: row.category } })
}

async function doRelease(list, confirmText) {
  try {
    await ElMessageBox.confirm(confirmText, '撤销领取', {
      confirmButtonText: '确定撤销', cancelButtonText: '取消', type: 'warning',
    })
  } catch { return }
  releasing.value = true
  try {
    if (list.length === 1) {
      await releaseTaskClaim(list[0].claimId)
    } else {
      await releaseTaskClaims(list.map((r) => r.claimId))
    }
    ElMessage.success(`已撤销 ${list.length} 个任务`)
    selMap.value = {}
    await load()
  } catch (e) {
    ElMessage.error(e.message || '撤销失败，请重试')
  } finally {
    releasing.value = false
  }
}

function handleReleaseOne(row) {
  doRelease([row], `确定撤销「${row.content}」的领取吗？`)
}
function handleReleaseSelected() {
  doRelease(selectedRows.value, `将撤销选中的 ${selectedCount.value} 个任务，确定吗？`)
}
function handleReleaseAll() {
  const list = rows.value.filter((r) => revocable(r))
  doRelease(list, `将撤销你名下全部 ${list.length} 个未提交审核的任务（已提交/已通过的保留），确定吗？`)
}

onMounted(load)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.header-actions { display: flex; gap: 8px; }
.summary { margin-bottom: 14px; font-size: 13px; }
.task-group { margin-bottom: 20px; }
.group-title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 8px; }
.group-name { font-weight: 600; font-size: 15px; }
.cell-char { font-size: 20px; font-family: 'Kaiti SC', 'KaiTi', serif; margin-right: 4px; }
.cell-pinyin { font-size: 12px; }
.muted { color: var(--bw-muted); font-size: 12px; }
</style>
