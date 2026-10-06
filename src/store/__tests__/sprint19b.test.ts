// Sprint 19b の受け入れ基準 [自動]（カレンダーの記録・削除、読み込みの反映、全データリセット）。
// 保存先と通知APIを模擬にした実際のストアで確認する。「今日」は 2026-10-07 に固定する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, entry, freeState, q, sortEntries } from './helpers'
import { calcStreak, shouldShowStreak, homeButtonMode, findEntry } from '@/domain/entries'
import { checkCommentEdit } from '@/domain/dayEditor'
import { analyzeImportFile } from '@/domain/csv/importer'
import { buildExportCsv } from '@/domain/csv/format'
import { encodeUtf8 } from '@/domain/csv/utf8'
import { submitDayEntry, deleteDayEntry } from '@/domain/dayActions'
import { needsQuestionRecovery } from '../persisted'

const TODAY = '2026-10-07'

const activeDates = (s: { getState: () => any }) =>
  s.getState().entries.filter((e: any) => e.questionId === 'q1').map((e: any) => e.date)

// ── カレンダーの今日・過去日 ─────────────────────────

test('記録の削除: いまの問いの 10/01 だけが消え、10/02 と画面に出ない q2 の 10/01 は残る（保存先も同じ）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1'), entry('2026-10-02', 'q1'), entry('2026-10-01', 'q2')]))
  const s = await boot(storage, new MockNotifier())
  await s.getState().deleteEntry('2026-10-01', 'q1')
  const expected = sortEntries([entry('2026-10-02', 'q1'), entry('2026-10-01', 'q2')])
  assert.deepEqual(sortEntries(s.getState().entries), expected)
  assert.deepEqual(sortEntries(storage.stored().entries), expected)
})

test('過去日の範囲: 2020-01-15 に記録を保存でき、読み込み直しても取り出せる', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier())
  await s.getState().saveEntry('2020-01-15', 'q1', 4, '昔')
  const s2 = await boot(storage, new MockNotifier())
  assert.deepEqual(findEntry(s2.getState().entries, '2020-01-15', 'q1'), entry('2020-01-15', 'q1', 4, '昔'))
})

test('今日の削除: 2026-10-07 の記録を削除すると、ホームは「記録が無い」状態の判定になる', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry(TODAY, 'q1', 5)]))
  const s = await boot(storage, new MockNotifier())
  assert.equal(homeButtonMode(findEntry(s.getState().entries, TODAY, 'q1')), 'edit')
  const r = await deleteDayEntry(s.getState().deleteEntry, TODAY, 'q1')
  assert.deepEqual(r, { ok: true, toast: 'deleted' })
  assert.equal(homeButtonMode(findEntry(s.getState().entries, TODAY, 'q1')), 'record')
})

test('連続記録: 10/05〜10/07 で 3 → 10/06 を削除すると 1（ホームでは表示しない）→ 記録し直すと 3', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-05', 'q1'), entry('2026-10-06', 'q1'), entry(TODAY, 'q1')]))
  const s = await boot(storage, new MockNotifier())
  assert.equal(calcStreak(activeDates(s), TODAY), 3)
  await s.getState().deleteEntry('2026-10-06', 'q1')
  const afterDelete = calcStreak(activeDates(s), TODAY)
  assert.equal(afterDelete, 1)
  assert.equal(shouldShowStreak(afterDelete), false)
  await s.getState().saveEntry('2026-10-06', 'q1', 3, '')
  assert.equal(calcStreak(activeDates(s), TODAY), 3)
})

