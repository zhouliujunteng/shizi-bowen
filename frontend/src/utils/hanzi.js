// 汉字笔画数据加载（模块级缓存）
const cache = {}

export async function loadHanziChar(char) {
  if (!char) return { strokes: [], medians: [] }
  if (!cache[char]) {
    cache[char] = fetch(`/hanzi-data/${encodeURIComponent(char)}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`笔画数据不存在: ${char}`)
        return r.json()
      })
      .then((d) => ({ strokes: d.strokes || [], medians: d.medians || [] }))
      .catch((e) => {
        delete cache[char]
        throw e
      })
  }
  return cache[char]
}
