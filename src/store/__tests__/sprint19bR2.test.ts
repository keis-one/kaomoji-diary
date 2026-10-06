// Sprint 19b 再評価（kaomoji-diary_sprint-19b_eval-r2.md）の R1・R2・追加所見と、通知APIが応答しないとき（改善提案4）。
// 画面が使う手順そのもの（createReminderController / finishOnboarding）と実際のストアを、
// 許可の確認・予約をテスト側で止めて、評価レポートの順番で再開する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, entry, freeState, q, deferred, tick, testQuestionFactory } from './helpers'
import { createReminderController, finishOnboarding } from '../reminderController'
import { createDiaryStore, type DiaryStore } from '../createDiaryStore'
import type { Question } from '@/types'

/** 予約APIの模擬。呼ばれた時刻を記録し、予約済み一覧に入れる。gate があれば ID を返すのを待たせる */
const makeScheduler = (notifier: MockNotifier) => {
  const calls: { id: string; time: string }[] = []
  let n = 0
  let gate: Promise<void> | null = null
  const schedule = async (qq: Question): Promise<string> => {
    const id = `n${++n}_${qq.reminderTime}`
    calls.push({ id, time: qq.reminderTime })
    notifier.schedule(id)
    if (gate) await gate
    return id
  }
  return { schedule, calls, setGate: (g: Promise<void> | null) => (gate = g) }
}

const controller = (store: DiaryStore, requestPermission: () => Promise<boolean>, schedule: (q: Question) => Promise<string>) =>
  createReminderController({ store, isSupported: true, requestPermission, schedule })

// ── R1 ──────────────────────────────────────────────

test('R1 画面を離れる前のフック（A）の ON が許可待ちの間に、新しいフック（B）で ON→OFF したら、A の ON は後から有効にならない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([])) // q1・リマインダー OFF
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const sch = makeScheduler(notifier)

  const permA = deferred<boolean>()
  const hookA = controller(s, () => permA.promise, sch.schedule)
  const aOn = hookA.toggle('q1', true) // 許可の確認で止まる
  await tick()

  const hookB = controller(s, async () => true, sch.schedule) // 戻ってきた画面の新しいフック
  assert.equal(await hookB.toggle('q1', true), 'scheduled')
  assert.equal(await hookB.toggle('q1', false), 'disabled')
  assert.deepEqual([...notifier.scheduled], [])

  permA.resolve(true) // 古い ON の許可が後から届く
  assert.equal(await aOn, 'discarded')
  await s.getState().flushWrites()

  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, false, '最後の操作（OFF）を保つ')
  assert.equal(qq.notificationId, undefined)
  assert.deepEqual([...notifier.scheduled], [], '通知は0件')
  assert.equal(sch.calls.length, 1, 'A は予約しない')
})

test('R1 同じ順番で、A の予約の途中（ID を返す前）に B が OFF にしても、A の通知は解除され OFF のまま', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const sch = makeScheduler(notifier)
  const gate = deferred()
  sch.setGate(gate.promise)
  const hookA = controller(s, async () => true, sch.schedule)
  const aOn = hookA.toggle('q1', true)
  await tick()
  const hookB = controller(s, async () => true, sch.schedule)
  const bOff = hookB.toggle('q1', false)
  gate.resolve()
  assert.equal(await aOn, 'discarded')
  assert.equal(await bOff, 'disabled')
  assert.deepEqual([...notifier.scheduled], [])
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
})

test('R1 許可されなかった ON は、最新の操作のときだけ知らせ、状態を変えない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  let denied = 0
  const c = createReminderController({
    store: s,
    isSupported: true,
    requestPermission: async () => false,
    schedule: async () => 'x',
    onPermissionDenied: () => denied++,
  })
  assert.equal(await c.toggle('q1', true), 'denied')
  assert.equal(denied, 1)
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().pendingReminderOperation('q1'), null)
})

// ── R2 ──────────────────────────────────────────────

const freshStore = async (notifier: MockNotifier) => boot(new MemoryStorage(), notifier)

