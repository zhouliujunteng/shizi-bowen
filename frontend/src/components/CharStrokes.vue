<template>
  <div class="char-strokes" :style="{ width: size + 'px', height: size + 'px' }">
    <svg v-if="strokes.length" viewBox="0 0 1024 1024" :width="size" :height="size" class="char-svg">
      <g transform="scale(1, -1) translate(0, -900)">
        <path
          v-for="(d, i) in strokes"
          :key="i"
          :d="d"
          :fill="strokeFill(i)"
          :class="{ clickable: editable, dimmed: editable && !isInActiveGroup(i) && hasActive, hiddenStroke: i >= reveal }"
          @click="editable && $emit('toggle-stroke', i)"
        />
      </g>
    </svg>
    <div v-else-if="loading" class="state-tip">字形加载中…</div>
    <div v-else class="fallback" :style="fallbackStyle">{{ char }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { loadHanziChar } from '../utils/hanzi'

const props = defineProps({
  char: { type: String, required: true },
  // [{ label, color, strokes: [strokeIndex] }]
  groups: { type: Array, default: () => [] },
  size: { type: Number, default: 200 },
  editable: { type: Boolean, default: false },
  activeGroupIndex: { type: Number, default: -1 },
  // 笔顺演示：只显示前 N 笔（-1 = 全部显示）
  revealCount: { type: Number, default: -1 },
  // 未分组笔画颜色（查看模式）
  defaultColor: { type: String, default: '#333333' },
})
defineEmits(['toggle-stroke'])

const strokes = ref([])
const loading = ref(false)

const hasActive = computed(() => props.activeGroupIndex >= 0)
const reveal = computed(() => (props.revealCount < 0 ? Number.MAX_SAFE_INTEGER : props.revealCount))

/** 无笔画数据时的兜底文字样式：按内容长度自适应字号，长单词缩放到盒内 */
const fallbackStyle = computed(() => {
  const len = (props.char || '').length || 1
  // 单字 70% 盒宽；多字符按平均字宽 0.62em 估算，缩放到盒内（留 16px 内边距）
  const fontSize = len <= 1 ? props.size * 0.7 : Math.min(props.size * 0.7, (props.size - 16) / (len * 0.62))
  return {
    fontSize: Math.max(fontSize, 16) + 'px',
    padding: '8px',
    lineHeight: '1.2',
    textAlign: 'center',
    wordBreak: 'break-all',
    maxWidth: props.size + 'px',
  }
})

function groupOf(i) {
  return props.groups.find((g) => (g.strokes || []).includes(i))
}
function strokeFill(i) {
  const g = groupOf(i)
  return g ? g.color : props.defaultColor
}
function isInActiveGroup(i) {
  if (props.activeGroupIndex < 0) return true
  return (props.groups[props.activeGroupIndex]?.strokes || []).includes(i)
}

async function load() {
  strokes.value = []
  if (!props.char) return
  loading.value = true
  try {
    const data = await loadHanziChar(props.char)
    strokes.value = data.strokes
  } catch {
    strokes.value = [] // fallback 显示楷体大字
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.char, load)
</script>

<style scoped>
.char-strokes { display: inline-flex; align-items: center; justify-content: center; background: #fff; border-radius: 8px; overflow: hidden; }
.char-svg { display: block; }
.clickable { cursor: pointer; transition: opacity 0.15s; }
.clickable:hover { opacity: 0.75; }
.dimmed { opacity: 0.25; }
.hiddenStroke { visibility: hidden; }
.state-tip { color: var(--bw-muted); font-size: 13px; }
.fallback { font-family: 'Kaiti SC', 'KaiTi', serif; color: #333; }
</style>
