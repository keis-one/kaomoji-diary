// Sprint 19a 追補（A1〜A3）の受け入れ基準 [自動]。
// 保存先（AsyncStorage）と通知APIを模擬にし、実際のストアで「読み込み（起動）→操作→読み込み直し」を行う。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, q, entry, freeState } from './helpers'
import { needsQuestionRecovery } from '../persisted'
import { buildExportRows } from '@/domain/csv/format'

const CUSTOM = { 1: 'orz', 2: 'a', 3: 'b', 4: 'c', 5: 'd' }

// preview 版の保存データ（問い q1〔通知 n1〕・q2〔通知 n2〕、2つ目を使用中、isPremium）
const previewState = (extraQuestions: any[] = []) => ({
  entries: [entry('2026-10-01', 'q1'), entry('2026-10-01', 'q2'), entry('2026-10-02', 'q3')],
  settings: {
    questions: [
      { ...q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n1' }), kaomojiSet: CUSTOM },
      { ...q('q2', { label: '運動', reminderEnabled: true, notificationId: 'n2' }), kaomojiSet: CUSTOM },
      ...extraQuestions,
    ],
    activeQuestionId: 'q2',
    language: 'ja',
    theme: 'system',
    isPremium: true,
  },
  isOnboardingDone: true,
})

// ── A1 ──────────────────────────────────────────────

test('A1-1 取り消しに失敗した通知は、設定を保存した後の読み込み直しで再試行する（n1 は取り消さない）', async () => {
  const storage = new MemoryStorage()
  storage.putState(previewState())
  const notifier = new MockNotifier()
  notifier.schedule('n1')
  notifier.schedule('n2')

  // (2) n2 の取り消しが失敗する状態で読み込む
  notifier.failCancel.add('n2')
  const s1 = await boot(storage, notifier)
  assert.equal(notifier.callsFor('n2'), 1)
  // (3) テーマの変更（設定を保存する操作）
  s1.getState().updateSettings({ theme: 'dark' })
  await s1.getState().flushWrites()
  assert.equal(storage.stored().settings.theme, 'dark')
  assert.equal(storage.stored().settings.questions.length, 1)

  // (4) 成功する状態に戻して読み込み直す
  notifier.failCancel.delete('n2')
  const before = notifier.callsFor('n2')
  await boot(storage, notifier)
  assert.equal(notifier.callsFor('n2'), before + 1, '読み込み直しで n2 の取り消しがもう一度呼ばれる')
  assert.equal(notifier.scheduled.has('n2'), false)
  assert.equal(notifier.callsFor('n1'), 0, 'n1 はどの段階でも取り消されない')
  assert.equal(notifier.scheduled.has('n1'), true)
})

test('A1-2 成功するまで続け、成功したら解除待ちから消えて呼ばれなくなる', async () => {
  const storage = new MemoryStorage()
  storage.putState(previewState())
  const notifier = new MockNotifier()
  notifier.schedule('n1')
  notifier.schedule('n2')
  notifier.failCancel.add('n2')

  for (let round = 0; round < 2; round++) {
    const s = await boot(storage, notifier)
    s.getState().updateSettings({ theme: round === 0 ? 'dark' : 'light' })
    await s.getState().flushWrites()
  }
  const failedCalls = notifier.callsFor('n2')
  assert.ok(failedCalls >= 2)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, ['n2'])

  notifier.failCancel.delete('n2')
  await boot(storage, notifier) // 3回目: 成功
  assert.equal(notifier.callsFor('n2'), failedCalls + 1)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])

  await boot(storage, notifier) // 4回目: 呼ばれない
  assert.equal(notifier.callsFor('n2'), failedCalls + 1)
  assert.equal(notifier.callsFor('n1'), 0)
})

test('A1 解除待ちの通知IDは書き込みに失敗しても、次の起動で元の保存データから作り直されて再試行される', async () => {
  const storage = new MemoryStorage()
  storage.putState(previewState())
  const notifier = new MockNotifier()
  notifier.failCancel.add('n2')
  storage.failWrites = true
  await boot(storage, notifier)
  storage.failWrites = false
  notifier.failCancel.clear()
  await boot(storage, notifier)
  assert.equal(notifier.callsFor('n2'), 2)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])
})

// ── A2 ──────────────────────────────────────────────

const threeQuestionPreview = () => {
  const s = previewState([q('q3', { label: '勉強' })])
  s.settings.questions[1].notificationId = undefined as any
  return s
}

