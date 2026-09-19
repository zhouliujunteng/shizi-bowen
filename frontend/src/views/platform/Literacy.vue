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

    <!-- 素材任务工具条（素材员领取任务；管理员可见进度） -->
    <div v-if="role === '素材员' || role === '平台管理员'" class="task-bar">
      <template v-if="role === '素材员'">
        <span class="task-label">领取任务（每次 20 个）：</span>
        <el-button size="small" type="primary" plain :loading="claiming" @click="claimBatch('偏旁')">领取部首</el-button>
        <el-button size="small" type="primary" plain :loading="claiming" @click="claimBatch('字根')">领取字根</el-button>
        <el-button size="small" type="primary" plain :loading="claiming" @click="claimBatch('汉字')">领取汉字</el-button>
        <el-button size="small" type="danger" plain :disabled="!myReleasable.length" :loading="claiming" @click="handleBatchRelease">撤销领取</el-button>
        <span class="task-stats">我的任务：{{ myClaims.length }} 个 · 已通过 {{ myDoneCount }} 个</span>
      </template>
      <template v-else>
        <span class="task-label muted">素材员在此领取任务（每次 20 个，按部首/字根/汉字分类）；被领取的字会锁定并显示领取人，未提交审核前可自行撤销。</span>
      </template>
    </div>

    <div v-loading="loading">
      <div v-for="g in displayGroups" :key="g.key" class="module-section">
        <div v-if="g.label" class="module-title">
          <span class="module-name">{{ g.label }}</span>
          <span class="muted">{{ g.items.length }} 个 · 已通过 {{ g.items.filter((i) => i.courseware?.review_status === '已通过').length }}</span>
        </div>
        <div class="char-grid">
          <div
            v-for="it in g.items"
            :key="it.id"
            class="char-cell"
            :class="cellClass(it)"
            @click="openEditor(it)"
          >
            <div class="char-text">{{ it.content }}</div>
            <div class="char-pinyin">{{ it.pinyin }}</div>
            <el-tag size="small" :type="badgeType(it)" class="badge">{{ badgeText(it) }}</el-tag>
            <div v-if="lockOf(it)" class="char-lock">🔒 {{ lockOf(it).user_name }}</div>
            <div v-else-if="myClaimOf(it)" class="char-mine">我的任务</div>
            <div v-else-if="it.courseware?.edited_by || it.courseware?.reviewed_by" class="char-crew">
              <span v-if="it.courseware?.edited_by">编·{{ it.courseware.edited_by }}</span>
              <span v-if="it.courseware?.reviewed_by">审·{{ it.courseware.reviewed_by }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============ 课件编辑器 ============ -->
    <el-dialog v-model="editor.visible" width="880px" top="3vh" :title="`课件制作 · ${editor.item?.content || ''}`" destroy-on-close>
      <div v-if="editor.item" class="editor-wrap">
        <!-- 读音页签（主读音 + 多音字） -->
        <div class="reading-tabs">
          <span
            v-for="(r, ri) in editor.readings"
            :key="ri"
            class="reading-tab"
            :class="{ active: editor.activeReading === ri }"
            @click="editor.activeReading = ri"
          >
            {{ ri === 0 ? '主读音' : '多音' }} · {{ r.pinyin || '未填拼音' }}
            <span v-if="ri > 0 && canEdit" class="tab-close" @click.stop="removeReading(ri)">×</span>
          </span>
          <el-button v-if="canEdit && !isWordItem" size="small" type="primary" plain @click="addVariant">添加多音字</el-button>
          <el-input
            v-if="editor.activeReading > 0"
            v-model="currentReading.pinyin"
            size="small"
            placeholder="该读音拼音，如 yuè"
            class="variant-pinyin-input"
            :disabled="!canEdit"
          />
        </div>

        <!-- 偏旁已通过讲解提示（编辑含该偏旁的字时自动展示） -->
        <div v-if="radicalHints.length" class="radical-hints">
          <div class="hint-title">本字包含的偏旁已有审核通过的讲解，请参考保持口径一致：</div>
          <div v-for="h in radicalHints" :key="h.content" class="hint-item">
            <b>「{{ h.content }}」<span v-if="h.pinyin"> {{ h.pinyin }}</span></b>
            <span class="hint-text">{{ h.explanation }}</span>
          </div>
        </div>

        <div class="editor-body">
          <!-- 左：点选笔画 + 配图 -->
          <div class="editor-left">
            <CharStrokes
              :char="editor.item.content"
              :groups="currentReading.groups"
              :size="320"
              :editable="canEdit && editor.activeGroup >= 0"
              :active-group-index="editor.activeGroup"
              default-color="#c0c4cc"
              @toggle-stroke="toggleStroke"
            />
            <div class="muted center-tip">
              <template v-if="isWordItem">英文内容无需笔画分组，直接填写右侧专属讲解即可</template>
              <template v-else>{{ canEdit ? (editor.activeGroup >= 0 ? '点击笔画，加入/移出当前分组' : '先在右侧新增或选中一个分组，再点选笔画') : '审核模式：笔画分组只读' }}</template>
            </div>
            <div class="char-meta">
              <div><b>{{ editor.item.content }}</b> {{ editor.item.pinyin }}</div>
              <div class="muted">{{ editor.item.meaning }}</div>
              <div v-if="editor.item.components_note" class="muted">拆分：{{ editor.item.components_note }}</div>
            </div>

            <!-- 配图上传（抽象字辅助理解） -->
            <div class="image-box">
              <div class="section-sub">配图（抽象字可选）</div>
              <div v-if="editor.image" class="image-preview">
                <img :src="editor.image" alt="配图" />
                <el-button v-if="canEdit" link type="danger" size="small" @click="editor.image = null">移除</el-button>
              </div>
              <template v-else>
                <label v-if="canEdit" class="upload-btn">
                  上传图片
                  <input type="file" accept="image/*" hidden @change="handleImageUpload" />
                </label>
                <div v-else class="muted">未上传配图</div>
              </template>
            </div>
          </div>

          <!-- 右：分组 + 讲解 -->
          <div class="editor-right">
            <template v-if="!isWordItem">
            <div class="section-title">
              笔画分组注释<template v-if="editor.readings.length > 1">（{{ currentReading.pinyin || '当前读音' }}）</template>
              <el-button v-if="canEdit" size="small" type="primary" plain @click="addGroup">新增分组</el-button>
            </div>
            <div v-if="currentReading.groups.length === 0" class="muted empty-groups">
              还没有分组。例如「明」可分为「日」和「月」两组，分别配颜色和注释；也可点选任意几个笔画成组。
            </div>
            <div
              v-for="(g, gi) in currentReading.groups"
              :key="gi"
              class="group-row"
              :class="{ active: editor.activeGroup === gi }"
              @click="editor.activeGroup = gi"
            >
              <span class="color-dot" :style="{ background: g.color }" @click.stop="canEdit && cycleColor(g)"></span>
              <el-input v-model="g.label" size="small" placeholder="分组注释，如：日字旁" class="label-input" :disabled="!canEdit" @click.stop />
              <span class="stroke-count">{{ g.strokes.length }}笔</span>
              <el-button v-if="canEdit" link type="danger" size="small" @click.stop="removeGroup(gi)">删除</el-button>
            </div>
            </template>

            <div class="section-title">专属讲解</div>
            <el-input
              v-model="currentReading.explanation"
              type="textarea"
              :rows="5"
              :disabled="!canEdit"
              placeholder="写给老师看的讲解：这个字的教法、故事、易错点……上课时老师会在课件中看到"
            />

            <div class="preview-tip muted">老师端课件效果：分组按颜色显示 + 注释列表 + 专属讲解 + 配图，可下载为图片。</div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="footer-status muted">
          当前状态：{{ reviewText(editor.item?.courseware?.review_status) }}
          <template v-if="editor.item?.courseware?.edited_by"> · 编辑：{{ editor.item.courseware.edited_by }}</template>
          <template v-if="editor.item?.courseware?.reviewed_by"> · 审核：{{ editor.item.courseware.reviewed_by }}</template>
          <template v-if="claimsMap[editor.item?.id]"> · 领取：{{ claimsMap[editor.item.id].user_name }}</template>
        </span>
        <el-button
          v-if="claimsMap[editor.item?.id] && (role === '平台管理员' || myClaimOf(editor.item))"
          link type="danger" @click="handleRelease"
        >{{ role === '平台管理员' ? '释放任务' : '撤销领取' }}</el-button>
        <el-button @click="editor.visible = false">取消</el-button>
        <template v-if="canEdit">
          <el-button :loading="saving" @click="handleSave('草稿')">保存草稿</el-button>
          <el-button type="warning" plain :loading="saving" @click="handleSave('待审核')">提交审核</el-button>
        </template>
        <template v-if="canReview">
          <el-button type="danger" plain :loading="saving" @click="handleReview('草稿')">退回</el-button>
          <el-button type="success" :loading="saving" @click="handleReview('已通过')">通过</el-button>
        </template>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import CharStrokes from '../../components/CharStrokes.vue'
import { fetchLiteracyItems, saveCourseware, reviewCourseware, fetchTaskClaims, claimTasks, releaseTaskClaim, releaseTaskClaims } from '../../api/data'
import { useAuthStore } from '../../stores/auth'

const COLORS = ['#E64A3C', '#F0821E', '#2E9E5B', '#2B6CB0', '#805AD5', '#D53F8C', '#0891B2', '#65A30D']

const TABS = [
  { key: '汉字', label: 'L1 汉字' },
  { key: '字根', label: 'L0 字根' },
  { key: '偏旁', label: '偏旁部首' },
  { key: '字母', label: '英文字母' },
  { key: '单词', label: '英语单词' },
]

/** 偏旁教学模块（顺序即教学顺序，可调整；不在列表中的偏旁归入「其他」） */
const MODULES = [
  { key: 'M1', label: 'M1 我们的身体' },
  { key: 'M2', label: 'M2 大自然的脾气' },
  { key: 'M3', label: 'M3 天地与草木' },
  { key: 'M4', label: 'M4 动物朋友' },
  { key: 'M5', label: 'M5 人和人的世界' },
  { key: 'M6', label: 'M6 房子、武器与器物' },
]

const auth = useAuthStore()
const route = useRoute()
const role = computed(() => auth.profile?.role)
const canEdit = computed(() => ['平台管理员', '素材员'].includes(role.value))
const canReview = computed(() => ['平台管理员', '审核员'].includes(role.value))

const items = ref([])
const claims = ref([])
const claiming = ref(false)
const tab = ref('汉字')
const loading = ref(false)
const saving = ref(false)

/* ---------- 素材任务领取 ---------- */
const myUserId = computed(() => auth.profile?.userId)
const claimsMap = computed(() => {
  const m = {}
  for (const c of claims.value) m[c.item_id] = c
  return m
})
const myClaims = computed(() => claims.value.filter((c) => c.user_id === myUserId.value))
const myDoneCount = computed(() => myClaims.value.filter((c) => {
  const it = items.value.find((i) => i.id === c.item_id)
  return it?.courseware?.review_status === '已通过'
}).length)

/** 被他人锁定：有领取记录、非本人、且课件未通过 */
function lockOf(it) {
  const c = claimsMap.value[it.id]
  if (!c || c.user_id === myUserId.value) return null
  if (it.courseware?.review_status === '已通过') return null
  return c
}
function myClaimOf(it) {
  const c = claimsMap.value[it.id]
  return c && c.user_id === myUserId.value ? c : null
}

/** 我可撤销的领取：本人领取且课件未提交审核/未通过 */
const myReleasable = computed(() => myClaims.value.filter((c) => {
  const it = items.value.find((i) => i.id === c.item_id)
  return !['待审核', '已通过'].includes(it?.courseware?.review_status)
}))

/** 批量撤销：释放自己名下所有未提交审核的领取 */
async function handleBatchRelease() {
  try {
    await ElMessageBox.confirm(
      `将撤销你名下 ${myReleasable.value.length} 个未提交审核的任务（已提交/已通过的保留），确定吗？`,
      '撤销领取',
      { confirmButtonText: '确定撤销', cancelButtonText: '取消', type: 'warning' },
    )
  } catch { return }
  claiming.value = true
  try {
    await releaseTaskClaims(myReleasable.value.map((c) => c.id))
    ElMessage.success('已撤销领取，任务已回到待领取池')
    await load()
  } catch (e) {
    ElMessage.error(e.message || '撤销失败，请重试')
  } finally {
    claiming.value = false
  }
}

/** 领取一批任务：该类别下未通过且未被领取的 20 个（按教学序） */
async function claimBatch(category) {
  const taken = new Set(claims.value.map((c) => c.item_id))
  const candidates = items.value
    .filter((i) => i.item_type === category && i.courseware?.review_status !== '已通过' && !taken.has(i.id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .slice(0, 20)
  if (candidates.length === 0) {
    ElMessage.info(`${category}类暂无可领取的任务（都已通过或已被领取）`)
    return
  }
  claiming.value = true
  try {
    await claimTasks(candidates.map((i) => ({
      item_id: i.id, user_id: myUserId.value, user_name: auth.profile?.name || '', category,
    })))
    ElMessage.success(`已领取 ${candidates.length} 个${category}任务，完成后记得提交审核`)
    await load()
    tab.value = category
  } catch (e) {
    ElMessage.error(e.message || '领取失败，请重试')
  } finally {
    claiming.value = false
  }
}

const editor = reactive({
  visible: false,
  item: null,
  readings: [], // [{ pinyin, groups: [{label,color,strokes}], explanation }]，第0个为主读音
  activeReading: 0,
  activeGroup: -1,
  image: null,
})
const currentReading = computed(() => editor.readings[editor.activeReading] || { pinyin: '', groups: [], explanation: '' })

/** 字母/单词无笔画数据，隐藏分组功能 */
const isWordItem = computed(() => ['字母', '单词'].includes(editor.item?.item_type))

/** 当前编辑的字所包含的偏旁中，已有「审核通过」讲解的版本（按字形包含关系识别） */
const radicalHints = computed(() => {
  const it = editor.item
  if (!it || ['字母', '单词'].includes(it.item_type)) return []
  return items.value
    .filter((i) =>
      i.item_type === '偏旁' &&
      i.id !== it.id &&
      it.content.includes(i.content) &&
      i.courseware?.review_status === '已通过' &&
      i.courseware?.explanation,
    )
    .map((i) => ({ content: i.content, pinyin: i.pinyin, explanation: i.courseware.explanation }))
})

function itemsByTab(t) {
  return items.value.filter((i) => i.item_type === t)
}

/** 当前页签的展示分组：偏旁按 M1-M6 模块分组（含「其他」），其余页签为单组 */
const displayGroups = computed(() => {
  const list = itemsByTab(tab.value)
  if (tab.value !== '偏旁') return [{ key: 'all', label: '', items: list }]
  const groups = MODULES.map((m) => ({
    key: m.key, label: m.label, items: list.filter((i) => i.module === m.key),
  })).filter((g) => g.items.length > 0)
  const others = list.filter((i) => !i.module)
  if (others.length) groups.push({ key: 'other', label: '其他（待分类）', items: others })
  return groups
})

/* ---------- 状态徽标 ---------- */
function reviewText(s) {
  return s === '已通过' ? '已通过' : s === '待审核' ? '待审核' : '草稿'
}
function badgeText(it) {
  if (!it.courseware) return '未配置'
  return reviewText(it.courseware.review_status)
}
function badgeType(it) {
  if (!it.courseware) return 'info'
  const s = it.courseware.review_status
  return s === '已通过' ? 'success' : s === '待审核' ? 'warning' : 'info'
}
function cellClass(it) {
  const cls = {}
  if (lockOf(it)) cls.locked = true
  if (myClaimOf(it)) cls.mine = true
  if (!it.courseware) return cls
  cls.configured = it.courseware.review_status === '已通过'
  cls.pending = it.courseware.review_status === '待审核'
  return cls
}

async function load() {
  loading.value = true
  try {
    const [its, cls] = await Promise.all([
      fetchLiteracyItems([0, 1, 10, 11]),
      fetchTaskClaims().catch(() => []),
    ])
    items.value = its
    claims.value = cls
  } finally {
    loading.value = false
  }
}

/* ---------- 编辑器 ---------- */
function openEditor(it) {
  const lock = lockOf(it)
  if (lock && role.value === '素材员') {
    ElMessage.warning(`「${it.content}」已被 ${lock.user_name} 领取，请先完成自己的任务`)
    return
  }
  const cw = it.courseware
  editor.item = it
  editor.readings = [
    {
      pinyin: it.pinyin || '',
      groups: (cw?.stroke_groups || []).map((g) => ({ label: g.label || '', color: g.color || COLORS[0], strokes: [...(g.strokes || [])] })),
      explanation: cw?.explanation || '',
    },
    ...(cw?.variants || []).map((v) => ({
      pinyin: v.pinyin || '',
      groups: (v.stroke_groups || []).map((g) => ({ label: g.label || '', color: g.color || COLORS[0], strokes: [...(g.strokes || [])] })),
      explanation: v.explanation || '',
    })),
  ]
  editor.activeReading = 0
  editor.activeGroup = editor.readings[0].groups.length ? 0 : -1
  editor.image = cw?.image || null
  editor.visible = true
}

function addVariant() {
  editor.readings.push({ pinyin: '', groups: [], explanation: '' })
  editor.activeReading = editor.readings.length - 1
  editor.activeGroup = -1
}

function removeReading(ri) {
  editor.readings.splice(ri, 1)
  editor.activeReading = 0
  editor.activeGroup = editor.readings[0].groups.length ? 0 : -1
}

function addGroup() {
  const r = currentReading.value
  const used = new Set(r.groups.map((g) => g.color))
  const color = COLORS.find((c) => !used.has(c)) || COLORS[r.groups.length % COLORS.length]
  r.groups.push({ label: '', color, strokes: [] })
  editor.activeGroup = r.groups.length - 1
}

function removeGroup(gi) {
  const r = currentReading.value
  r.groups.splice(gi, 1)
  if (editor.activeGroup === gi) editor.activeGroup = r.groups.length ? 0 : -1
  else if (editor.activeGroup > gi) editor.activeGroup -= 1
}

function cycleColor(g) {
  const i = COLORS.indexOf(g.color)
  g.color = COLORS[(i + 1) % COLORS.length]
}

function toggleStroke(idx) {
  const r = currentReading.value
  const g = r.groups[editor.activeGroup]
  if (!g) return
  // 若笔画已在其他组，先从其他组移除（一笔只属一组，按当前读音独立计算）
  for (const other of r.groups) {
    const at = other.strokes.indexOf(idx)
    if (at >= 0) other.strokes.splice(at, 1)
  }
  if (!g.strokes.includes(idx)) g.strokes.push(idx)
  g.strokes.sort((a, b) => a - b)
}

/* ---------- 配图上传（压缩为 800px JPEG base64） ---------- */
function handleImageUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请选择图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.onload = () => {
      const max = 800
      const scale = Math.min(1, max / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      editor.image = canvas.toDataURL('image/jpeg', 0.8)
    }
    img.onerror = () => ElMessage.error('图片读取失败')
    img.src = reader.result
  }
  reader.readAsDataURL(file)
}

/* ---------- 保存与审核 ---------- */
function buildPayload(reviewStatus) {
  const main = editor.readings[0]
  const variants = editor.readings.slice(1).map((r) => ({
    pinyin: r.pinyin.trim(),
    stroke_groups: r.groups.filter((g) => g.strokes.length > 0),
    explanation: r.explanation || null,
  }))
  return {
    explanation: main.explanation || null,
    stroke_groups: main.groups.filter((g) => g.strokes.length > 0),
    variants: variants.length ? variants : null,
    image: editor.image || null,
    review_status: reviewStatus,
    status: '启用',
    edited_by: auth.profile?.name || null,
    reviewed_by: null, // 重新编辑后前次审核作废，需重新审核
  }
}

async function handleSave(reviewStatus) {
  for (const [ri, r] of editor.readings.entries()) {
    if (r.groups.some((g) => g.strokes.length > 0 && !g.label.trim())) {
      ElMessage.warning(`${ri === 0 ? '主读音' : '多音字'}有分组还没有填写注释`)
      return
    }
    if (ri > 0 && !r.pinyin.trim()) {
      ElMessage.warning('多音字还没有填写拼音')
      return
    }
  }
  saving.value = true
  try {
    await saveCourseware(editor.item.id, buildPayload(reviewStatus))
    ElMessage.success(reviewStatus === '待审核' ? '已提交审核' : '草稿已保存')
    editor.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleRelease() {
  const c = claimsMap.value[editor.item?.id]
  if (!c) return
  try {
    await releaseTaskClaim(c.id)
    ElMessage.success(`已释放「${editor.item.content}」的领取锁定`)
    await load()
  } catch (e) {
    ElMessage.error(e.message || '释放失败')
  }
}

async function handleReview(reviewStatus) {
  saving.value = true
  try {
    await reviewCourseware(editor.item.id, reviewStatus, auth.profile?.name)
    ElMessage.success(reviewStatus === '已通过' ? '已通过审核' : '已退回为草稿')
    editor.visible = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  const q = route.query.tab
  if (q && TABS.some((t) => t.key === q)) tab.value = q
  load()
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 10px; min-height: 200px; }
.char-cell { border: 1px solid var(--bw-border); border-radius: 8px; padding: 10px 6px; text-align: center; cursor: pointer; position: relative; transition: all .15s; background: #fff; }
.char-cell:hover { border-color: var(--el-color-primary); box-shadow: 0 2px 8px rgba(79, 70, 229, 0.12); }
.char-cell.configured { border-color: var(--el-color-success-light-5); background: var(--el-color-success-light-9); }
.char-cell.pending { border-color: var(--el-color-warning-light-5); background: var(--el-color-warning-light-9); }
.char-text { font-size: 30px; font-family: 'Kaiti SC', 'KaiTi', serif; line-height: 1.3; }
.char-pinyin { font-size: 12px; color: var(--bw-muted); margin: 2px 0 4px; }
.badge { transform: scale(0.85); }
.char-crew { margin-top: 2px; font-size: 11px; color: var(--bw-muted); line-height: 1.4; display: flex; flex-direction: column; }
.task-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px; background: var(--bw-bg); border-radius: 8px; flex-wrap: wrap; }
.task-label { font-size: 13px; font-weight: 600; }
.task-stats { margin-left: auto; font-size: 12px; color: var(--bw-muted); }
.char-cell.locked { opacity: 0.72; background: repeating-linear-gradient(135deg, #fafafa, #fafafa 6px, #f0f0f0 6px, #f0f0f0 12px); cursor: not-allowed; }
.char-cell.mine { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.char-lock { margin-top: 2px; font-size: 11px; color: var(--el-color-danger); line-height: 1.4; }
.char-mine { margin-top: 2px; font-size: 11px; color: var(--el-color-primary); font-weight: 600; line-height: 1.4; }
.editor-wrap { display: flex; flex-direction: column; gap: 14px; }
.reading-tabs { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.reading-tab { padding: 5px 12px; border: 1px solid var(--bw-border); border-radius: 6px; cursor: pointer; font-size: 13px; background: #fff; }
.reading-tab.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
.tab-close { margin-left: 6px; color: var(--bw-muted); }
.tab-close:hover { color: var(--el-color-danger); }
.variant-pinyin-input { width: 160px; }
.editor-body { display: flex; gap: 24px; }
.editor-left { flex: 0 0 340px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.center-tip { text-align: center; }
.char-meta { margin-top: 8px; text-align: center; line-height: 1.8; }
.editor-right { flex: 1; min-width: 0; }
.section-title { font-weight: 600; margin: 6px 0 10px; display: flex; justify-content: space-between; align-items: center; }
.section-sub { font-weight: 600; font-size: 13px; margin-bottom: 6px; }
.empty-groups { padding: 8px 0 16px; line-height: 1.8; }
.group-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--bw-border); border-radius: 6px; margin-bottom: 8px; cursor: pointer; }
.group-row.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.color-dot { width: 18px; height: 18px; border-radius: 50%; flex: none; cursor: pointer; border: 1px solid rgba(0,0,0,0.1); }
.label-input { flex: 1; }
.stroke-count { font-size: 12px; color: var(--bw-muted); flex: none; }
.muted { color: var(--bw-muted); font-size: 12px; line-height: 1.6; }
.preview-tip { margin-top: 12px; }
.image-box { width: 100%; margin-top: 10px; border-top: 1px dashed var(--bw-border); padding-top: 10px; }
.image-preview { display: flex; align-items: center; gap: 10px; }
.image-preview img { max-width: 200px; max-height: 140px; border-radius: 6px; border: 1px solid var(--bw-border); }
.upload-btn { display: inline-block; padding: 6px 14px; border: 1px dashed var(--el-color-primary); color: var(--el-color-primary); border-radius: 6px; cursor: pointer; font-size: 13px; }
.upload-btn:hover { background: var(--el-color-primary-light-9); }
.footer-status { float: left; line-height: 32px; }
.radical-hints { margin: 10px 0 4px; padding: 10px 12px; background: var(--el-color-success-light-9); border: 1px solid var(--el-color-success-light-5); border-radius: 8px; }
.hint-title { font-size: 13px; font-weight: 600; color: var(--el-color-success-dark-2); margin-bottom: 6px; }
.hint-item { font-size: 13px; line-height: 1.7; display: flex; gap: 6px; }
.hint-item b { white-space: nowrap; }
.hint-text { color: var(--bw-ink); }
.module-section { margin-bottom: 18px; }
.module-title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid var(--el-color-primary-light-7); }
.module-name { font-weight: 600; font-size: 15px; }
</style>