test('連続記録: 月・年をまたいでも数えられ、今日の記録が無ければ 0', () => {
  assert.equal(calcStreak(['2025-12-31', '2026-01-01'], '2026-01-01'), 2)
  assert.equal(calcStreak(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01'), 3)
  assert.equal(calcStreak(['2026-10-06'], TODAY), 0)
})

test('保存・削除の失敗: 書き込みが失敗すると、メモリと保存先の記録は操作前のまま、成功のトーストを出す判定にならない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1', 2, 'before')]))
  const s = await boot(storage, new MockNotifier())
  const beforeMem = JSON.stringify(s.getState().entries)
  const beforeStored = JSON.stringify(storage.stored().entries)
  storage.failWrites = true

  const saveNew = await submitDayEntry(s.getState().saveEntry, { date: '2026-10-02', questionId: 'q1', level: 5, comment: '', hadEntry: false })
  const saveExisting = await submitDayEntry(s.getState().saveEntry, { date: '2026-10-01', questionId: 'q1', level: 5, comment: 'x', hadEntry: true })
  const del = await deleteDayEntry(s.getState().deleteEntry, '2026-10-01', 'q1')
  assert.deepEqual(saveNew, { ok: false, error: 'saveFailed' })
  assert.deepEqual(saveExisting, { ok: false, error: 'saveFailed' })
  assert.deepEqual(del, { ok: false, error: 'deleteFailed' })
  assert.equal(JSON.stringify(s.getState().entries), beforeMem)
  assert.equal(JSON.stringify(storage.stored().entries), beforeStored)

  // もう一度押せば再試行できる
  storage.failWrites = false
  const retry = await submitDayEntry(s.getState().saveEntry, { date: '2026-10-02', questionId: 'q1', level: 5, comment: '', hadEntry: false })
  assert.deepEqual(retry, { ok: true, toast: 'recorded' })
  const retry2 = await submitDayEntry(s.getState().saveEntry, { date: '2026-10-01', questionId: 'q1', level: 5, comment: '', hadEntry: true })
  assert.deepEqual(retry2, { ok: true, toast: 'saved' })
})

test('長い一言の保持: (a) 顔文字だけ変えて保存 → 全文のまま (b) キャンセル → 変わらない (c) 書き出すと完全一致 (d) 1文字変えると保存できない判定', async () => {
  const long = 'あ'.repeat(50) + '\n' + 'い'.repeat(49) + '\n' + 'う'.repeat(49) // 150文字・改行2つ
  assert.equal(Array.from(long).length, 150)
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier())
  const csv = `date,question_no,question,level,comment\r\n2026-10-01,1,禁煙,3,"${long}"\r\n`
  const analyzed = analyzeImportFile(encodeUtf8(csv), TODAY)
  assert.ok(analyzed.ok)
  if (!analyzed.ok) return
  await s.getState().importEntries(analyzed.analysis.records, 'add')
  const original = findEntry(s.getState().entries, '2026-10-01', 'q1')!.comment
  assert.equal(original, long)

  // (b) 顔文字を変えてキャンセル（保存を呼ばない）→ 読み込み直後のまま
  assert.equal(findEntry(s.getState().entries, '2026-10-01', 'q1')!.level, 3)

  // (a) 一言は変えずに顔文字だけ変えて保存
  const check = checkCommentEdit(original, original)
  assert.equal(check.ok, true)
  await s.getState().saveEntry('2026-10-01', 'q1', 5, original)
  const saved = findEntry(s.getState().entries, '2026-10-01', 'q1')!
  assert.equal(saved.comment, long)
  assert.equal(saved.level, 5)

  // (c) 書き出すと comment が完全に一致
  const exported = buildExportCsv(s.getState())
  const again = analyzeImportFile(encodeUtf8(exported), TODAY)
  assert.ok(again.ok)
  if (again.ok) assert.equal(again.analysis.records[0].comment, long)

  // (d) 一言を1文字変えると、101文字以上のままでは保存できない
  const edited = long.slice(0, -1) + 'え'
  const d = checkCommentEdit(original, edited)
  assert.equal(d.ok, false)
  assert.equal(d.tooLong, true)
  assert.equal(d.length, 150)
})

// ── 読み込みの反映 ────────────────────────────────────

const importFile = (lines: string[]) => {
  const r = analyzeImportFile(encodeUtf8(['date,question_no,question,level,comment', ...lines].join('\r\n') + '\r\n'), TODAY)
  assert.ok(r.ok)
  return r.ok ? r.analysis : (null as never)
}

