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

  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

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
