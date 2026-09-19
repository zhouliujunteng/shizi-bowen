import { gql } from './graphql'
import { registerAccount } from './auth'

/* ============ 班级 ============ */
export function fetchClasses(kgId) {
  return gql(
    `query ($kg: bigint!) {
      class(where: { kindergarten_id: { _eq: $kg } }, order_by: { sort_order: asc }) {
        id class_name sort_order status
        children_aggregate { aggregate { count } }
      }
    }`,
    { kg: kgId },
  ).then((d) => d.class)
}

export function saveClass(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: class_set_input!) { update_class_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: class_insert_input!) { insert_class_one(object: $object) { id } }`,
    { object: payload },
  )
}

export function deleteClass(id) {
  return gql(`mutation ($id: bigint!) { delete_class_by_pk(id: $id) { id } }`, { id })
}

/* ============ 孩子 ============ */
export function fetchChildren(kgId, keyword = '') {
  const where = { kindergarten_id: { _eq: kgId } }
  if (keyword) where.name = { _ilike: `%${keyword}%` }
  return gql(
    `query ($where: child_bool_exp) {
      child(where: $where, order_by: { created_at: desc }) {
        id name gender birth_date parent_name parent_phone remark status
        class_id class { class_name }
      }
    }`,
    { where },
  ).then((d) => d.child)
}

export function saveChild(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: child_set_input!) { update_child_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: child_insert_input!) { insert_child_one(object: $object) { id } }`,
    { object: payload },
  )
}

export function deleteChild(id) {
  return gql(`mutation ($id: bigint!) { delete_child_by_pk(id: $id) { id } }`, { id })
}

/* ============ 分组 ============ */
export function fetchGroups(kgId) {
  return gql(
    `query ($kg: bigint!) {
      study_group(where: { kindergarten_id: { _eq: $kg } }, order_by: { id: asc }) {
        id group_name course_type remark status
        members { id child_id child { name } }
      }
    }`,
    { kg: kgId },
  ).then((d) => d.study_group)
}

export function saveGroup(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: study_group_set_input!) { update_study_group_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: study_group_insert_input!) { insert_study_group_one(object: $object) { id } }`,
    { object: payload },
  )
}

export function deleteGroup(id) {
  return gql(`mutation ($id: bigint!) { delete_study_group_by_pk(id: $id) { id } }`, { id })
}

/** 设置分组成员：全量替换（先删后插，同一事务） */
export function setGroupMembers(groupId, childIds) {
  const students = childIds.map((cid) => ({ study_group_id: groupId, child_id: cid }))
  return gql(
    `mutation SetMembers($groupId: bigint!, $students: [group_member_insert_input!]!) {
      delete_group_member(where: { study_group_id: { _eq: $groupId } }) { affected_rows }
      insert_group_member(objects: $students) { affected_rows }
    }`,
    { groupId, students },
  )
}

/* ============ 课程/课节（平台级，只读） ============ */
export function fetchCourses() {
  return gql(
    `query {
      course(where: { status: { _eq: "启用" } }, order_by: { sort_order: asc }) {
        id course_type course_name description
        lessons(where: { status: { _eq: "启用" } }, order_by: { sort_order: asc }) {
          id lesson_name topic outline sort_order
        }
      }
    }`,
  ).then((d) => d.course)
}

/* ============ 平台端：课程内容管理 ============ */
/** 课程 + 课节 + 课节绑定内容（平台管理用） */
export function fetchCoursesFull() {
  return gql(
    `query {
      course(order_by: { sort_order: asc }) {
        id course_type course_name description status
        lessons(order_by: { sort_order: asc }) {
          id lesson_name topic outline sort_order status
          items(order_by: { sort_order: asc }) {
            id sort_order teaching_note
            item { id content pinyin meaning item_type level }
          }
        }
      }
    }`,
  ).then((d) => d.course)
}

export function saveLesson(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: lesson_set_input!) { update_lesson_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: lesson_insert_input!) { insert_lesson_one(object: $object) { id } }`,
    { object: payload },
  )
}

/** 调整课节顺序（两条互换 sort_order，同事务） */
export function swapLessonOrder(idA, sortA, idB, sortB) {
  return gql(
    `mutation Swap($idA: bigint!, $sortA: bigint!, $idB: bigint!, $sortB: bigint!) {
      update_lesson_by_pk(pk_columns: {id: $idA}, _set: { sort_order: $sortB }) { id }
      update_lesson_by_pk(pk_columns: {id: $idB}, _set: { sort_order: $sortA }) { id }
    }`,
    { idA, sortA, idB, sortB },
  )
}

