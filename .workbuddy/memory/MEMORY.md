# 博闻幼儿园项目长期记忆

## 项目定位
幼儿园识字教育服务平台（多园所 SaaS），后端基于 Zion（项目 exId: RZJyj4e9Oq1），前后端同步开发。

## ⚠️ Zion MCP 代理失效的 CLI 绕行方案（2026-08-27 验证有效）
会话内 zion MCP 报 ECONNREFUSED 时，用 CLI 直连：`npx -y zion-mcp@2.6.1 --no-daemon schema tool-call --args '{"projectExId":"RZJyj4e9Oq1"}' --toolCalls '<json>'`（schema 编辑）；`npx -y zion-mcp@latest --no-daemon runtime graphql --args '<json>'`（数据读写）。版本不可混用（2.7.0 tool-call 有 l3_1 bug，2.6.1 runtime 有兼容问题）。部署：`zion-mcp@2.6.1 --no-daemon project sync-backend --args '{"projectExId":"..."}'`。详细参数规范见 2026-08-27.md。

## 积压任务状态（2026-08-27 01:35）
任务1-4 全完成：4 新表已部署（course_package/course_package_item/literacy_item/literacy_composition）；字库 301+377 已入库；3 套演示组合（id 2/3/4）；批量嵌套排课语法已用真实 JWT 实测通过。**任务5 行级权限：用户明确暂缓（2026-08-27 01:42），上线前再做**（方案见 2026-08-27.md）。

## 系统结构（2026-08-25 需求基线）
- 两端：平台管理端（运营方：开通园所账号、全量数据看板）+ 园所客户端（如博闻幼儿园）
- 园所内角色：园所管理员（添加员工账号、录入孩子、班级/分组管理、排课、看全部数据）；老师/员工（看课表、看授课内容与大纲、填课后记录、每月考核评定）
- 三套课程板块：识字、脑力训练、英语（具体内容用户后续补充，先搭骨架）
- 核心业务流：录入孩子 → 班级/分组 → 排课（选组+老师+课程+主题）→ 老师授课 → 课后记录 → 月度考核 → 园所管理员与平台双端可见

## 默认设计假设（已告知用户，可纠正）
1. 排课由园所管理员操作，老师只读课表并执行
2. 孩子档案字段：姓名/性别/出生日期/班级/家长姓名/家长电话/备注
3. 排课单：日期时间/时长/课程板块/主题/分组/老师/状态
4. 课后记录：出勤勾选+课堂整体情况（可选每生表现）
5. 月度考核：按孩子×课程板块，评分+评语
6. 登录：手机号+密码，园所管理员账号由平台开通，员工由园所管理员添加

## 已拍板决策（2026-08-25）
- 课程库：平台统一维护（所有园所共用标准课程库，园所排课时直接选用课节）
- 分组：按课程多组并存（一个孩子可同时属于识字A组、英语B组等）
- 客户端载体：响应式 Web（电脑+手机浏览器）
- 家长端：本期不做，后续迭代
- 推荐课程组合（2026-08-26）：平台管理员设置组合模板（课节+周几+建议时间+时长），园所排课时选组合→映射分组/老师→预览调整→批量生成一周排课。表：course_package + course_package_item（package_id FK cascade, lesson_id FK, day_of_week 1-7, start_time, duration_minutes）；⚠️ 表未建（MCP 断连阻塞），前端已就绪

## 识字字库 v1（2026-08-26 完成，未入库）
- 位置：curriculum/（生成脚本 gen_literacy_bank.py 可扩展；literacy-bank.json 数据；识字字库-v1.md 审阅文档）
- 结构：L0字根40（象形独体字）→ L1汉字115（会意+虚词+高频）→ L2词语96 → L3短句50，377条组成关系；每条带拼音/拆分/教学提示/sortOrder
- 教学法依据：部件识字法 + 四五快读（16字组词、32字组句、虚词前置）
- ⚠️ 待入库：literacy_item + literacy_composition 两表（Zion MCP 断连阻塞，重连后按 MD 第九节执行）
12 表：幼儿园(kindergarten)、用户(user)、班级(class)、孩子(child)、分组(study_group)、分组成员(group_member)、课程(course)、课节(lesson)、排课(schedule)、排课学员(schedule_student)、课后记录(lesson_record)、月度考核(assessment)
- 用户.role：平台管理员/园所管理员/老师，手机号唯一（登录账号）
- 课程/课节为平台级课程库（无园所外键）；排课含 kindergarten_id/study_group_id/lesson_id/teacher_id
- 状态字段（string）：幼儿园(启用/停用)、用户(在职/停用)、孩子(在读/离园)、排课(待上课/已完成/已取消)、排课学员.出勤(出勤/缺勤/请假)
- 课后记录与排课 1:1；月度考核 = 孩子×课程×月份 唯一，评分为等级制 string（优秀/良好/合格/需加强）