test('往復: 書き出した CSV を、記録を全部消した状態に「すべて置き換える」で読み込むと question_no = 1 の記録が一致する', async () => {
  const storage = new MemoryStorage()
  const original = [
    entry('2026-09-01', 'q1', 1, 'a,b'),
    entry('2026-09-02', 'q1', 5, '1行目\r\n2行目'),
    entry('2026-09-03', 'q1', 3, '"quoted"'),
    entry('2026-09-03', 'q2', 4, 'hidden'),
  ]
  storage.putState(freeState(original, { retiredQuestions: [{ id: 'q2', label: '運動', order: 2 }] }))
  const s = await boot(storage, new MockNotifier())
  const csv = buildExportCsv(s.getState())
  // 全データリセットの後、オンボーディングで問いを作った状態
  await s.getState().resetAllData()
  await s.getState().completeOnboarding('新しい問い', 'ja', false)
  const analyzed = analyzeImportFile(encodeUtf8(csv), TODAY)
  assert.ok(analyzed.ok)
  if (!analyzed.ok) return
  await s.getState().importEntries(analyzed.analysis.records, 'replace')
  const qid = s.getState().settings.activeQuestionId
  const got = s.getState().entries.map(({ date, level, comment }) => ({ date, level, comment }))
  const want = original.filter((e) => e.questionId === 'q1').map(({ date, level, comment }) => ({ date, level, comment }))
  assert.deepEqual(got, want)
  assert.ok(s.getState().entries.every((e) => e.questionId === qid))
  assert.equal(s.getState().settings.questions[0].label, '新しい問い', '問いの文言は変わらない')
})

test('「いまの記録に追加」: 読み込み後に保存データから読み込み直しても同じ', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1', 1), entry('2026-10-02', 'q1', 1), entry('2026-10-01', 'q2', 2)]))
  const s = await boot(storage, new MockNotifier())
  const a = importFile(['2026-10-02,1,禁煙,5,new', '2026-10-03,1,禁煙,4,add'])
  await s.getState().importEntries(a.records, 'add')
  const s2 = await boot(storage, new MockNotifier())
  assert.deepEqual(sortEntries(s2.getState().entries), sortEntries([
    entry('2026-10-01', 'q1', 1),
    entry('2026-10-02', 'q1', 5, 'new'),
    entry('2026-10-03', 'q1', 4, 'add'),
    entry('2026-10-01', 'q2', 2),
  ]))
})

test('「すべて置き換える」: 画面に出ない記録も消え、問い・リマインダー・言語・テーマ・外した問いは変わらない（読み込み直しても同じ）', async () => {
  const storage = new MemoryStorage()
  const st = freeState([entry('2026-10-01', 'q1'), entry('2026-10-01', 'q2')], {
    retiredQuestions: [{ id: 'q2', label: '運動', order: 2 }],
  }) as any
  st.settings.questions[0] = q('q1', { label: '運動したい', reminderEnabled: true, reminderTime: '07:00', notificationId: 'n1' })
  st.settings.language = 'en'
  st.settings.theme = 'dark'
  storage.putState(st)
  const s = await boot(storage, new MockNotifier())
  const before = JSON.stringify(s.getState().settings)
  await s.getState().importEntries(importFile(['2026-09-01,1,禁煙,2,x']).records, 'replace')
  const s2 = await boot(storage, new MockNotifier())
  assert.deepEqual(s2.getState().entries, [entry('2026-09-01', 'q1', 2, 'x')])
  assert.equal(JSON.stringify(s2.getState().settings), before)
  assert.deepEqual(s2.getState().retiredQuestions, [{ id: 'q2', label: '運動', order: 2 }])
})

for (const mode of ['add', 'replace'] as const) {
  test(`読み込みの保存の失敗（${mode}）: メモリ・保存データとも実行前のまま、失敗の判定（例外）になる`, async () => {
    const storage = new MemoryStorage()
    storage.putState(freeState([entry('2026-10-01', 'q1', 3, 'keep'), entry('2026-10-01', 'q2')]))
    const s = await boot(storage, new MockNotifier())
    const beforeMem = JSON.stringify(s.getState().entries)
    storage.failWrites = true
    await assert.rejects(s.getState().importEntries(importFile(['2026-10-01,1,禁煙,5,new', '2026-10-02,1,禁煙,4,']).records, mode))
    assert.equal(JSON.stringify(s.getState().entries), beforeMem)
    storage.failWrites = false
    const s2 = await boot(storage, new MockNotifier())
    assert.equal(JSON.stringify(s2.getState().entries), beforeMem)
  })
}

