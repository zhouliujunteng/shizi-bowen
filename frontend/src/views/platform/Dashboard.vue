<template>
  <div>
    <el-row :gutter="16" class="stats">
      <el-col :span="6" v-for="s in stats" :key="s.label">
        <el-card shadow="never">
          <p class="num">{{ s.value }}</p>
          <p class="label">{{ s.label }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="table-card">
      <template #header><b>园所概览</b></template>
      <el-table :data="kgs" v-loading="loading" stripe>
        <el-table-column prop="name" label="园所名称" min-width="140" />
        <el-table-column prop="contact_name" label="联系人" width="100" />
        <el-table-column prop="contact_phone" label="联系电话" width="130" />
        <el-table-column label="员工" width="70" align="center">
          <template #default="{ row }">{{ row.staff_users_aggregate.aggregate.count }}</template>
        </el-table-column>
        <el-table-column label="孩子" width="70" align="center">
          <template #default="{ row }">{{ row.children_aggregate.aggregate.count }}</template>
        </el-table-column>
        <el-table-column label="排课" width="70" align="center">
          <template #default="{ row }">{{ row.schedules_aggregate.aggregate.count }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === '启用' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchKindergartens } from '../../api/data'

const kgs = ref([])
const loading = ref(false)

const stats = computed(() => [
  { label: '合作园所', value: kgs.value.filter((k) => k.status === '启用').length },
  { label: '员工总数', value: kgs.value.reduce((s, k) => s + k.staff_users_aggregate.aggregate.count, 0) },
  { label: '在读孩子', value: kgs.value.reduce((s, k) => s + k.children_aggregate.aggregate.count, 0) },
  { label: '累计排课', value: kgs.value.reduce((s, k) => s + k.schedules_aggregate.aggregate.count, 0) },
])

onMounted(async () => {
  loading.value = true
  try {
    kgs.value = await fetchKindergartens()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stats .el-card { text-align: center; }
.num { font-size: 28px; font-weight: 700; color: var(--bw-primary); margin: 8px 0 4px; }
.label { color: var(--bw-muted); margin: 0 0 8px; font-size: 13px; }
.table-card { margin-top: 16px; }
</style>
