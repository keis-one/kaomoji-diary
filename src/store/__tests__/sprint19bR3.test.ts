// Sprint 19b 第3回評価（kaomoji-diary_sprint-19b_eval-r3.md）の R3-A・R3-B・L1。
// 予約の失敗・時間切れ・許可の拒否のあとは「リマインダー OFF ＋ 失敗の表示（reminderFailure）」に統一する。
// 画面が使う手順（createReminderController / finishOnboarding）と実際のストアで、評価の順番を再現する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MemoryStorage, MockNotifier, boot, freeState, q, deferred, tick, testQuestionFactory } from './helpers'
import { createReminderController, finishOnboarding } from '../reminderController'
import { createDiaryStore } from '../createDiaryStore'
import type { Question } from '@/types'
import { STRINGS } from '@/i18n/strings'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (r: string) => readFileSync(path.join(ROOT, r), 'utf8')

const bootWithTimeout = async (storage: MemoryStorage, notifier: MockNotifier) => {
  const store = createDiaryStore({ storage, notifier, createQuestion: testQuestionFactory, notificationTimeoutMs: 30 })
  await store.getState().hydrate()
  return store
}

const onState = () => {
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, reminderTime: '21:00', notificationId: 'n_old' })
  return st
}

// ── R3-A ────────────────────────────────────────────

test('R3-A 既に ON → 時刻変更 → 予約が時間切れ → 遅い結果を解除 → 再起動: OFF で保存され、通知0件、失敗を表示する', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await bootWithTimeout(storage, notifier)

  const late = deferred()
  const c = createReminderController({
    store: s,
    isSupported: true,
    requestPermission: async () => true,
    schedule: async () => {
      notifier.schedule('n_late')
      await late.promise // 時間制限（30ms）より遅れて返る
      return 'n_late'
    },
  })
  assert.equal(await c.changeTime('q1', '07:00'), 'notScheduled')
  await s.getState().flushWrites()

  // 時間切れの直後: ON のままにしない・失敗を表示する
  let qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, false, 'ON 表示にしない')
  assert.equal(qq.notificationId, undefined)
  assert.equal(qq.reminderTime, '07:00', '入力した時刻は保存する')
  assert.equal(s.getState().reminderFailure, true, '失敗を表示する')
  assert.equal(storage.stored().settings.questions[0].reminderEnabled, false, '保存値も OFF')
  assert.equal(notifier.scheduled.has('n_old'), false, '古い通知は解除済み')

  // 遅れて届いた予約は解除する
  late.resolve()
  await tick()
  await s.getState().flushWrites()
  assert.deepEqual([...notifier.scheduled], [])

  // 再起動しても OFF・通知0件・解除待ち0件で、設定と予約が一致する
  const s2 = await bootWithTimeout(storage, notifier)
  qq = s2.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, false)
  assert.equal(qq.notificationId, undefined)
  assert.deepEqual([...notifier.scheduled], [])
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])

  // もう一度 ON にすれば再試行でき、成功すると失敗の表示は消える
  const retry = createReminderController({
    store: s,
    isSupported: true,
    requestPermission: async () => true,
    schedule: async () => (notifier.schedule('n_retry'), 'n_retry'),
  })
  assert.equal(await retry.toggle('q1', true), 'scheduled')
  assert.equal(s.getState().reminderFailure, false)
  assert.equal(s.getState().settings.questions[0].reminderTime, '07:00')
})

test('R3-A 予約が失敗（ID が返らない）しても同じく OFF・失敗の表示', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: async () => undefined })
  assert.equal(await c.changeTime('q1', '06:00'), 'notScheduled')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().reminderFailure, true)
  assert.deepEqual([...notifier.scheduled], [])
})

test('R3-A 入力の途中の時刻（"7:"）では予約し直さず、ON と既存の通知を保つ', async () => {
  const storage = new MemoryStorage()
  storage.putState(onState())
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  let called = 0
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: async () => (called++, 'x') })
  assert.equal(await c.changeTime('q1', '7:'), 'saved')
  assert.equal(called, 0)
  assert.equal(s.getState().settings.questions[0].reminderEnabled, true)
  assert.equal(s.getState().settings.questions[0].notificationId, 'n_old')
  assert.equal(s.getState().reminderFailure, false)
})

// ── R3-B ────────────────────────────────────────────