export function deleteLesson(id) {
  return gql(
    `mutation DeleteLesson($id: bigint!) {
      delete_lesson_item(where: { lesson_id: { _eq: $id } }) { affected_rows }
      delete_lesson_by_pk(id: $id) { id }
    }`,
    { id },
  )
}

/** 全量替换课节绑定内容（先删后插，同事务） */
export function saveLessonItems(lessonId, items) {
  const rows = items.map((it, i) => ({
    lesson_id: lessonId,
    item_id: it.item_id,
    sort_order: i + 1,
    teaching_note: it.teaching_note || null,
  }))
  return gql(
    `mutation SaveLessonItems($lid: bigint!, $rows: [lesson_item_insert_input!]!) {
      delete_lesson_item(where: { lesson_id: { _eq: $lid } }) { affected_rows }
      insert_lesson_item(objects: $rows) { affected_rows }
    }`,
    { lid: lessonId, rows },
  )
}

/* ============ 排课 ============ */
export function fetchSchedules(kgId, filters = {}) {
  const where = { kindergarten_id: { _eq: kgId } }
  if (filters.teacherId) where.teacher_id = { _eq: filters.teacherId }
  if (filters.status) where.status = { _eq: filters.status }
  return gql(
    `query ($where: schedule_bool_exp) {
      schedule(where: $where, order_by: { lesson_date: desc, start_time: asc }) {
        id lesson_date start_time duration_minutes note status
        lesson { id lesson_name topic outline sort_order course { id course_type course_name } }
        study_group { id group_name course_type }
        teacher { id name }
        students { id child_id child { name } attendance performance }
        lesson_record { overall_summary }
      }
    }`,
    { where },
  ).then((d) => d.schedule)
}

/** 创建排课 + 快照学员（嵌套插入，原子事务，schedule_id 自动回填） */
export function createSchedule(object, studentIds) {
  const objectWithStudents = { ...object, students: { data: studentIds.map((cid) => ({ child_id: cid })) } }
  return gql(
    `mutation CreateSchedule($object: schedule_insert_input!) {
      insert_schedule_one(object: $object) { id }
    }`,
    { object: objectWithStudents },
  )
}

export function updateSchedule(id, set) {
  return gql(
    `mutation ($id: bigint!, $set: schedule_set_input!) { update_schedule_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
    { id, set },
  )
}

/** 重新快照排课学员：清空旧名单后按新名单写入（同一 mutation 顺序执行） */
export function replaceScheduleStudents(scheduleId, childIds) {
  return gql(
    `mutation ($sid: bigint!, $objects: [schedule_student_insert_input!]!) {
      delete_schedule_student(where: { schedule_id: { _eq: $sid } }) { affected_rows }
      insert_schedule_student(objects: $objects) { affected_rows }
    }`,
    { sid: scheduleId, objects: childIds.map((cid) => ({ schedule_id: scheduleId, child_id: cid })) },
  )
}

export function deleteSchedule(id) {
  return gql(
    `mutation DeleteSchedule($id: bigint!) {
      delete_schedule_student(where: { schedule_id: { _eq: $id } }) { affected_rows }
      delete_lesson_record(where: { schedule_id: { _eq: $id } }) { affected_rows }
      delete_schedule_by_pk(id: $id) { id }
    }`,
    { id },
  )
}

/** 保存课后记录：整体情况 + 每个学员出勤/表现 + 排课状态（同事务，动态别名逐条更新学员） */
export function saveLessonRecord(scheduleId, summary, studentUpdates, teacherId) {
  const record = { overall_summary: summary, teacher_id: teacherId, schedule_id: scheduleId }
  const varDecls = studentUpdates.map((_, i) => `$sid${i}: bigint!, $set${i}: schedule_student_set_input!`).join(', ')
  const updateFields = studentUpdates
    .map((u, i) => `u${i}: update_schedule_student_by_pk(pk_columns: {id: $sid${i}}, _set: $set${i}) { id }`)
    .join('\n      ')
  const variables = { sid: scheduleId, rec: record }
  studentUpdates.forEach((u, i) => {
    variables[`sid${i}`] = u.where.id._eq
    variables[`set${i}`] = u._set
  })
  return gql(
    `mutation SaveRecord($sid: bigint!, $rec: lesson_record_insert_input!${varDecls ? ', ' + varDecls : ''}) {
      delete_lesson_record(where: { schedule_id: { _eq: $sid } }) { affected_rows }
      insert_lesson_record_one(object: $rec) { id }
      update_schedule_by_pk(pk_columns: {id: $sid}, _set: { status: "已完成" }) { id }
      ${updateFields}
    }`,
    variables,
  )
}

/* ============ 月度考核 ============ */
export function fetchAssessments(kgId, month) {
  const where = { kindergarten_id: { _eq: kgId } }
  if (month) where.assess_month = { _eq: month }
  return gql(
    `query ($where: assessment_bool_exp) {
      assessment(where: $where, order_by: { child_id: asc }) {
        id assess_month score comment
        child { id name }
        course { id course_type }
        teacher { name }
      }
    }`,
    { where },
  ).then((d) => d.assessment)
}

/** 保存考核（孩子×课程×月份唯一，先删后插同事务） */
export function saveAssessment(object) {
  return gql(
    `mutation SaveAssessment($object: assessment_insert_input!, $childId: bigint!, $courseId: bigint!, $month: String!) {
      delete_assessment(where: { child_id: { _eq: $childId }, course_id: { _eq: $courseId }, assess_month: { _eq: $month } }) { affected_rows }
      insert_assessment_one(object: $object) { id }
    }`,
    { object, childId: object.child_id, courseId: object.course_id, month: object.assess_month },
  )
}

/* ============ 员工 ============ */
export function fetchStaff(kgId) {
  return gql(
    `query ($kg: bigint!) {
      user(where: { kindergarten_id: { _eq: $kg } }, order_by: { id: asc }) {
        id name phone role status account_id
      }
    }`,
    { kg: kgId },
  ).then((d) => d.user)
}

export function saveStaff(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: user_set_input!) { update_user_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: user_insert_input!) { insert_user_one(object: $object) { id } }`,
    { object: payload },
  )
}