test('A2-1 外した問いの文言と並び順が、設定の保存・読み込み直しの後も残る。画面に出る問いは q1 だけ。記録は全件残る', async () => {
  const storage = new MemoryStorage()
  storage.putState(threeQuestionPreview())
  const notifier = new MockNotifier()
  const s1 = await boot(storage, notifier)
  s1.getState().updateSettings({ theme: 'dark' })
  await s1.getState().flushWrites()

  const s2 = await boot(storage, notifier)
  const st = s2.getState()
  assert.deepEqual(st.retiredQuestions, [
    { id: 'q2', label: '運動', order: 2 },
    { id: 'q3', label: '勉強', order: 3 },
  ])
  assert.deepEqual(st.settings.questions.map((x) => x.id), ['q1'])
  assert.equal(st.settings.activeQuestionId, 'q1')
  assert.equal(st.entries.length, 3)
  assert.equal(storage.stored().entries.length, 3)
})

test('A2-2 冪等: 正規化済みの保存データを何度読み込み直しても、外した問いの情報と並び順は変わらない', async () => {
  const storage = new MemoryStorage()
  storage.putState(threeQuestionPreview())
  const notifier = new MockNotifier()
  await boot(storage, notifier)
  const first = JSON.stringify(storage.stored())
  for (let i = 0; i < 3; i++) {
    const s = await boot(storage, notifier)
    s.getState().updateSettings({ language: 'ja' })
    await s.getState().flushWrites()
  }
  assert.equal(JSON.stringify(storage.stored()), first)
})

// ── A3 ──────────────────────────────────────────────

const brokenVariants: Record<string, unknown> = {
  '(a) 文字列 "broken"': 'broken',
  '(b) 空の配列': [],
  '(c) 文言が空の問い1つ': [q('q1', { label: '', reminderEnabled: true, notificationId: 'n1' })],
}

const brokenState = (questions: unknown) => ({
  entries: [entry('2026-10-01', 'q1', 4), entry('2026-10-02', 'q1', 2)],
  settings: { questions, activeQuestionId: 'q1', language: 'en', theme: 'dark' },
  isOnboardingDone: true,
})

for (const [name, questions] of Object.entries(brokenVariants)) {
  test(`A3-1 壊れた問い設定でも記録を消さない ${name}`, async () => {
    const storage = new MemoryStorage()
    storage.putState(brokenState(questions))
    const notifier = new MockNotifier()
    const s = await boot(storage, notifier)
    const st = s.getState()
    assert.equal(st.entries.length, 2, 'メモリの記録は2件のまま')
    assert.equal(storage.stored().entries.length, 2, '保存先の記録も2件のまま')
    assert.equal(st.settings.language, 'en')
    assert.equal(st.settings.theme, 'dark')
    assert.equal(needsQuestionRecovery(st), true, '問いの入力画面へ進む判定')
    assert.equal(st.isOnboardingDone, true)
  })
}

test('A3-2 問い「禁煙」を入力すると問いIDが q1 になり、2件の記録がその問いの記録として取り出せる。リマインダーは OFF', async () => {
  const storage = new MemoryStorage()
  storage.putState(brokenState([q('q1', { label: '', reminderEnabled: true, notificationId: 'n1' })]))
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  await s.getState().recoverQuestion('禁煙')
  const st = s.getState()
  assert.equal(st.settings.activeQuestionId, 'q1')
  assert.equal(st.settings.questions[0].label, '禁煙')
  assert.equal(st.settings.questions[0].reminderEnabled, false)
  assert.equal(st.entries.filter((e) => e.questionId === 'q1').length, 2)
  assert.equal(needsQuestionRecovery(st), false)
  // 読み込み直しても同じ
  const s2 = await boot(storage, notifier)
  assert.equal(s2.getState().settings.activeQuestionId, 'q1')
  assert.equal(needsQuestionRecovery(s2.getState()), false)
})

test('A3-3 複数の問いの記録があるとき: 最も新しい日付、同じ日は問いIDの辞書順で先を引き継ぐ。ほかの記録も残る', async () => {
  const storage = new MemoryStorage()
  storage.putState({
    entries: [
      entry('2026-10-03', 'q2'),
      entry('2026-10-03', 'q1'),
      entry('2026-10-01', 'q3'),
      entry('2026-10-02', 'q1'),
    ],
    settings: { questions: [], activeQuestionId: '', language: 'ja', theme: 'system' },
    isOnboardingDone: true,
  })
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  await s.getState().recoverQuestion('禁煙')
  assert.equal(s.getState().settings.activeQuestionId, 'q1')
  assert.equal(s.getState().entries.filter((e) => e.questionId === 'q1').length, 2)
  assert.equal(storage.stored().entries.length, 4, 'q2・q3 の記録も保存先に残る')
})

test('A3-3 追加: q2（2026-10-05）・q1（2026-10-03）なら日付が優先で q2', async () => {
  const storage = new MemoryStorage()
  storage.putState({
    entries: [entry('2026-10-05', 'q2'), entry('2026-10-03', 'q1')],
    settings: { questions: [], activeQuestionId: '', language: 'ja', theme: 'system' },
    isOnboardingDone: true,
  })
  const s = await boot(storage, new MockNotifier())
  await s.getState().recoverQuestion('禁煙')
  assert.equal(s.getState().settings.activeQuestionId, 'q2')
})