## 鉴权架构（2026-08-26 定案）
- Zion 原生帐户体系 + 用户名密码登录（用户名=手机号纯数字）；「用户」表只存业务角色（平台管理员/园所管理员/老师），帐户 1:1→用户（user.account_id 唯一），密码哈希存 Zion 内部凭证表（MCP 无法创建账号凭证，只能编辑器导入或前端注册事件）
- 员工账号流程：管理员预建用户资料 → 员工自助注册（用户名=手机号）→ ActionFlow「获取我的用户资料」自动匹配 phone=用户名 并绑定 account_id；无资料者停"待开通"
- 关键 ActionFlow：获取我的用户资料（03ad5860-fc4c-4b08-b722-2b9f0cb477b4），前端登录成功后调用，返回 status/userId/name/role/phone/kindergartenId/kindergartenName 用于角色分流
- 种子数据：幼儿园#1 **博闻幼儿园**（2026-08-28 改名）；用户#1 周刘俊腾 18588258585 平台管理员（2026-08-28 重置，**密码 123321**，account_id=1000000000000011；历史密码全部失效；测试员工账号已全部清除，园所员工待录真实人员）；课程 识字/脑力训练/英语（识字/英语已重构为各 10 课节）
- 待办（编辑器手动）：开启「用户名密码登录」登录方式；前端开发时登录页要含注册入口

## 前端进度（2026-08-26 01:07）
- 设计系统已建：9色调色板（Primary #4F46E5 靛蓝 / Background #F6F7FB / Accent #FFA522 / Surface白 / Ink / Muted / Border / Danger / Success）+ 7级间距 + 6级字阶
- 页面骨架 4 张：登录页(首页)、平台管理端首页、园所端首页、待开通页
- 登录页已完成（UI+完整事件链）：登录按钮 → 用户名密码登录 → 成功调「获取我的用户资料」→ 按角色分流（平台管理员→平台管理端首页；园所管理员/老师→园所端首页；无资料/停用→待开通页）；失败Toast；注册按钮=createAccountOnLogin，成功Toast提示再点登录
- 三个目标页面（平台管理端/园所端/待开通页）为空白骨架，待填充内容
- 员工首次登录流程已闭环：预建资料→自助注册→Toast→点登录→自动绑定→按角色进系统

## 架构定案（2026-08-26 01:25，重要！）
- **混合架构：Zion 当后端（BaaS/Headless），前端自研、自己服务器发布**
- Zion 画布前端弃用（仅原型参考）；后端资产全保留：12表数据模型、行为流、种子数据、权限配置
- GraphQL 端点：https://zion-app.functorz.com/zero/RZJyj4e9Oq1/api/graphql-v2
- 登录 mutation：authenticateWithUsername(username, password, register)→jwt.token；行为流：fz_invoke_action_flow_default_by_latest_version(actionFlowId, args)
- 全链路已实测通过；管理员账号：18588258585 / 123321（2026-08-28 10:05 起，account_id=1000000000000011）
- 修改密码：走验证码通道 sendVerificationCodeToPhone(RESET_PASSWORD) + resetPasswordWithPhoneNumberVerificationCode；直接 update account 密码字段无效；createPredefinedAccount 与 authenticateWithUsername 是两套凭证体系，勿混用
- 前端代码放 /Users/zhouliujunteng/WorkBuddy/博文幼儿园/frontend/
- ⚠️ 待办：Logged-in User 表权限当前全开（无行条件），前端上线前必须配园所数据隔离（kindergarten_id 比对）
- ⚠️ Admin Token 只能用于可信服务端，绝不进前端代码

## 前端项目（2026-08-26 01:30）
- 位置：/Users/zhouliujunteng/WorkBuddy/博文幼儿园/frontend/，技术栈 Vue3+Vite+Pinia+VueRouter+ElementPlus
- dev: npm run dev (5173)；build: npm run build（dist/，自己服务器 nginx 托管）
- 结构：src/api/graphql.js（fetch封装+JWT）、src/api/auth.js（登录/注册/资料）、src/stores/auth.js、src/router（守卫+角色分流）、src/views（Login/PlatformHome/KindergartenHome/Pending）
- 登录流程：authenticateWithUsername → fetchMyProfile 行为流 → 按role/status路由分流（与原Zion画布逻辑一致）
- 已实现：登录页完整功能（含注册、错误提示、回车提交、redirect）；三个首页为骨架待开发
