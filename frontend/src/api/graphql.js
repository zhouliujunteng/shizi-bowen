const ZION_PROJECT_ID = 'RZJyj4e9Oq1'

export const GRAPHQL_ENDPOINT = `https://zion-app.functorz.com/zero/${ZION_PROJECT_ID}/api/graphql-v2`

export const ACTION_FLOW_IDS = {
  getMyProfile: '03ad5860-fc4c-4b08-b722-2b9f0cb477b4',
}

const TOKEN_KEY = 'bw_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Zion Runtime GraphQL 请求封装
 * @param {string} query GraphQL document
 * @param {object} variables 变量
 * @param {object} options { token?: string|null } 默认自动携带本地 JWT
 * @returns {Promise<any>} data 部分；GraphQL 错误抛出 Error（带 extensions）
 */
export async function gql(query, variables = {}, options = {}) {
  const token = options.token !== undefined ? options.token : getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const body = JSON.stringify({ query, variables })
  // Zion 对 mutation 有约 1 次/秒的频率限制，连续调用（如登录后立刻拉资料）会返回 429，
  // 这里遇 429 自动退避重试，最多 5 次
  let res
  for (let attempt = 0; ; attempt++) {
    res = await fetch(GRAPHQL_ENDPOINT, { method: 'POST', headers, body })
    if (res.status !== 429 || attempt >= 5) break
    const retryAfter = Number(res.headers.get('Retry-After'))
    const delay = retryAfter > 0 ? retryAfter * 1000 : 800 + attempt * 600
    await new Promise((r) => setTimeout(r, delay))
  }

  if (res.status === 429) {
    throw new Error('请求过于频繁，请稍等几秒再试')
  }
  if (res.status === 403) {
    throw new Error('请求被拒绝（403），请重新登录')
  }
  if (!res.ok) {
    throw new Error(`网络错误：HTTP ${res.status}`)
  }

  const json = await res.json()
  if (json.errors && json.errors.length > 0) {
    const err = new Error(json.errors[0].message)
    err.extensions = json.errors[0].extensions || {}
    err.data = json.data
    throw err
  }
  return json.data
}