test('R2 オンボーディングの許可待ちの間にリセット＋新しいオンボーディングが入ったら、古い処理は予約も画面の移動もしない', async () => {
  const notifier = new MockNotifier()
  const s = await freshStore(notifier)
  const sch = makeScheduler(notifier)
  const navs: string[] = []
  const permOld = deferred<boolean>()

  const oldRun = finishOnboarding(
    { store: s, isSupported: true, requestPermission: () => permOld.promise, schedule: sch.schedule, navigateHome: () => navs.push('old') },
    { label: 'old', language: 'ja', reminderEnabled: true, reminderTime: '21:00' },
  )
  await tick() // 問いの保存後、許可の確認で止まる
  assert.equal(s.getState().settings.questions[0].label, 'old')

  await s.getState().resetAllData()
  const newRun = await finishOnboarding(
    { store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule, navigateHome: () => navs.push('new') },
    { label: 'new', language: 'en', reminderEnabled: false, reminderTime: '08:00' },
  )
  assert.equal(newRun, 'done')

  permOld.resolve(true) // 古い許可が後から届く
  assert.equal(await oldRun, 'discarded')
  await s.getState().flushWrites()

  const qq = s.getState().settings.questions[0]
  assert.equal(qq.label, 'new')
  assert.equal(qq.reminderEnabled, false)
  assert.equal(qq.notificationId, undefined)
  assert.deepEqual([...notifier.scheduled], [])
  assert.deepEqual(sch.calls, [])
  assert.deepEqual(navs, ['new'], '古い処理からの画面の移動は行わない')
})

test('R2 予約の途中（ID を返す前）にリセットされた場合も、予約した通知は解除し、画面の移動もしない', async () => {
  const notifier = new MockNotifier()
  const s = await freshStore(notifier)
  const sch = makeScheduler(notifier)
  const gate = deferred()
  sch.setGate(gate.promise)
  const navs: string[] = []
  const run = finishOnboarding(
    { store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule, navigateHome: () => navs.push('old') },
    { label: 'old', language: 'ja', reminderEnabled: true, reminderTime: '21:00' },
  )
  await tick()
  assert.equal(sch.calls.length, 1)
  await s.getState().resetAllData()
  gate.resolve()
  assert.equal(await run, 'discarded')
  await s.getState().flushWrites()
  assert.deepEqual([...notifier.scheduled], [])
  assert.deepEqual(navs, [])
})

test('R2 通常のオンボーディング（リマインダー ON）は予約してホームへ移る', async () => {
  const notifier = new MockNotifier()
  const s = await freshStore(notifier)
  const sch = makeScheduler(notifier)
  const navs: string[] = []
  const r = await finishOnboarding(
    { store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule, navigateHome: () => navs.push('home') },
    { label: '禁煙', language: 'ja', reminderEnabled: true, reminderTime: '07:30' },
  )
  assert.equal(r, 'done')
  assert.deepEqual(navs, ['home'])
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, true)
  assert.equal(qq.notificationId, sch.calls[0].id)
  assert.equal(sch.calls[0].time, '07:30')
})

test('R2 オンボーディングの保存に失敗したら、許可の確認も画面の移動もしない', async () => {
  const storage = new MemoryStorage()
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  storage.failWrites = true
  let asked = 0
  const navs: string[] = []
  const r = await finishOnboarding(
    { store: s, isSupported: true, requestPermission: async () => (asked++, true), schedule: async () => 'x', navigateHome: () => navs.push('home') },
    { label: '禁煙', language: 'ja', reminderEnabled: true, reminderTime: '21:00' },
  )
  assert.equal(r, 'saveFailed')
  assert.equal(asked, 0)
  assert.deepEqual(navs, [])
})

// ── 追加所見: ON の途中の時刻変更 ─────────────────────

test('所見 ON の予約の途中（21:00 で予約中）に時刻を 07:00 に変えると、保存値と予約が 07:00 で一致する', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const sch = makeScheduler(notifier)
  const gate = deferred()
  sch.setGate(gate.promise)
  const hook = controller(s, async () => true, sch.schedule)
  const on = hook.toggle('q1', true)
  await tick()
  assert.equal(sch.calls[0]?.time, '21:00')
  sch.setGate(null)
  const change = hook.changeTime('q1', '07:00')
  gate.resolve()
  assert.equal(await on, 'discarded')
  assert.equal(await change, 'scheduled')
  await s.getState().flushWrites()
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderTime, '07:00')
  assert.equal(qq.reminderEnabled, true)
  assert.deepEqual([...notifier.scheduled], [qq.notificationId])
  assert.equal(sch.calls.find((c) => c.id === qq.notificationId)?.time, '07:00')
})

test('所見 ON の許可待ちの間に時刻を変えても、最後は新しい時刻で ON（古い ON は捨てる）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const sch = makeScheduler(notifier)
  const perm = deferred<boolean>()
  const hook = controller(s, () => perm.promise, sch.schedule)
  const on = hook.toggle('q1', true)
  await tick()
  assert.equal(await hook.changeTime('q1', '06:15'), 'scheduled')
  perm.resolve(true)
  assert.equal(await on, 'discarded')
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderTime, '06:15')
  assert.equal(qq.reminderEnabled, true)
  assert.deepEqual(sch.calls.map((c) => c.time), ['06:15'])
  assert.deepEqual([...notifier.scheduled], [qq.notificationId])
})