test('R3-B オンボーディングで通知の許可を拒否: ホームへは移るが、リマインダーは OFF で保存し、失敗を表示する（再起動後も OFF）', async () => {
  const storage = new MemoryStorage()
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const navs: string[] = []
  let scheduled = 0
  const r = await finishOnboarding(
    {
      store: s,
      isSupported: true,
      requestPermission: async () => false,
      schedule: async () => (scheduled++, 'x'),
      navigateHome: () => navs.push('home'),
    },
    { label: '禁煙', language: 'ja', reminderEnabled: true, reminderTime: '21:00' },
  )
  assert.equal(r, 'done')
  assert.deepEqual(navs, ['home'], 'ホームへの移動は妨げない')
  assert.equal(scheduled, 0)
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, false, 'ON 表示にしない')
  assert.equal(qq.notificationId, undefined)
  assert.equal(s.getState().reminderFailure, true, 'ホーム・設定に失敗を表示する')
  await s.getState().flushWrites()
  assert.equal(storage.stored().settings.questions[0].reminderEnabled, false)
  const s2 = await boot(storage, notifier)
  assert.equal(s2.getState().settings.questions[0].reminderEnabled, false)
  assert.deepEqual([...notifier.scheduled], [])
})

test('R3-B オンボーディングで予約に失敗した場合も OFF・失敗の表示（ホームへは移る）', async () => {
  const notifier = new MockNotifier()
  const s = await boot(new MemoryStorage(), notifier)
  const navs: string[] = []
  const r = await finishOnboarding(
    { store: s, isSupported: true, requestPermission: async () => true, schedule: async () => undefined, navigateHome: () => navs.push('home') },
    { label: '禁煙', language: 'en', reminderEnabled: true, reminderTime: '21:00' },
  )
  assert.equal(r, 'done')
  assert.deepEqual(navs, ['home'])
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().reminderFailure, true)
})

test('設定で ON にして許可を拒否: OFF のまま・失敗を表示。全データリセットで表示は消える', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier())
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => false, schedule: async () => 'x' })
  assert.equal(await c.toggle('q1', true), 'denied')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().reminderFailure, true)
  await s.getState().resetAllData()
  assert.equal(s.getState().reminderFailure, false)
})

test('古い操作の許可拒否は、新しい操作の状態や表示を変えない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const perm = deferred<boolean>()
  const a = createReminderController({ store: s, isSupported: true, requestPermission: () => perm.promise, schedule: async () => 'x' })
  const aOn = a.toggle('q1', true)
  await tick()
  const b = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: async () => (notifier.schedule('n_b'), 'n_b') })
  assert.equal(await b.toggle('q1', true), 'scheduled')
  perm.resolve(false)
  assert.equal(await aOn, 'discarded')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, true)
  assert.equal(s.getState().settings.questions[0].notificationId, 'n_b')
  assert.equal(s.getState().reminderFailure, false)
})

// ── L1（低優先。仕組みの整理で一緒に直した） ─────────

test('L1 初回 ON の予約中に時刻を 07:00 → 08:00 と続けて変えると、最後の 08:00 で保存・予約する', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const calls: string[] = []
  const gate = deferred()
  let first = true
  const schedule = async (qq: Question) => {
    const id = `n_${qq.reminderTime}`
    calls.push(qq.reminderTime)
    notifier.schedule(id)
    if (first) {
      first = false
      await gate.promise
    }
    return id
  }
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule })
  const on = c.toggle('q1', true)
  await tick()
  const t1 = c.changeTime('q1', '07:00')
  const t2 = c.changeTime('q1', '08:00')
  gate.resolve()
  await on
  await t1
  assert.equal(await t2, 'scheduled')
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderTime, '08:00')
  assert.equal(qq.reminderEnabled, true)
  assert.deepEqual([...notifier.scheduled], ['n_08:00'])
})

// ── 画面の接続（失敗の表示・書き出し） ─────────────────

test('失敗の表示: 設定画面とホームが reminderFailure で「通知を設定できませんでした…」を出す（日英）', () => {
  assert.equal(STRINGS.ja.reminderSetupFailed, '通知を設定できませんでした（端末の通知の許可を確認してください）')
  assert.ok(STRINGS.en.reminderSetupFailed.length > 0)
  const settings = read('app/(tabs)/settings.tsx')
  assert.match(settings, /\{reminderFailure && <Text style=\{styles\.errorText\}>\{s\.reminderSetupFailed\}<\/Text>\}/)
  const home = read('app/(tabs)/index.tsx')
  assert.match(home, /\{reminderFailure && \(/)
  assert.match(home, /t\(settings\.language\)\.reminderSetupFailed/)
})

test('書き出し: 共有画面を閉じたあとにトーストを出さない。画面に説明文を出し、失敗の表示は残す', () => {
  const code = read('src/screens/settings/ExportScreen.tsx')
  assert.doesNotMatch(code, /showToast/)
  assert.match(code, /\{s\.exportHowItWorks\}/)
  assert.match(code, /\{failed && <Text style=\{styles\.error\}>\{s\.exportFailed\}<\/Text>\}/)
  assert.equal(STRINGS.ja.exportHowItWorks, '「CSVを書き出す」を押したあと、保存先やアプリを選ぶと、選んだアプリが完了をお知らせします。')
  assert.equal('toastExported' in STRINGS.ja, false)
})
