<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <b>识字字库 · 课件制作</b>
        <el-radio-group v-model="tab" size="default">
          <el-radio-button v-for="t in TABS" :key="t.key" :value="t.key">{{ t.label }}（{{ itemsByTab(t.key).length }}）</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <div v-loading="loading" class="char-grid">
      <div
        v-for="it in itemsByTab(tab)"
        :key="it.id"
        class="char-cell"
        :class="{ configured: !!it.courseware }"
        @click="openEditor(it)"
      >
        <div class="char-text">{{ it.content }}</div>
        <div class="char-pinyin">{{ it.pinyin }}</div>
        <el-tag v-if="it.courseware" size="small" type="success" class="badge">已配课件</el-tag>
        <el-tag v-else size="small" type="info" class="badge">未配置</el-tag>
      </div>
    </div>

    <!-- ============ 课件编辑器 ============ -->
    <el-dialog v-model="editor.visible" width="860px" top="3vh" :title="`课件制作 · ${editor.item?.content || ''}`" destroy-on-close>
      <div v-if="editor.item" class="editor-body">
        <!-- 左：点选笔画 -->
        <div class="editor-left">
          <CharStrokes
            :char="editor.item.content"
            :groups="editor.groups"
            :size="320"
            :editable="editor.activeGroup >= 0"
            :active-group-index="editor.activeGroup"
            default-color="#c0c4cc"
            @toggle-stroke="toggleStroke"
          />
          <div class="muted center-tip">
            <template v-if="isWordItem">英文内容无需笔画分组，直接填写右侧专属讲解即可</template>
            <template v-else>{{ editor.activeGroup >= 0 ? '点击笔画，加入/移出当前分组' : '先在右侧新增或选中一个分组，再点选笔画' }}</template>
          </div>
          <div class="char-meta">
            <div><b>{{ editor.item.content }}</b> {{ editor.item.pinyin }}</div>
            <div class="muted">{{ editor.item.meaning }}</div>
            <div v-if="editor.item.components_note" class="muted">拆分：{{ editor.item.components_note }}</div>
          </div>
        </div>

        <!-- 右：分组 + 讲解 -->
        <div class="editor-right">
          <template v-if="!isWordItem">
          <div class="section-title">
            笔画分组注释
            <el-button size="small" type="primary" plain @click="addGroup">新增分组</el-button>
          </div>
          <div v-if="editor.groups.length === 0" class="muted empty-groups">
            还没有分组。例如「明」可分为「日」和「月」两组，分别配颜色和注释；也可点选任意几个笔画成组。
          </div>
          <div
            v-for="(g, gi) in editor.groups"
            :key="gi"
            class="group-row"
            :class="{ active: editor.activeGroup === gi }"
            @click="editor.activeGroup = gi"
          >
            <span class="color-dot" :style="{ background: g.color }" @click.stop="cycleColor(g)"></span>
            <el-input v-model="g.label" size="small" placeholder="分组注释，如：日字旁" class="label-input" @click.stop />
            <span class="stroke-count">{{ g.strokes.length }}笔</span>
            <el-button link type="danger" size="small" @click.stop="removeGroup(gi)">删除</el-button>
          </div>
          </template>

          <div class="section-title">专属讲解</div>
          <el-input
            v-model="editor.explanation"
            type="textarea"
            :rows="5"
            placeholder="写给老师看的讲解：这个字的教法、故事、易错点……上课时老师会在课件中看到"
          />

          <div class="preview-tip muted">老师端课件效果：分组按颜色显示 + 注释列表 + 专属讲解，可下载为图片。</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="editor.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存课件</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import CharStrokes from '../../components/CharStrokes.vue'
import { fetchLiteracyItems, saveCourseware } from '../../api/data'

const COLORS = ['#E64A3C', '#F0821E', '#2E9E5B', '#2B6CB0', '#805AD5', '#D53F8C', '#0891B2', '#65A30D']

const TABS = [
  { key: '汉字', label: 'L1 汉字' },
  { key: '字根', label: 'L0 字根' },
  { key: '偏旁', label: '偏旁部首' },
  { key: '字母', label: '英文字母' },
  { key: '单词', label: '英语单词' },
]

const items = ref([])
const tab = ref('汉字')
const loading = ref(false)
const saving = ref(false)

