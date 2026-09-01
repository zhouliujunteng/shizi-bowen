<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="6" v-for="s in stats" :key="s.label">
        <el-card shadow="never" class="stat-card">
          <p class="num">{{ s.value }}</p>
          <p class="label">{{ s.label }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="table-card">
      <template #header><b>近期排课</b></template>
      <el-table :data="recent" v-loading="loading" stripe>
        <el-table-column prop="lesson_date" label="日期" width="110" />
        <el-table-column prop="start_time" label="时间" width="110">
          <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
        </el-table-column>
        <el-table-column label="课程" min-width="160">
          <template #default="{ row }">{{ row.lesson?.lesson_name }}</template>
        </el-table-column>
        <el-table-column label="分组" width="110">
          <template #default="{ row }">{{ row.study_group?.group_name }}</template>
        </el-table-column>
        <el-table-column label="老师" width="90">
          <template #default="{ row }">{{ row.teacher?.name }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { fetchChildren, fetchSchedules } from '../../api/data'

const auth = useAuthStore()
const children = ref([])
const schedules = ref([])
const loading = ref(false)

const kgId = computed(() => auth.profile?.kindergartenId)

const stats = computed(() => [
  { label: '在读孩子', value: children.value.filter((c) => c.status === '在读').length },
  { label: '待上课', value: schedules.value.filter((s) => s.status === '待上课').length },
  { label: '已完成', value: schedules.value.filter((s) => s.status === '已完成').length },
  { label: '课后记录', value: schedules.value.filter((s) => s.lesson_record).length },
])

const recent = computed(() => schedules.value.slice(0, 8))

function fmtTime(t) {
  return t ? t.slice(0, 5) : ''
}

function statusType(s) {
  return s === '已完成' ? 'success' : s === '已取消' ? 'info' : 'warning'
}

onMounted(async () => {
  loading.value = true
  try {
    ;[children.value, schedules.value] = await Promise.all([fetchChildren(kgId.value), fetchSchedules(kgId.value)])
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stat-card { text-align: center; }
.num { font-size: 28px; font-weight: 700; color: var(--bw-primary); margin: 8px 0 4px; }
.label { color: var(--bw-muted); margin: 0 0 8px; font-size: 13px; }
.table-card { margin-top: 16px; }
</style>
