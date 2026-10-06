// Sprint 19b 評価（kaomoji-diary_sprint-19b_eval.md）の不具合 #1〜#4 の再現テスト。
// 実際のストアと模擬の保存先・通知API で、評価レポートの手順どおりに非同期の順番を作って確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, entry, freeState, q, deferred, delayedSchedule, tick } from './helpers'
import { analyzeImportFile } from '@/domain/csv/importer'
import { encodeUtf8 } from '@/domain/csv/utf8'

const TODAY = '2026-10-07'

// ── #1 通知の整理中の ON 操作 ───────────────────────

test('#1 整理（一覧の取得待ち）の最中に ON にしても、ID がストアに入る前の新しい通知 n_new は消さない', async () => {
  const storage = new MemoryStorage()
  storage.putState({
    entries: [entry('2026-10-01', 'q1')],
    settings: { questions: 'broken', activeQuestionId: 'q1', language: 'ja', theme: 'system' },
    isOnboardingDone: true,
  })
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  notifier.failList = true // 起動時の整理は失敗 → 整理待ちが残る
  const s = await boot(storage, notifier)
  await s.getState().recoverQuestion('禁煙')
  assert.equal(s.getState().notificationCleanupPending, true)

  notifier.failList = false
  const listGate = deferred()
  notifier.listGate = listGate.promise
  const scheduleGate = deferred()
  // 起動時と同じ整理を始める（一覧の取得を待たせる）
  const maintenance = s.getState().processNotificationMaintenance()
  await tick()
  // ON 操作（予約すると一覧には入るが、ID が返るのは後）
  const on = s.getState().scheduleQuestionReminder('q1', delayedSchedule(notifier, 'n_new', scheduleGate.promise))
  await tick()
  listGate.resolve()
  await tick()
  scheduleGate.resolve()
  await maintenance
  assert.equal(await on, 'scheduled')
  await s.getState().flushWrites()

  assert.deepEqual(notifier.cancelCalls, ['n_old'])
  assert.deepEqual([...notifier.scheduled], ['n_new'])
  const qq = s.getState().settings.questions[0]
  assert.equal(qq.reminderEnabled, true)
  assert.equal(qq.notificationId, 'n_new')
  assert.equal(s.getState().notificationCleanupPending, false)
})

test('#1 先に ON の予約が始まっていたら、整理は予約が終わる（ID が入る）まで待つ', async () => {
  const storage = new MemoryStorage()
  storage.putState({
    entries: [],
    settings: { questions: [], activeQuestionId: '', language: 'ja', theme: 'system' },
    isOnboardingDone: true,
  })
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  notifier.failList = true
  const s = await boot(storage, notifier)
  await s.getState().recoverQuestion('禁煙')
  const qid = s.getState().settings.activeQuestionId
  notifier.failList = false

  const scheduleGate = deferred()
  const on = s.getState().scheduleQuestionReminder(qid, delayedSchedule(notifier, 'n_new', scheduleGate.promise))
  await tick()
  const maintenance = s.getState().processNotificationMaintenance()
  await tick()
  scheduleGate.resolve()
  await on
  await maintenance
  assert.deepEqual([...notifier.scheduled], ['n_new'])
  assert.equal(s.getState().settings.questions[0].notificationId, 'n_new')
})

// ── #2 リセットと処理中の予約 ───────────────────────

test('#2 リセット前に始めた ON の予約は、リセット後に終わっても通知を残さない（解除する）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1')]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)

  const epoch = s.getState().getNotificationEpoch() // ON 操作を始めた時点
  const gate = deferred()
  const on = s.getState().scheduleQuestionReminder('q1', delayedSchedule(notifier, 'n_race', gate.promise), { epoch })
  await tick()
  await s.getState().resetAllData()
  gate.resolve()
  assert.equal(await on, 'discarded')
  await s.getState().flushWrites()

  assert.deepEqual([...notifier.scheduled], [], '予約済みの通知は残らない')
  assert.deepEqual(s.getState().settings.questions, [])
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])

  // リセット後の新しい問いの通知は残る
  await s.getState().completeOnboarding('運動', 'ja', true)
  const newId = s.getState().settings.activeQuestionId
  const r = await s.getState().scheduleQuestionReminder(newId, async () => {
    notifier.schedule('n_after')
    return 'n_after'
  })
  assert.equal(r, 'scheduled')
  assert.deepEqual([...notifier.scheduled], ['n_after'])
})

test('#2 許可の確認を待っている間（予約の前）にリセットされたら、予約そのものをしない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const epoch = s.getState().getNotificationEpoch()
  await s.getState().resetAllData()
  await s.getState().completeOnboarding('禁煙', 'ja', false)
  const calls: string[] = []
  const r = await s.getState().scheduleQuestionReminder(
    s.getState().settings.activeQuestionId,
    delayedSchedule(notifier, 'n_x', Promise.resolve(), calls),
    { epoch },
  )
  assert.equal(r, 'discarded')
  assert.deepEqual(calls, [])
  assert.deepEqual([...notifier.scheduled], [])
})

test('#2 リセット前に始めた OFF 操作は、リセット後の状態を書き換えない', async () => {
  const storage = new MemoryStorage()
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n1' })
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.schedule('n1')
  const s = await boot(storage, notifier)
  const epoch = s.getState().getNotificationEpoch()
  await s.getState().resetAllData()
  await s.getState().disableQuestionReminder('q1', { epoch })
  assert.deepEqual(s.getState().settings.questions, [])
  assert.deepEqual([...notifier.scheduled], [])
})

