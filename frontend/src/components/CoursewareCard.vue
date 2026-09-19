<template>
  <div class="courseware-card" ref="rootRef">
    <!-- 多音字读音页签 -->
    <div v-if="readings.length > 1" class="cw-readings">
      <span
        v-for="(r, ri) in readings"
        :key="ri"
        class="cw-reading-tab"
        :class="{ active: activeReading === ri }"
        @click="switchReading(ri)"
      >{{ r.pinyin || '未注音' }}</span>
    </div>
    <div class="cw-main">
      <div class="cw-char">
        <CharStrokes
          ref="strokesRef"
          :char="item.content"
          :groups="groups"
          :size="280"
          :reveal-count="revealCount"
          default-color="#333333"
        />
        <div class="cw-actions">
          <el-button size="small" @click="playStrokes" :disabled="playing">
            {{ playing ? '演示中…' : '笔顺演示' }}
          </el-button>
          <el-button size="small" @click="revealCount = -1" :disabled="revealCount === -1">显示全字</el-button>
        </div>
        <div v-if="item.courseware?.image" class="cw-image">
          <img :src="item.courseware.image" alt="配图" />
        </div>
      </div>
      <div class="cw-info">
        <div class="cw-title">
          <span class="cw-char-text">{{ item.content }}</span>
          <span class="cw-pinyin">{{ currentPinyin }}</span>
        </div>
        <div class="cw-meaning">{{ item.meaning }}</div>

        <div v-if="groups.length" class="cw-groups">
          <div class="cw-section">字形拆解</div>
          <div v-for="(g, gi) in groups" :key="gi" class="cw-group-row">
            <span class="cw-dot" :style="{ background: g.color }"></span>
            <span>{{ g.label }}</span>
            <span class="cw-count">{{ g.strokes.length }}笔</span>
          </div>
        </div>

        <div v-if="currentExplanation" class="cw-explain">
          <div class="cw-section">专属讲解</div>
          <div class="cw-explain-text">{{ currentExplanation }}</div>
        </div>
        <div v-else class="muted" style="margin-top: 10px">平台尚未配置专属讲解</div>
      </div>
    </div>
    <div class="cw-footer">
      <el-button type="primary" plain :loading="downloading" @click="downloadImage">下载为图片</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import CharStrokes from './CharStrokes.vue'

const props = defineProps({
  item: { type: Object, required: true }, // literacy_item（含 courseware）
})

const rootRef = ref(null)
const strokesRef = ref(null)
const revealCount = ref(-1)
const playing = ref(false)
const downloading = ref(false)
const activeReading = ref(0)

/** 读音列表：主读音 + 多音字变体 */
const readings = computed(() => {
  const cw = props.item.courseware
  const main = { pinyin: props.item.pinyin, stroke_groups: cw?.stroke_groups || [], explanation: cw?.explanation || '' }
  const variants = (cw?.variants || []).map((v) => ({
    pinyin: v.pinyin,
    stroke_groups: v.stroke_groups || [],
    explanation: v.explanation || '',
  }))
  return [main, ...variants]
})
const currentReading = computed(() => readings.value[activeReading.value] || readings.value[0])
const groups = computed(() => currentReading.value.stroke_groups)
const currentPinyin = computed(() => currentReading.value.pinyin || props.item.pinyin)
const currentExplanation = computed(() => currentReading.value.explanation)

function switchReading(ri) {
  activeReading.value = ri
  revealCount.value = -1
}

function playStrokes() {
  if (playing.value) return
  playing.value = true
  revealCount.value = 0
  const total = 30 // 上限，超出笔画数自然停
  let n = 0
  const timer = setInterval(() => {
    n += 1
    revealCount.value = n
    if (n >= total || n >= strokeTotal()) {
      clearInterval(timer)
      playing.value = false
    }
  }, 600)
}