/**
 * 管理员开通账号：注册 Zion 账户 + 创建/绑定用户资料（一次完成）
 * { name, phone, role, kindergarten_id, password }
 * 若该手机号已有未绑定的用户资料则直接绑定；已有账号则报错提示
 */
export async function createStaffWithAccount({ name, phone, role, kindergarten_id, password }) {
  const exist = await gql(
    `query ($phone: String!) { user(where: { phone: { _eq: $phone } }) { id account_id kindergarten_id } }`,
    { phone },
  ).then((d) => d.user[0])
  if (exist?.account_id) {
    const err = new Error('该手机号已开通过账号，可直接登录')
    err.code = 'ACCOUNT_EXISTS'
    throw err
  }
  const account = await registerAccount(phone, password)
  if (exist) {
    await gql(
      `mutation ($id: bigint!, $accountId: bigint!) { update_user_by_pk(pk_columns: {id: $id}, _set: { account_id: $accountId }) { id } }`,
      { id: exist.id, accountId: account.id },
    )
    return { userId: exist.id, accountId: account.id, rebound: true }
  }
  const res = await gql(
    `mutation ($object: user_insert_input!) { insert_user_one(object: $object) { id } }`,
    { object: { name, phone, role, status: '在职', kindergarten_id, account_id: account.id } },
  )
  return { userId: res?.insert_user_one?.id, accountId: account.id, rebound: false }
}

/* ============ 课程组合（平台级，管理员维护，园所只读） ============ */
export function fetchPackages() {
  return gql(
    `query {
      course_package(order_by: { sort_order: asc, id: asc }) {
        id package_name description status sort_order
        items(order_by: { day_of_week: asc, start_time: asc }) {
          id day_of_week start_time duration_minutes
          lesson { id lesson_name topic course { id course_type course_name } }
        }
      }
    }`,
  ).then((d) => d.course_package)
}

