// 無料版の「初期状態に戻す」処理と問い上限のテスト（Sprint 19a）。
// 実行: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSettingsForFreeEdition,
  mergePersistedSettings,
  mergePersistedState,
} from '../freeEdition'
import { DEFAULT_KAOMOJI_SET } from '@/constants/kaomoji'
import { DEFAULT_SETTINGS, QUESTION_LIMIT } from '@/constants/app'
import type { DiaryEntry, Question, UserSettings } from '@/types'

const CUSTOM_SET = { 1: 'orz', 2: '(・_・)', 3: '(._.)φ', 4: '(^o^)', 5: '\\(^o^)/' } as const

const makeQuestion = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  label: `label-${id}`,
  kaomojiSet: { ...CUSTOM_SET },
  reminderEnabled: false,
  reminderTime: '21:00',
  ...extra,
})

// preview 版で [DEV] Premium をONにして作った状態（isPremium・問い3つ・カスタム顔文字）
const previewSettings = () =>
  ({
    questions: [
      makeQuestion('q1', { reminderEnabled: true, reminderTime: '07:30', notificationId: 'n1' }),
      makeQuestion('q2', { reminderEnabled: true, notificationId: 'n2' }),
      makeQuestion('q3'),
    ],
    activeQuestionId: 'q2',
    language: 'en',
    isPremium: true,
    theme: 'dark',
  }) as UserSettings & { isPremium: boolean }

test('無料版の問い上限は1つ', () => {
  assert.equal(QUESTION_LIMIT, 1)
})

test('preview 版の複数問いは先頭の1つだけ残し、2つ目以降は無効にする', () => {
  const { settings } = normalizeSettingsForFreeEdition(previewSettings())
  assert.equal(settings.questions.length, 1)
  assert.equal(settings.questions[0].id, 'q1')
})

test('残した問いの顔文字はデフォルトセットに戻す（文言・リマインダー・通知IDは保つ）', () => {
  const { settings } = normalizeSettingsForFreeEdition(previewSettings())
  const q = settings.questions[0]
  assert.deepEqual(q.kaomojiSet, DEFAULT_KAOMOJI_SET)
  assert.notEqual(q.kaomojiSet, DEFAULT_KAOMOJI_SET, '定数を共有せずコピーする')
  assert.equal(q.label, 'label-q1')
  assert.equal(q.reminderEnabled, true)
  assert.equal(q.reminderTime, '07:30')
  assert.equal(q.notificationId, 'n1')
})

test('使用中の問いが無効にした問いだったときは、残した問いに切り替える', () => {
  const { settings } = normalizeSettingsForFreeEdition(previewSettings())
  assert.equal(settings.activeQuestionId, 'q1')
})

test('isPremium は取り除き、言語・テーマは保つ', () => {
  const { settings } = normalizeSettingsForFreeEdition(previewSettings())
  assert.equal('isPremium' in settings, false)
  assert.equal(settings.language, 'en')
  assert.equal(settings.theme, 'dark')
})

test('無効にした問いの通知IDを返す（通知IDの無い問いは含めない）', () => {
  const { orphanedNotificationIds } = normalizeSettingsForFreeEdition(previewSettings())
  assert.deepEqual(orphanedNotificationIds, ['n2'])
})

test('すでに無料版の形なら変えない（冪等）', () => {
  const once = normalizeSettingsForFreeEdition(previewSettings()).settings
  const twice = normalizeSettingsForFreeEdition(once)
  assert.deepEqual(twice.settings, once)
  assert.deepEqual(twice.orphanedNotificationIds, [])
})

test('問いが無いときは空のまま（オンボーディング前・旧データの移行リセットに任せる）', () => {
  const { settings, orphanedNotificationIds } = normalizeSettingsForFreeEdition({
    ...DEFAULT_SETTINGS,
  })
  assert.deepEqual(settings.questions, [])
  assert.equal(settings.activeQuestionId, '')
  assert.deepEqual(orphanedNotificationIds, [])
})

test('mergePersistedSettings: 保存データが無ければ既定値', () => {
  const { settings } = mergePersistedSettings(undefined, { ...DEFAULT_SETTINGS })
  assert.deepEqual(settings, DEFAULT_SETTINGS)
})

test('mergePersistedSettings: questions が配列でない保存データは既定値の問いを使う', () => {
  const current: UserSettings = { ...DEFAULT_SETTINGS, questions: [makeQuestion('cur')], activeQuestionId: 'cur' }
  const { settings } = mergePersistedSettings({ questions: 'broken', language: 'en' }, current)
  assert.equal(settings.questions.length, 1)
  assert.equal(settings.questions[0].id, 'cur')
  assert.equal(settings.language, 'en')
})

test('mergePersistedState: 記録データは無効にした問いの分も含めて削除しない', () => {
  const entries: DiaryEntry[] = [
    { date: '2026-10-01', questionId: 'q1', level: 5, comment: 'a' },
    { date: '2026-10-01', questionId: 'q2', level: 3, comment: 'b' },
    { date: '2026-10-02', questionId: 'q3', level: 1, comment: '' },
  ]
  const current = { entries: [] as DiaryEntry[], settings: { ...DEFAULT_SETTINGS }, isOnboardingDone: false }
  const { state, orphanedNotificationIds } = mergePersistedState(
    { entries, settings: previewSettings(), isOnboardingDone: true },
    current,
  )
  assert.deepEqual(state.entries, entries)
  assert.equal(state.isOnboardingDone, true)
  assert.equal(state.settings.questions.length, 1)
  assert.equal('isPremium' in state.settings, false)
  assert.deepEqual(orphanedNotificationIds, ['n2'])
})

test('mergePersistedState: 保存データが null なら現在の状態のまま', () => {
  const current = { entries: [] as DiaryEntry[], settings: { ...DEFAULT_SETTINGS }, isOnboardingDone: false }
  const { state } = mergePersistedState(null, current)
  assert.deepEqual(state, current)
})