test('所見 OFF のときの時刻変更は保存だけ。OFF の操作の途中の時刻変更も予約しない', async () => {
  const storage = new MemoryStorage()
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n_on' })
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.schedule('n_on')
  const s = await boot(storage, notifier)
  const sch = makeScheduler(notifier)
  const hook = controller(s, async () => true, sch.schedule)
  // OFF の途中（解除を待たせる）に時刻を変える
  const cancelGate = deferred()
  const origCancel = notifier.cancel.bind(notifier)
  notifier.cancel = async (id: string) => {
    await cancelGate.promise
    return origCancel(id)
  }
  const off = hook.toggle('q1', false)
  await tick()
  assert.equal(await hook.changeTime('q1', '05:00'), 'saved')
  cancelGate.resolve()
  assert.equal(await off, 'disabled')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().settings.questions[0].reminderTime, '05:00')
  assert.deepEqual(sch.calls, [])
  // OFF のままの時刻変更も保存だけ
  assert.equal(await hook.changeTime('q1', '05:30'), 'saved')
  assert.deepEqual(sch.calls, [])
})

// ── 改善提案4: 通知APIが応答しない ───────────────────

const bootWithTimeout = async (storage: MemoryStorage, notifier: MockNotifier) => {
  const store = createDiaryStore({ storage, notifier, createQuestion: testQuestionFactory, notificationTimeoutMs: 30 })
  await store.getState().hydrate()
  return store
}

test('提案4 通知の解除が応答しなくても、全データリセットは時間内に終わり、ID は解除待ちに残って次の起動で再試行する', async () => {
  const storage = new MemoryStorage()
  const st = freeState([entry('2026-10-01', 'q1')]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n_hang' })
  storage.putState(st)
  const notifier = new MockNotifier()
  const s = await bootWithTimeout(storage, notifier)
  const origCancel = notifier.cancel.bind(notifier)
  notifier.cancel = (id: string) => (id === 'n_hang' ? new Promise<void>(() => {}) : origCancel(id))
  await s.getState().resetAllData() // 待ち続けない
  await s.getState().flushWrites()
  assert.equal(s.getState().isOnboardingDone, false)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, ['n_hang'])
  notifier.cancel = origCancel
  await bootWithTimeout(storage, notifier)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])
})

test('提案4 一覧の取得が応答しなくても整理は時間切れで終わり（印は残す）、後の予約は待たされない', async () => {
  const storage = new MemoryStorage()
  storage.putState({ entries: [], settings: { questions: 'broken' }, isOnboardingDone: true })
  const notifier = new MockNotifier()
  notifier.listGate = new Promise<void>(() => {}) // 応答しない
  const s = await bootWithTimeout(storage, notifier)
  assert.equal(s.getState().notificationCleanupPending, true)
  await s.getState().recoverQuestion('禁煙')
  const id = s.getState().settings.activeQuestionId
  const c = controller(s, async () => true, async () => (notifier.schedule('n_ok'), 'n_ok'))
  assert.equal(await c.toggle(id, true), 'scheduled')
  assert.equal(s.getState().settings.questions[0].notificationId, 'n_ok')
})

test('提案4 予約が応答しないときは予約なしとして扱い、後から届いた通知は解除する', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await bootWithTimeout(storage, notifier)
  const late = deferred()
  const c = controller(s, async () => true, async () => {
    notifier.schedule('n_late')
    await late.promise
    return 'n_late'
  })
  assert.equal(await c.toggle('q1', true), 'notScheduled')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  late.resolve()
  await tick()
  assert.deepEqual([...notifier.scheduled], [], '時間切れの後で届いた通知は解除する')
})

test('R2 リセット後に同じ問いIDの問いができても、リセット前に始めた操作は世代で古いと分かり、予約しない', async () => {
  // 問いIDが重なる場合（通常は起きない）でも、問いIDの有無ではなくリセットの世代で古い操作を捨てることを確かめる
  const notifier = new MockNotifier()
  const store = createDiaryStore({ storage: new MemoryStorage(), notifier, createQuestion: (label) => q('same', { label }) })
  await store.getState().hydrate()
  await store.getState().completeOnboarding('old', 'ja', false)
  const sch = makeScheduler(notifier)
  const perm = deferred<boolean>()
  const on = controller(store, () => perm.promise, sch.schedule).toggle('same', true)
  await tick()
  await store.getState().resetAllData()
  await store.getState().completeOnboarding('new', 'ja', false)
  perm.resolve(true)
  assert.equal(await on, 'discarded')
  assert.deepEqual(sch.calls, [])
  assert.equal(store.getState().settings.questions[0].reminderEnabled, false)
})