test('A3 記録が1件も無ければ新しい問いIDで作る', async () => {
  const storage = new MemoryStorage()
  storage.putState({ entries: [], settings: { questions: 'broken' }, isOnboardingDone: true })
  const s = await boot(storage, new MockNotifier())
  await s.getState().recoverQuestion('禁煙')
  assert.match(s.getState().settings.activeQuestionId, /^q_new_/)
})

test('A3 引き継いだ問いIDが外した問いの一覧にもあれば、一覧から除く（いまの問いとして扱う）', async () => {
  const storage = new MemoryStorage()
  storage.putState({
    entries: [entry('2026-10-05', 'q2')],
    settings: { questions: [], activeQuestionId: '', language: 'ja', theme: 'system' },
    retiredQuestions: [{ id: 'q2', label: '運動', order: 2 }, { id: 'q3', label: '勉強', order: 3 }],
    isOnboardingDone: true,
  })
  const s = await boot(storage, new MockNotifier())
  await s.getState().recoverQuestion('禁煙')
  assert.deepEqual(s.getState().retiredQuestions.map((r) => r.id), ['q3'])
  // 書き出しでは q2 の記録は question_no = 1・いまの文言
  const rows = buildExportRows(s.getState())
  assert.equal(rows[0].questionNo, 1)
  assert.equal(rows[0].question, '禁煙')
})

test('A3-4 (1) 文言が空の問い（通知 n1）で復旧: n1 を取り消し、リマインダー OFF・予約された通知は0件', async () => {
  const storage = new MemoryStorage()
  storage.putState(brokenState([q('q1', { label: '', reminderEnabled: true, notificationId: 'n1' })]))
  const notifier = new MockNotifier()
  notifier.schedule('n1')
  const s = await boot(storage, notifier)
  assert.equal(notifier.callsFor('n1') >= 1, true)
  await s.getState().recoverQuestion('禁煙')
  assert.equal(s.getState().settings.questions[0].reminderEnabled, false)
  assert.equal(notifier.scheduled.size, 0)
  assert.equal(storage.stored().notificationCleanupPending, false)
})

test('A3-4 (2) 取り消しが失敗する状態で復旧 → ON にした新しい通知は残し、古い通知だけを後で整理する', async () => {
  const storage = new MemoryStorage()
  storage.putState(brokenState('broken'))
  const notifier = new MockNotifier()
  notifier.schedule('n_old_a') // ID が分からない古い通知
  notifier.schedule('n_old_b')
  notifier.failAllCancels = true

  const s1 = await boot(storage, notifier)
  assert.equal(storage.stored().notificationCleanupPending, true, '整理待ちの印が保存される')
  await s1.getState().recoverQuestion('禁煙')
  // リマインダーを ON にする（新しい通知 n_new）
  notifier.failAllCancels = false
  notifier.schedule('n_new')
  s1.getState().updateQuestion(s1.getState().settings.activeQuestionId, { reminderEnabled: true, notificationId: 'n_new' })
  await s1.getState().flushWrites()
  notifier.cancelCalls.length = 0

  // 取り消しが成功する状態で読み込み直す
  const s2 = await boot(storage, notifier)
  assert.deepEqual([...notifier.scheduled], ['n_new'], '予約された通知は n_new だけ')
  assert.equal(notifier.callsFor('n_new'), 0, 'n_new は取り消されない')
  assert.equal(s2.getState().settings.questions[0].reminderEnabled, true)
  assert.equal(storage.stored().notificationCleanupPending, false)

  // その後の読み込みでは整理が行われない
  notifier.cancelCalls.length = 0
  notifier.schedule('n_other_later')
  await boot(storage, notifier)
  assert.deepEqual(notifier.cancelCalls, [])
})

test('正常な無料版の保存データでは問いの入力し直しにならず、整理も行わない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1')]))
  const notifier = new MockNotifier()
  notifier.schedule('x')
  const s = await boot(storage, notifier)
  assert.equal(needsQuestionRecovery(s.getState()), false)
  assert.deepEqual(notifier.cancelCalls, [])
})

test('保存先から読み込めない（例外）ときは、どの画面にも進まず記録を上書きしない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1')]))
  storage.failReads = true
  const s = await boot(storage, new MockNotifier())
  assert.equal(s.getState().hydrated, false)
  assert.equal(s.getState().hydrationError, true)
  await assert.rejects(s.getState().saveEntry('2026-10-02', 'q1', 3, ''))
  assert.equal(storage.stored().entries.length, 1)
})

test('JSON として読めない保存データは退避してから初期状態で始める', async () => {
  const storage = new MemoryStorage()
  storage.data.set('diary_entries', '{broken json')
  const s = await boot(storage, new MockNotifier())
  assert.equal(s.getState().hydrated, true)
  assert.equal(storage.data.get('diary_entries_unreadable_backup'), '{broken json')
})
