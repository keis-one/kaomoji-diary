// Sprint 19b 第5回評価（kaomoji-diary_sprint-19b_eval-r5.md）の R5-A。
// v1.2.3 以前の保存データ（lastValidReminderTime が無い）でも、保存されている正しい時刻を「最後の正しい時刻」として
// 引き継ぎ、時刻欄を入力途中のまま離れたときに、欄・保存値・通知時刻がその時刻のまま揃うこと。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage, MockNotifier, boot, freeState, q } from './helpers'
import { createReminderController } from '../reminderController'
import { normalizePersisted } from '../persisted'
import { withLastValidReminderTime } from '@/domain/reminderTime'
import type { Question } from '@/types'

/** v1.2.3 以前の形: lastValidReminderTime が無い。リマインダー ON・その時刻の通知あり */
const legacyOnState = (time: string) => {
  const st = freeState([]) as any
  const question: any = q('q1', { label: '禁煙', reminderEnabled: true, reminderTime: time, notificationId: `n_${time}` })
  delete question.lastValidReminderTime
  st.settings.questions[0] = question
  return st
}

const recordingScheduler = (notifier: MockNotifier) => {
  const times: string[] = []
  const schedule = async (qq: Question) => {
    const id = `n_${qq.reminderTime}`
    times.push(qq.reminderTime)
    notifier.schedule(id)
    return id
  }
  return { schedule, times }
}

const field = (s: { getState: () => any }) => s.getState().settings.questions[0].reminderTime

for (const time of ['07:00', '00:00', '23:59', '21:00']) {
  test(`R5-A 旧データ（最後の正しい時刻なし）・ON・${time} → 途中入力 → 欄を離れる → 再起動 → OFF/ON: 欄・保存値・通知時刻とも ${time}`, async () => {
    const storage = new MemoryStorage()
    storage.putState(legacyOnState(time))
    const notifier = new MockNotifier()
    notifier.schedule(`n_${time}`)
    const s = await boot(storage, notifier)

    // 読み込み（移行）で、保存されている正しい時刻を最後の正しい時刻として引き継ぐ（保存データにも書く）
    assert.equal(s.getState().settings.questions[0].lastValidReminderTime, time)
    assert.equal(storage.stored().settings.questions[0].lastValidReminderTime, time)

    const sch = recordingScheduler(notifier)
    const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })
    // 欄を消して "08:" まで入力
    await c.changeTime('q1', '')
    await c.changeTime('q1', '0')
    await c.changeTime('q1', '08:')
    assert.equal(field(s), '08:')
    // 入力途中のまま欄を離れる → 旧データの時刻に戻る
    assert.equal(await c.finishTimeEdit('q1', '08:'), 'saved')
    await s.getState().flushWrites()
    assert.equal(field(s), time, '入力欄は元の時刻に戻る（既定の 21:00 にしない）')
    assert.equal(storage.stored().settings.questions[0].reminderTime, time, '保存値も元の時刻')
    assert.deepEqual(sch.times, [], '通知は予約し直さない')
    assert.deepEqual([...notifier.scheduled], [`n_${time}`], '通知は元の時刻の1件のまま')
    assert.equal(s.getState().settings.questions[0].notificationId, `n_${time}`)

    // 再起動しても同じ
    const s2 = await boot(storage, notifier)
    assert.equal(field(s2), time)
    assert.equal(s2.getState().settings.questions[0].reminderEnabled, true)
    assert.deepEqual([...notifier.scheduled], [`n_${time}`])

    // OFF → ON: 元の時刻で予約し直す
    const c2 = createReminderController({ store: s2, isSupported: true, requestPermission: async () => true, schedule: sch.schedule })
    assert.equal(await c2.toggle('q1', false), 'disabled')
    assert.deepEqual([...notifier.scheduled], [])
    assert.equal(await c2.toggle('q1', true), 'scheduled')
    assert.deepEqual(sch.times, [time])
    assert.equal(field(s2), time)
    assert.deepEqual([...notifier.scheduled], [`n_${time}`])
  })
}

test('R5-A 旧データで保存値がすでに入力途中（復元できない）なら、既定の 21:00 を使う（現行どおり）', async () => {
  const storage = new MemoryStorage()
  const st = legacyOnState('07:00')
  st.settings.questions[0].reminderTime = '08:'
  storage.putState(st)
  const notifier = new MockNotifier()
  const s = await boot(storage, notifier)
  assert.equal(s.getState().settings.questions[0].lastValidReminderTime, undefined, '入力途中の値からは作らない')
  const c = createReminderController({ store: s, isSupported: true, requestPermission: async () => true, schedule: async () => 'x' })
  await c.finishTimeEdit('q1', '08:')
  assert.equal(field(s), '21:00')
})

test('R5-A 新しいデータの最後の正しい時刻は読み込みで上書きしない（保存値が入力途中でも、正しい時刻でも）', () => {
  const base = { reminderEnabled: true, notificationId: 'n', id: 'q1', label: 'x', kaomojiSet: {} as any }
  const typed = normalizePersisted({
    settings: { questions: [{ ...base, reminderTime: '08:', lastValidReminderTime: '07:00' }], activeQuestionId: 'q1' },
    isOnboardingDone: true,
  })
  assert.equal(typed.settings.questions[0].lastValidReminderTime, '07:00')
  const both = normalizePersisted({
    settings: { questions: [{ ...base, reminderTime: '09:00', lastValidReminderTime: '07:00' }], activeQuestionId: 'q1' },
    isOnboardingDone: true,
  })
  assert.equal(both.settings.questions[0].lastValidReminderTime, '07:00')
  // 正しくない最後の時刻は、正しい保存値で補う
  const broken = normalizePersisted({
    settings: { questions: [{ ...base, reminderTime: '06:30', lastValidReminderTime: 'xx' }], activeQuestionId: 'q1' },
    isOnboardingDone: true,
  })
  assert.equal(broken.settings.questions[0].lastValidReminderTime, '06:30')
})

test('R5-A 補完は何度行っても同じ（冪等）。保存し直した後の読み込みでも変わらない', async () => {
  const storage = new MemoryStorage()
  storage.putState(legacyOnState('07:00'))
  const notifier = new MockNotifier()
  await boot(storage, notifier)
  const first = JSON.stringify(storage.stored())
  await boot(storage, notifier)
  assert.equal(JSON.stringify(storage.stored()), first)
  const once = withLastValidReminderTime({ reminderTime: '7:05', lastValidReminderTime: undefined })
  assert.deepEqual(withLastValidReminderTime(once), once)
  assert.equal(once.lastValidReminderTime, '7:05')
})

test('R5-A 新しく作る問い（オンボーディング・問いの作り直し）にも最後の正しい時刻を持たせる', async () => {
  const s = await boot(new MemoryStorage(), new MockNotifier())
  await s.getState().completeOnboarding('禁煙', 'ja', false, '06:45')
  assert.equal(s.getState().settings.questions[0].lastValidReminderTime, '06:45')

  const storage = new MemoryStorage()
  storage.putState({ entries: [], settings: { questions: 'broken' }, isOnboardingDone: true })
  const s2 = await boot(storage, new MockNotifier())
  await s2.getState().recoverQuestion('運動')
  const qq = s2.getState().settings.questions[0]
  assert.equal(qq.lastValidReminderTime, qq.reminderTime)
})