/** 保存组合基本信息（新建或更新） */
export function savePackage(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: course_package_set_input!) { update_course_package_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: course_package_insert_input!) { insert_course_package_one(object: $object) { id } }`,
    { object: payload },
  )
}

/** 全量替换组合明细（先删后插，同事务；新建时用 parentId 回填） */
export function savePackageItems(packageId, items) {
  const rows = items.map((it) => ({
    package_id: packageId,
    lesson_id: it.lesson_id,
    day_of_week: it.day_of_week,
    start_time: it.start_time,
    duration_minutes: it.duration_minutes || 30,
  }))
  return gql(
    `mutation SavePackageItems($pid: bigint!, $items: [course_package_item_insert_input!]!) {
      delete_course_package_item(where: { package_id: { _eq: $pid } }) { affected_rows }
      insert_course_package_item(objects: $items) { affected_rows }
    }`,
    { pid: packageId, items: rows },
  )
}

export function deletePackage(id) {
  return gql(
    `mutation DeletePackage($id: bigint!) {
      delete_course_package_item(where: { package_id: { _eq: $id } }) { affected_rows }
      delete_course_package_by_pk(id: $id) { id }
    }`,
    { id },
  )
}

/** 批量创建排课（每条带学员快照嵌套插入，单事务原子） */
export function batchCreateSchedules(objects) {
  return gql(
    `mutation BatchCreateSchedules($objects: [schedule_insert_input!]!) {
      insert_schedule(objects: $objects) { affected_rows returning { id } }
    }`,
    { objects },
  )
}

/* ============ 识字字库 + 汉字课件（平台级） ============ */
/** 字库条目（含课件），levels 默认 [0,1]（字根+汉字） */
export function fetchLiteracyItems(levels = [0, 1]) {
  return gql(
    `query ($levels: [bigint!]!) {
      literacy_item(where: { level: { _in: $levels }, status: { _eq: "启用" } }, order_by: { level: asc, sort_order: asc }) {
        id item_type level content pinyin meaning components_note teaching_tip sort_order
        courseware { id explanation stroke_groups status variants image review_status edited_by reviewed_by }
      }
    }`,
    { levels },
  ).then((d) => d.literacy_item)
}

/** 保存汉字课件（有则更新，无则新建） */
export async function saveCourseware(itemId, payload) {
  const exist = await gql(
    `query ($itemId: bigint!) { char_courseware(where: { item_id: { _eq: $itemId } }) { id } }`,
    { itemId },
  ).then((d) => d.char_courseware[0])
  if (exist) {
    return gql(
      `mutation ($id: bigint!, $set: char_courseware_set_input!) { update_char_courseware_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id: exist.id, set: payload },
    )
  }
  return gql(
    `mutation ($object: char_courseware_insert_input!) { insert_char_courseware_one(object: $object) { id } }`,
    { object: { ...payload, item_id: itemId } },
  )
}

/** 审核汉字课件：待审核 → 已通过 / 草稿（退回）；记录审核人 */
export async function reviewCourseware(itemId, reviewStatus, reviewerName) {
  const exist = await gql(
    `query ($itemId: bigint!) { char_courseware(where: { item_id: { _eq: $itemId } }) { id } }`,
    { itemId },
  ).then((d) => d.char_courseware[0])
  if (!exist) throw new Error('该字还没有课件，无法审核')
  return gql(
    `mutation ($id: bigint!, $set: char_courseware_set_input!) { update_char_courseware_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
    { id: exist.id, set: { review_status: reviewStatus, reviewed_by: reviewerName || null } },
  )
}

/* ============ 学习进度（分组 × 课节解锁） ============ */
/** 各分组已完成的课节 id（进度推导：排课状态=已完成） */
export function fetchGroupProgress(kgId) {
  return gql(
    `query ($kg: bigint!) {
      schedule(where: { kindergarten_id: { _eq: $kg }, status: { _eq: "已完成" } }) {
        study_group_id lesson_id
      }
    }`,
    { kg: kgId },
  ).then((d) => d.schedule)
}

/** 课节绑定的教学内容（含课件） */
export function fetchLessonItems(lessonId) {
  return gql(
    `query ($lid: bigint!) {
      lesson_item(where: { lesson_id: { _eq: $lid } }, order_by: { sort_order: asc }) {
        id sort_order teaching_note
        item { id content pinyin meaning item_type level teaching_tip
          courseware { id explanation stroke_groups status variants image review_status }
        }
      }
    }`,
    { lid: lessonId },
  ).then((d) => d.lesson_item)
}

/* ============ 平台端：素材账号（素材员/审核员） ============ */
export function fetchPlatformStaff() {
  return gql(
    `query {
      user(where: { role: { _in: ["素材员", "审核员"] } }, order_by: { id: asc }) {
        id name phone role status account_id created_at
      }
    }`,
  ).then((d) => d.user)
}

/** 停用/启用素材账号 */
export function setPlatformStaffStatus(id, status) {
  return gql(
    `mutation ($id: bigint!, $status: String!) { update_user_by_pk(pk_columns: {id: $id}, _set: {status: $status}) { id } }`,
    { id, status },
  )
}

/* ============ 平台端：园所 ============ */
export function fetchKindergartens() {
  return gql(
    `query {
      kindergarten(order_by: { id: asc }) {
        id name contact_name contact_phone status remark
        staff_users_aggregate { aggregate { count } }
        children_aggregate { aggregate { count } }
        schedules_aggregate { aggregate { count } }
      }
    }`,
  ).then((d) => d.kindergarten)
}

export function saveKindergarten(payload, id) {
  if (id) {
    return gql(
      `mutation ($id: bigint!, $set: kindergarten_set_input!) { update_kindergarten_by_pk(pk_columns: {id: $id}, _set: $set) { id } }`,
      { id, set: payload },
    )
  }
  return gql(
    `mutation ($object: kindergarten_insert_input!) { insert_kindergarten_one(object: $object) { id } }`,
    { object: payload },
  )
}