const editor = reactive({
  visible: false,
  item: null,
  groups: [],
  activeGroup: -1,
  explanation: '',
})

/** 字母/单词无笔画数据，隐藏分组功能 */
const isWordItem = computed(() => ['字母', '单词'].includes(editor.item?.item_type))

function itemsByTab(t) {
  return items.value.filter((i) => i.item_type === t)
}

async function load() {
  loading.value = true
  try {
    items.value = await fetchLiteracyItems([0, 1, 10, 11])
  } finally {
    loading.value = false
  }
}

function openEditor(it) {
  editor.item = it
  editor.groups = (it.courseware?.stroke_groups || []).map((g) => ({ label: g.label || '', color: g.color || COLORS[0], strokes: [...(g.strokes || [])] }))
  editor.explanation = it.courseware?.explanation || ''
  editor.activeGroup = editor.groups.length ? 0 : -1
  editor.visible = true
}

function addGroup() {
  const used = new Set(editor.groups.map((g) => g.color))
  const color = COLORS.find((c) => !used.has(c)) || COLORS[editor.groups.length % COLORS.length]
  editor.groups.push({ label: '', color, strokes: [] })
  editor.activeGroup = editor.groups.length - 1
}

function removeGroup(gi) {
  editor.groups.splice(gi, 1)
  if (editor.activeGroup === gi) editor.activeGroup = editor.groups.length ? 0 : -1
  else if (editor.activeGroup > gi) editor.activeGroup -= 1
}

function cycleColor(g) {
  const i = COLORS.indexOf(g.color)
  g.color = COLORS[(i + 1) % COLORS.length]
}

function toggleStroke(idx) {
  const g = editor.groups[editor.activeGroup]
  if (!g) return
  // 若笔画已在其他组，先从其他组移除（一笔只属一组）
  for (const other of editor.groups) {
    const at = other.strokes.indexOf(idx)
    if (at >= 0) other.strokes.splice(at, 1)
  }
  if (!g.strokes.includes(idx)) g.strokes.push(idx)
  g.strokes.sort((a, b) => a - b)
}

async function handleSave() {
  const groups = editor.groups.filter((g) => g.strokes.length > 0)
  if (groups.some((g) => !g.label.trim())) {
    ElMessage.warning('有分组还没有填写注释')
    return
  }
  saving.value = true
  try {
    await saveCourseware(editor.item.id, {
      explanation: editor.explanation || null,
      stroke_groups: groups,
      status: '启用',
    })
    ElMessage.success('课件已保存')
    editor.visible = false
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
.char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; min-height: 200px; }
.char-cell { border: 1px solid var(--bw-border); border-radius: 8px; padding: 10px 6px; text-align: center; cursor: pointer; position: relative; transition: all .15s; background: #fff; }
.char-cell:hover { border-color: var(--el-color-primary); box-shadow: 0 2px 8px rgba(79, 70, 229, 0.12); }
.char-cell.configured { border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
.char-text { font-size: 30px; font-family: 'Kaiti SC', 'KaiTi', serif; line-height: 1.3; }
.char-pinyin { font-size: 12px; color: var(--bw-muted); margin: 2px 0 4px; }
.badge { transform: scale(0.85); }
.editor-body { display: flex; gap: 24px; }
.editor-left { flex: 0 0 340px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.center-tip { text-align: center; }
.char-meta { margin-top: 8px; text-align: center; line-height: 1.8; }
.editor-right { flex: 1; min-width: 0; }
.section-title { font-weight: 600; margin: 6px 0 10px; display: flex; justify-content: space-between; align-items: center; }
.empty-groups { padding: 8px 0 16px; line-height: 1.8; }
.group-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--bw-border); border-radius: 6px; margin-bottom: 8px; cursor: pointer; }
.group-row.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.color-dot { width: 18px; height: 18px; border-radius: 50%; flex: none; cursor: pointer; border: 1px solid rgba(0,0,0,0.1); }
.label-input { flex: 1; }
.stroke-count { font-size: 12px; color: var(--bw-muted); flex: none; }
.muted { color: var(--bw-muted); font-size: 12px; line-height: 1.6; }
.preview-tip { margin-top: 12px; }
</style>
