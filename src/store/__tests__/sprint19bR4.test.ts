// Sprint 19b 第4回評価（kaomoji-diary_sprint-19b_eval-r4.md）の R4-A。
// 既に ON の設定画面で時刻欄を続けて編集したとき、先に始まった予約の結果（成功・時間切れ）が
// 入力途中の新しい値（入力欄＝保存値）を書き換えないこと。画面と同じ手順（createReminderController）と実際のストアで確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, freeState, q, deferred, tick, testQuestionFactory } from './helpers'
import { createReminderController } from '../reminderController'
import { createDiaryStore } from '../createDiaryStore'
import type { Question } from '@/types'

const onState = () => {
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, reminderTime: '21:00', notificationId: 'n_old' })
  return st
}

/** 予約APIの模擬。最初の1回だけ gate まで ID を返さない。呼ばれた時刻を記録する */
const firstGatedScheduler = (notifier: MockNotifier, gate: Promise<void>) => {
  const times: string[] = []
  let first = true
  const schedule = async (qq: Question) => {
    const id = `n_${qq.reminderTime}`
    times.push(qq.reminderTime)
    notifier.schedule(id)
    if (first) {
      first = false
      await gate
    }
    return id
  }
  return { schedule, times }
}

/** 画面の時刻欄の値＝ストアの保存値（設定画面は value={q.reminderTime}） */
const fieldValue = (s: { getState: () => any }) => s.getState().settings.questions[0].reminderTime

test('R4-A 既に ON → 07:00 で予約開始 → 途中の "08:" を入力 → 先行予約が成功 → 再起動: 入力欄・保存値は "08:" のまま、通知は 07:00 の1件', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  const gate = deferred()
  const sch = firstGatedScheduler(notifier, gate.promise)
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })

  const t07 = c.changeTime('q1', '07:00')
  await tick()
  assert.equal(await c.changeTime('q1', '08:'), 'saved')
  assert.equal(fieldValue(s), '08:')
  gate.resolve() // 先行する 07:00 の予約が成功
  assert.equal(await t07, 'scheduled')
  await s.getState().flushWrites()

  assert.equal(fieldValue(s), '08:', '先行予約の結果で入力欄を 07:00 に戻さない')
  assert.equal(storage.stored().settings.questions[0].reminderTime, '08:', '保存値も "08:" のまま')
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, true, 'ON と通知0件にしない（07:00 の通知は有効）')
  assert.equal(qq.notificationId, 'n_07:00')
  assert.equal(qq.lastValidReminderTime, '07:00')
  assert.deepEqual([...notifier.scheduled], ['n_07:00'])

  const s2 = await boot(storage, notifier)
  assert.equal(fieldValue(s2), '08:', '再起動後も入力した値')
  assert.equal(s2.getState().settings.questions[0].notificationId, 'n_07:00')
  assert.deepEqual([...notifier.scheduled], ['n_07:00'])
})

test('R4-A 同じ順番で先行予約が時間切れ: OFF・失敗の表示になるが、入力欄・保存値は "08:" のまま。遅い通知は解除。もう一度 ON で最後の正しい時刻に予約', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = createDiaryStore({ storage, notifier, createQuestion: testQuestionFactory, notificationTimeoutMs: 30 })
  await s.getState().hydrate()
  const late = deferred()
  const sch = firstGatedScheduler(notifier, late.promise)
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })

  const t07 = c.changeTime('q1', '07:00')
  await tick(1)
  assert.equal(await c.changeTime('q1', '08:'), 'saved')
  assert.equal(await t07, 'notScheduled') // 30ms で時間切れ
  await s.getState().flushWrites()

  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, false)
  assert.equal(s.getState().reminderFailure, true)
  assert.equal(fieldValue(s), '08:', '時間切れの結果で入力欄を 07:00 に戻さない')
  assert.equal(storage.stored().settings.questions[0].reminderTime, '08:')

  late.resolve() // 遅れて届いた 07:00 の通知は解除する
  await tick()
  assert.deepEqual([...notifier.scheduled], [])

  const s2 = createDiaryStore({ storage, notifier, createQuestion: testQuestionFactory, notificationTimeoutMs: 30 })
  await s2.getState().hydrate()
  assert.equal(fieldValue(s2), '08:')
  assert.equal(s2.getState().settings.questions[0].reminderEnabled, false)

  // もう一度 ON: 入力途中の "08:" ではなく、最後の正しい時刻 07:00 で予約し、時刻欄もそれに揃える（OFF の間は欄が出ない）
  const c2 = createReminderController({ store: s2, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })
  assert.equal(await c2.toggle('q1', true), 'scheduled')
  assert.equal(fieldValue(s2), '07:00')
  assert.equal(s2.getState().settings.questions[0].notificationId, 'n_07:00')
  assert.equal(sch.times[sch.times.length - 1], '07:00')
})

test('R4-A 途中の "08:" のあと完成した 08:00 を入力すると、最後の時刻 08:00 の通知が1件だけ残る', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  const gate = deferred()
  const sch = firstGatedScheduler(notifier, gate.promise)
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })

  const t07 = c.changeTime('q1', '07:00')
  await tick()
  await c.changeTime('q1', '08:')
  const t0800 = c.changeTime('q1', '08:00')
  gate.resolve()
  assert.equal(await t07, 'discarded')
  assert.equal(await t0800, 'scheduled')
  await s.getState().flushWrites()

  const qq = s.getState().settings.questions[0]
  assert.equal(fieldValue(s), '08:00')
  assert.equal(qq.reminderEnabled, true)
  assert.equal(qq.notificationId, 'n_08:00')
  assert.deepEqual([...notifier.scheduled], ['n_08:00'], '最後の時刻に1回だけ')
  const s2 = await boot(storage, notifier)
  assert.equal(fieldValue(s2), '08:00')
  assert.deepEqual([...notifier.scheduled], ['n_08:00'])
})

test('R4-A 入力途中のまま時刻欄を離れたら、最後の正しい時刻（予約している時刻）に戻す', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  const c = createReminderController({
    store: s,
    isSupported: true,
    requestPermission: async () => true,
    schedule: async (qq) => {
      const id = `n_${qq.reminderTime}`
      notifier.schedule(id)
      return id
    },
  })
  assert.equal(await c.changeTime('q1', '07:00'), 'scheduled')
  await c.changeTime('q1', '08:')
  assert.equal(await c.finishTimeEdit('q1', '08:'), 'saved')
  assert.equal(fieldValue(s), '07:00')
  assert.equal(s.getState().settings.questions[0].notificationId, 'n_07:00')
  // 完成した時刻で離れたら、その時刻で予約し直す
  assert.equal(await c.finishTimeEdit('q1', '09:15'), 'scheduled')
  assert.equal(fieldValue(s), '09:15')
  assert.deepEqual([...notifier.scheduled], ['n_09:15'])
})

test('R4-A 古い保存データ（最後の正しい時刻が無い）で時刻欄が入力途中なら、最初の時刻 21:00 に戻す', async () => {
  const storage = new MemoryStorage()
  const st = onState()
  st.settings.questions[0].reminderTime = '1'
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: async () => 'x' })
  await c.finishTimeEdit('q1', '1')
  assert.equal(fieldValue(s), '21:00')
})