function strokeTotal() {
  return strokesRef.value?.$el?.querySelectorAll('path')?.length || 30
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** SVG 序列化 → canvas 合成 → PNG 下载 */
async function downloadImage() {
  downloading.value = true
  try {
    const svgEl = rootRef.value.querySelector('svg.char-svg')
    if (!svgEl) throw new Error('字形尚未加载完成')
    const W = 800
    const charSize = 480
    const pad = 40
    const lineH = 44
    const explainLines = wrapText(currentExplanation.value || '', 24)
    const hasPhoto = !!props.item.courseware?.image
    const photoH = hasPhoto ? 300 : 0
    const H = pad + 90 + charSize + (hasPhoto ? photoH + 20 : 0) + (groups.value.length ? 30 + groups.value.length * lineH : 0) + (explainLines.length ? 40 + explainLines.length * 36 : 0) + pad

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // 标题
    let y = pad + 60
    ctx.fillStyle = '#333'
    ctx.font = 'bold 44px "Kaiti SC", KaiTi, serif'
    ctx.fillText(props.item.content, pad, y)
    ctx.font = '26px sans-serif'
    ctx.fillStyle = '#888'
    ctx.fillText(currentPinyin.value || '', pad + 80, y)
    y += 30

    // 字图
    const svgStr = new XMLSerializer().serializeToString(svgEl)
    const img = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr))
    ctx.drawImage(img, (W - charSize) / 2, y, charSize, charSize)
    y += charSize + 20

    // 配图
    if (hasPhoto) {
      const photo = await loadImg(props.item.courseware.image)
      const scale = Math.min(1, (W - pad * 2) / photo.width, photoH / photo.height)
      const pw = photo.width * scale
      const ph = photo.height * scale
      ctx.drawImage(photo, (W - pw) / 2, y, pw, ph)
      y += ph + 20
    }

    // 分组注释
    if (groups.value.length) {
      ctx.font = 'bold 26px sans-serif'
      ctx.fillStyle = '#333'
      ctx.fillText('字形拆解', pad, y)
      y += 14
      for (const g of groups.value) {
        y += lineH - 8
        ctx.fillStyle = g.color
        ctx.beginPath()
        ctx.arc(pad + 12, y - 9, 10, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#333'
        ctx.font = '28px sans-serif'
        ctx.fillText(g.label, pad + 34, y)
      }
      y += 16
    }

    // 专属讲解
    if (explainLines.length) {
      y += 16
      ctx.font = 'bold 26px sans-serif'
      ctx.fillStyle = '#333'
      ctx.fillText('专属讲解', pad, y)
      y += 14
      ctx.font = '24px sans-serif'
      ctx.fillStyle = '#555'
      for (const line of explainLines) {
        y += 36
        ctx.fillText(line, pad, y)
      }
    }

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `${props.item.content}-课件.png`
    a.click()
    ElMessage.success('已下载')
  } catch (e) {
    ElMessage.error(e.message || '下载失败')
  } finally {
    downloading.value = false
  }
}

function wrapText(text, perLine) {
  if (!text) return []
  const lines = []
  for (const raw of text.split('\n')) {
    let s = raw
    while (s.length > perLine) {
      lines.push(s.slice(0, perLine))
      s = s.slice(perLine)
    }
    if (s) lines.push(s)
  }
  return lines
}
</script>

<style scoped>
.courseware-card { background: #fff; border: 1px solid var(--bw-border); border-radius: 10px; padding: 20px; }
.cw-readings { display: flex; gap: 8px; margin-bottom: 14px; }
.cw-reading-tab { padding: 5px 14px; border: 1px solid var(--bw-border); border-radius: 6px; cursor: pointer; font-size: 14px; }
.cw-reading-tab.active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
.cw-image { margin-top: 6px; }
.cw-image img { max-width: 280px; max-height: 180px; border-radius: 8px; border: 1px solid var(--bw-border); }
.cw-main { display: flex; gap: 24px; }
.cw-char { flex: 0 0 300px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.cw-actions { display: flex; gap: 8px; }
.cw-info { flex: 1; min-width: 0; }
.cw-title { display: flex; align-items: baseline; gap: 10px; }
.cw-char-text { font-size: 34px; font-family: 'Kaiti SC', 'KaiTi', serif; font-weight: 600; }
.cw-pinyin { color: var(--bw-muted); font-size: 16px; }
.cw-meaning { color: var(--bw-muted); margin: 6px 0 4px; }
.cw-section { font-weight: 600; margin: 14px 0 8px; }
.cw-group-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.cw-dot { width: 14px; height: 14px; border-radius: 50%; flex: none; }
.cw-count { color: var(--bw-muted); font-size: 12px; }
.cw-explain-text { white-space: pre-wrap; line-height: 1.9; color: #444; background: var(--bw-bg); border-radius: 8px; padding: 12px; }
.cw-footer { margin-top: 16px; display: flex; justify-content: flex-end; }
.muted { color: var(--bw-muted); font-size: 12px; }
</style>
