import { gql, setToken, clearToken, getToken, ACTION_FLOW_IDS } from './graphql'

/** 用户名密码登录/注册（register=true 时注册并登录） */
export async function authenticateWithUsername(username, password, register) {
  const data = await gql(
    `mutation Authenticate($username: String!, $password: String!, $register: Boolean!) {
      authenticateWithUsername(username: $username, password: $password, register: $register) {
        account { id permissionRoles }
        jwt { token }
      }
    }`,
    { username, password, register },
    { token: null },
  )
  const result = data?.authenticateWithUsername
  if (!result?.jwt?.token) throw new Error('登录失败：未返回凭证')
  setToken(result.jwt.token)
  return result
}

/** 登录后获取用户资料（角色/园所），未绑定资料时后端自动按手机号匹配绑定 */
export async function fetchMyProfile() {
  const data = await gql(
    `mutation Invoke($actionFlowId: String!, $args: Json!) {
      fz_invoke_action_flow_default_by_latest_version(actionFlowId: $actionFlowId, args: $args)
    }`,
    { actionFlowId: ACTION_FLOW_IDS.getMyProfile, args: {} },
  )
  return data?.fz_invoke_action_flow_default_by_latest_version || null
}

export function logout() {
  clearToken()
}

export { getToken }

/** 管理员代注册账号（创建 Zion 账户，返回 account；不覆盖当前登录态） */
export async function registerAccount(username, password) {
  const data = await gql(
    `mutation Register($username: String!, $password: String!) {
      authenticateWithUsername(username: $username, password: $password, register: true) {
        account { id username }
      }
    }`,
    { username, password },
    { token: null },
  )
  const account = data?.authenticateWithUsername?.account
  if (!account?.id) throw new Error('账号创建失败')
  return account
}

/** 发送重置密码短信验证码（验证码场景：重置密码） */
export function sendResetPasswordCode(phone) {
  return gql(
    `mutation SendCode($telephone: String!) {
      sendVerificationCodeToPhone(telephone: $telephone, verificationEnumType: RESET_PASSWORD)
    }`,
    { telephone: phone },
    { token: null },
  ).then((d) => d?.sendVerificationCodeToPhone === true)
}

/** 用短信验证码重置密码（需账号已绑定该手机号，即用户名=手机号注册的账号） */
export function resetPasswordByCode(phone, code, newPassword) {
  return gql(
    `mutation ResetPwd($phoneNumber: String!, $code: String!, $newPassword: String!) {
      resetPasswordWithPhoneNumberVerificationCode(code: $code, phoneNumber: $phoneNumber, newPassword: $newPassword) {
        id username
      }
    }`,
    { phoneNumber: phone, code, newPassword },
    { token: null },
  ).then((d) => d?.resetPasswordWithPhoneNumberVerificationCode)
}