test('予約の途中で後から別の操作（OFF）が入ったら、予約した通知を解除して OFF にする（最後の操作が残る）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  let latest = 1
  const gate = deferred()
  const on = s.getState().scheduleQuestionReminder('q1', delayedSchedule(notifier, 'n_on', gate.promise), {
    isLatest: () => latest === 1,
  })
  await tick()
  latest = 2
  const off = s.getState().disableQuestionReminder('q1', { isLatest: () => latest === 2 })
  gate.resolve()
  assert.equal(await on, 'discarded')
  await off
  assert.deepEqual([...notifier.scheduled], [])
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(s.getState().settings.questions[0].notificationId, undefined)
})

test('時刻の変更: 古い通知を解除して新しい時刻で予約し直す', async () => {
  const storage = new MemoryStorage()
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n_old', reminderTime: '21:00' })
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)
  let scheduledTime = ''
  const r = await s.getState().scheduleQuestionReminder(
    'q1',
    async (qq) => {
      scheduledTime = qq.reminderTime
      notifier.schedule('n_7')
      return 'n_7'
    },
    { reminderTime: '07:00' },
  )
  assert.equal(r, 'scheduled')
  assert.equal(scheduledTime, '07:00')
  assert.deepEqual([...notifier.scheduled], ['n_7'])
  assert.equal(s.getState().settings.questions[0].reminderTime, '07:00')
})

// ── #3 不正な引用符 ─────────────────────────────────

for (const bad of ['a"b', 'abc"unterminated', '"', 'x""y']) {
  for (const mode of ['add', 'replace'] as const) {
    test(`#3 引用していない値の中の " （${bad}）は全体を失敗にし、「${mode}」でも記録は変わらない`, async () => {
      const storage = new MemoryStorage()
      storage.putState(freeState([entry('2026-09-01', 'q1', 3, 'keep')]))
      const s = await boot(storage, new MockNotifier())
      const before = JSON.stringify(storage.stored().entries)
      const r = analyzeImportFile(
        encodeUtf8(`date,question_no,question,level,comment\r\n2026-10-01,1,label,5,${bad}\r\n`),
        TODAY,
      )
      assert.deepEqual(r, { ok: false, error: 'unparsable' })
      // 読み込み画面と同じく、判定が通ったときだけ実行する
      const res = r as Awaited<ReturnType<typeof analyzeImportFile>>
      if (res.ok) await s.getState().importEntries(res.analysis.records, mode)
      assert.equal(JSON.stringify(s.getState().entries), before)
      assert.equal(JSON.stringify(storage.stored().entries), before)
    })
  }
}

// ── #4 旧分割データ ─────────────────────────────────

const bigComment = 'z'.repeat(1500)
const CHUNK = 300 // 初期状態（約 220 文字）は1つのキーに収まり、記録が入ると分割される大きさ

test('#4 分割保存の後に全データリセットすると、旧分割データ（チャンク）が残らない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), CHUNK)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, bigComment)
  assert.ok(storage.chunkKeys().length >= 5)
  await s.getState().resetAllData()
  assert.deepEqual(storage.chunkKeys(), [])
  assert.ok(!JSON.stringify([...storage.data.values()]).includes(bigComment), '旧記録の内容が保存先に残らない')
})

test('#4 分割の数が減ったら（置き換え）、使わなくなったチャンクを消す', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), CHUNK)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, bigComment)
  await s.getState().saveEntry('2026-10-02', 'q1', 4, bigComment)
  const many = storage.chunkKeys().length
  await s.getState().importEntries([{ date: '2026-09-01', level: 1, comment: 'y'.repeat(150) }], 'replace')
  const head = JSON.parse(storage.data.get('diary_entries')!)
  const kept = storage.chunkKeys()
  assert.ok(kept.length < many)
  assert.equal(kept.length, head.__chunked, '目印が指す数だけ残る')
  const s2 = await boot(storage, new MockNotifier(), CHUNK)
  assert.equal(s2.getState().entries.length, 1)
})

test('#4 チャンクを消せなかった（失敗・途中終了）場合も有効な状態は変わらず、次の起動で消す', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), CHUNK)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, bigComment)
  storage.failRemoves = true
  await s.getState().resetAllData() // 書き込みは成功、消すのは失敗
  assert.ok(storage.chunkKeys().length > 0)
  storage.failRemoves = false
  const s2 = await boot(storage, new MockNotifier(), CHUNK)
  assert.deepEqual(s2.getState().entries, [])
  assert.equal(s2.getState().isOnboardingDone, false)
  assert.deepEqual(storage.chunkKeys(), [], '次の起動で消す')
})

test('#4 新しい状態の書き込みに失敗したときは、旧チャンクを消さず元の状態のまま読める', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), CHUNK)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, bigComment)
  const keys = storage.chunkKeys()
  storage.failWrites = true
  await assert.rejects(s.getState().resetAllData())
  storage.failWrites = false
  assert.deepEqual(storage.chunkKeys(), keys)
  const s2 = await boot(storage, new MockNotifier(), CHUNK)
  assert.equal(s2.getState().entries[0].comment, bigComment)
})