// ── 全データリセット ──────────────────────────────────

test('リセット: 記録（画面に出ない記録を含む）・問い・リマインダー・言語・テーマ・外した問いが初期状態。通知IDは解除待ちに入り解除される', async () => {
  const storage = new MemoryStorage()
  const st = freeState([entry('2026-10-01', 'q1'), entry('2026-10-01', 'q2')], {
    retiredQuestions: [{ id: 'q2', label: '運動', order: 2 }],
    pendingNotificationCancelIds: ['n_older'],
  }) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n1' })
  st.settings.language = 'en'
  st.settings.theme = 'dark'
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.failCancel.add('n_older') // 起動時の解除は失敗させ、リセットで解除されることを見る
  notifier.schedule('n1')
  const s = await boot(storage, notifier)
  notifier.failCancel.clear()
  await s.getState().resetAllData()

  const s2 = await boot(storage, notifier)
  const r = s2.getState()
  assert.deepEqual(r.entries, [])
  assert.deepEqual(r.settings.questions, [])
  assert.equal(r.settings.language, 'ja')
  assert.equal(r.settings.theme, 'system')
  assert.equal(r.isOnboardingDone, false)
  assert.deepEqual(r.retiredQuestions, [])
  assert.equal(needsQuestionRecovery(r), false, '問いの入力し直しではなくオンボーディングへ')
  assert.ok(notifier.callsFor('n1') >= 1)
  assert.ok(notifier.callsFor('n_older') >= 2)
  assert.deepEqual(r.pendingNotificationCancelIds, [])
})

test('リセットの保存の失敗: メモリ・保存データともリセット前のまま、通知の解除は呼ばれない。後で保存できる状態で再起動すると通常どおり', async () => {
  const storage = new MemoryStorage()
  const st = freeState([entry('2026-10-01', 'q1')]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n1' })
  storage.putState(st)
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  const beforeMem = JSON.stringify({ e: s.getState().entries, s: s.getState().settings })
  const beforeStored = JSON.stringify(storage.stored())
  storage.failWrites = true
  await assert.rejects(s.getState().resetAllData())
  assert.equal(JSON.stringify({ e: s.getState().entries, s: s.getState().settings }), beforeMem)
  assert.equal(s.getState().isOnboardingDone, true, '言語選択へ進まない')
  assert.equal(JSON.stringify(storage.stored()), beforeStored)
  assert.equal(notifier.callsFor('n1'), 0)
  storage.failWrites = false
  const s2 = await boot(storage, notifier)
  assert.equal(s2.getState().isOnboardingDone, true)
  assert.equal(s2.getState().entries.length, 1)
})

test('リセットの通知の順番: 解除が失敗→オンボーディングで ON（n_new）→成功する状態で読み込み直すと n_old だけ解除。次の読み込みでは解除しない', async () => {
  const storage = new MemoryStorage()
  const st = freeState([]) as any
  st.settings.questions[0] = q('q1', { label: '禁煙', reminderEnabled: true, notificationId: 'n_old' })
  storage.putState(st)
  const notifier = new MockNotifier()
  notifier.schedule('n_old')
  const s = await boot(storage, notifier)

  notifier.failAllCancels = true
  await s.getState().resetAllData() // (1) 解除は失敗するがリセットは成功
  assert.equal(s.getState().isOnboardingDone, false)
  notifier.failAllCancels = false

  // (2) オンボーディングを完了し、リマインダーを ON にする
  await s.getState().completeOnboarding('禁煙', 'ja', true)
  notifier.schedule('n_new')
  s.getState().updateQuestion(s.getState().settings.activeQuestionId, { notificationId: 'n_new' })
  await s.getState().flushWrites()
  notifier.cancelCalls.length = 0

  // (3) 読み込み直し
  const s2 = await boot(storage, notifier)
  assert.deepEqual(notifier.cancelCalls, ['n_old'])
  assert.deepEqual([...notifier.scheduled], ['n_new'])
  assert.equal(s2.getState().settings.questions[0].reminderEnabled, true)

  // (4) もう一度読み込み直すと、解除は呼ばれない
  notifier.cancelCalls.length = 0
  await boot(storage, notifier)
  assert.deepEqual(notifier.cancelCalls, [])
})

test('通知の解除に失敗した ID は解除待ちに入り、次の起動で再試行される（リマインダー OFF などの共通の仕組み）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const notifier = new MockNotifier()
  notifier.failCancel.add('n9')
  const s = await boot(storage, notifier)
  await s.getState().cancelNotificationOrQueue('n9')
  await s.getState().flushWrites()
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, ['n9'])
  notifier.failCancel.clear()
  await boot(storage, notifier)
  assert.deepEqual(storage.stored().pendingNotificationCancelIds, [])
})

// ── 大きな保存データ（分けて保存） ─────────────────────

test('大きな保存データは複数のキーに分けて保存し、読み込み直すと同じ（絵文字をまたいで分けても壊れない）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), 50)
  const comment = '😄'.repeat(40) + 'あ,"\n'.repeat(20)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, comment)
  await s.getState().saveEntry('2026-10-02', 'q1', 2, 'x')
  assert.ok(storage.data.get('diary_entries')!.startsWith('{"__chunked":'), '分けて保存されている')
  const s2 = await boot(storage, new MockNotifier(), 50)
  assert.equal(findEntry(s2.getState().entries, '2026-10-01', 'q1')!.comment, comment)
  assert.equal(s2.getState().entries.length, 2)
  // 小さくなったら1つのキーに戻る
  await s2.getState().importEntries([{ date: '2026-09-01', level: 1, comment: '' }], 'replace')
  const s3 = await boot(storage, new MockNotifier(), 100_000)
  assert.deepEqual(s3.getState().entries, [entry('2026-09-01', 'q1', 1, '')])
})

test('分けて保存するときに書き込みが失敗したら、保存データは前のまま（一部だけ書かれない）', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([entry('2026-10-01', 'q1', 3, 'before')]))
  const s = await boot(storage, new MockNotifier(), 50)
  storage.failWrites = true
  await assert.rejects(s.getState().saveEntry('2026-10-02', 'q1', 4, 'x'.repeat(500)))
  storage.failWrites = false
  const s2 = await boot(storage, new MockNotifier(), 50)
  assert.deepEqual(s2.getState().entries, [entry('2026-10-01', 'q1', 3, 'before')])
})

test('分けて保存した本体が欠けているときは読み込みの失敗として扱い、記録を上書きしない', async () => {
  const storage = new MemoryStorage()
  storage.putState(freeState([]))
  const s = await boot(storage, new MockNotifier(), 50)
  await s.getState().saveEntry('2026-10-01', 'q1', 4, 'y'.repeat(300))
  storage.data.delete('diary_entries__chunk_1')
  const s2 = await boot(storage, new MockNotifier(), 50)
  assert.equal(s2.getState().hydrationError, true)
  assert.equal(s2.getState().hydrated, false)
})

test('分けるときはサロゲートペア（絵文字）の途中で切らない（端末の保存で文字が壊れないように）', async () => {
  const { splitIntoChunks } = await import('../chunkedStorage')
  const value = 'a' + '😄'.repeat(30) // 'a' の後ろは2文字単位
  for (const size of [2, 3, 4, 7]) {
    const chunks = splitIntoChunks(value, size)
    assert.equal(chunks.join(''), value)
    for (const c of chunks) {
      assert.ok(!/[\uD800-\uDBFF]$/.test(c), `上位サロゲートで終わらない (size=${size})`)
      assert.ok(!/^[\uDC00-\uDFFF]/.test(c), `下位サロゲートで始まらない (size=${size})`)
    }
  }
})
