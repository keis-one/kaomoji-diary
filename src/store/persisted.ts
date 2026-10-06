/**
 * 保存データ（AsyncStorage の1つのキー）の形と、読み込み時の整え方（純粋関数）。
 *
 * 保存の形は Sprint 19a までの zustand persist と同じ `{"state": {...}, "version": 0}` にしている
 * （旧バージョンの保存データをそのまま読め、上書きインストール後に戻しても読める）。
 *
 * 読み込み時に行うこと:
 * - 無料版の形（問い1つ・デフォルト顔文字・isPremium なし）に揃える（Sprint 19a。./freeEdition.ts）
 * - A1: 外した問いの通知IDを「解除待ちの通知ID」に加える（成功するまで起動のたびに解除を試す）
 * - A2: 外した問いの問いID・文言・元の並び順を「外した問い」として残す
 * - A3: オンボーディング完了済みなのに問いの設定が使えない（空・配列でない・先頭の文言が空）ときは、
 *       記録・言語・テーマを残したまま問いの設定だけを空にし、読める通知IDを解除待ちに加え、
 *       「通知の整理待ち」の印を付ける。記録は消さない（問いの入力し直し画面で問いを作り直す）
 */
import type { DiaryEntry, Language, RetiredQuestion, Theme, UserSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/constants/app'
import { mergePersistedState } from './freeEdition'
import { withLastValidReminderTime } from '@/domain/reminderTime'

export const PERSIST_VERSION = 0

export interface PersistedData {
  entries: DiaryEntry[]
  settings: UserSettings
  isOnboardingDone: boolean
  /** A2: preview 版で外した問い（画面には出さない。書き出しの question_no・question に使う） */
  retiredQuestions: RetiredQuestion[]
  /** 解除待ちの通知ID（A1・A3・全データリセットで共通）。解除に成功したものから消す */
  pendingNotificationCancelIds: string[]
  /** 通知の整理待ち（A3）。古い通知の ID が分からないとき、いまの問いの通知以外をすべて解除する */
  notificationCleanupPending: boolean
}

export const createInitialData = (): PersistedData => ({
  entries: [],
  settings: { ...DEFAULT_SETTINGS, questions: [] },
  isOnboardingDone: false,
  retiredQuestions: [],
  pendingNotificationCancelIds: [],
  notificationCleanupPending: false,
})

export const PERSISTED_KEYS: (keyof PersistedData)[] = [
  'entries',
  'settings',
  'isOnboardingDone',
  'retiredQuestions',
  'pendingNotificationCancelIds',
  'notificationCleanupPending',
]

export const pickPersisted = (s: PersistedData): PersistedData => ({
  entries: s.entries,
  settings: s.settings,
  isOnboardingDone: s.isOnboardingDone,
  retiredQuestions: s.retiredQuestions,
  pendingNotificationCancelIds: s.pendingNotificationCancelIds,
  notificationCleanupPending: s.notificationCleanupPending,
})

export const serializePersisted = (s: PersistedData): string =>
  JSON.stringify({ state: pickPersisted(s), version: PERSIST_VERSION })

/** 保存データの文字列から state 部分を取り出す。JSON として読めなければ例外 */
export const unwrapStoredJson = (raw: string): unknown => {
  const parsed: unknown = JSON.parse(raw)
  if (parsed && typeof parsed === 'object' && 'state' in parsed) return (parsed as { state: unknown }).state
  return parsed
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

/** 問いの設定が使えるか（A3 の判定の逆）。先頭の問いに ID と空でない文言があること */
export const isUsableQuestionList = (questions: unknown): boolean => {
  if (!Array.isArray(questions) || questions.length === 0) return false
  const q = questions[0]
  return (
    isObject(q) &&
    typeof q.id === 'string' &&
    q.id.length > 0 &&
    typeof q.label === 'string' &&
    q.label.trim().length > 0
  )
}

/** 壊れた問いの設定からでも読める通知ID */
const readableNotificationIds = (questions: unknown): string[] =>
  Array.isArray(questions)
    ? questions
        .map((q) => (isObject(q) ? q.notificationId : undefined))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []

const uniq = (ids: string[]): string[] => [...new Set(ids)]

const sanitizeEntries = (v: unknown): DiaryEntry[] =>
  Array.isArray(v)
    ? v
        .filter((e): e is DiaryEntry => isObject(e) && typeof e.date === 'string' && typeof e.questionId === 'string')
        .map((e) => ({ ...e, comment: typeof e.comment === 'string' ? e.comment : '' }))
    : []

const sanitizeRetired = (v: unknown): RetiredQuestion[] =>
  Array.isArray(v)
    ? v.filter(
        (r): r is RetiredQuestion =>
          isObject(r) && typeof r.id === 'string' && typeof r.label === 'string' && typeof r.order === 'number',
      )
    : []

/**
 * 保存データ（state 部分。旧バージョンの形・壊れた形を含む）を、いまのアプリの形に整える。
 * 何度行っても同じ結果になる（冪等）。記録（entries）は削除しない。
 */
export const normalizePersisted = (stored: unknown): PersistedData => {
  const p = isObject(stored) ? stored : {}
  const rawSettings = isObject(p.settings) ? p.settings : {}
  const rawQuestions = rawSettings.questions
  const isOnboardingDone = p.isOnboardingDone === true

  const base = createInitialData()
  const merged = mergePersistedState(
    { settings: rawSettings },
    { settings: base.settings },
  )
  const settings: UserSettings = merged.state.settings
  settings.language = (['ja', 'en'] as Language[]).includes(settings.language) ? settings.language : 'ja'
  settings.theme = (['light', 'dark', 'system'] as Theme[]).includes(settings.theme) ? settings.theme : 'system'

  let retiredQuestions = sanitizeRetired(p.retiredQuestions)
  for (const r of merged.retiredQuestions) {
    if (!retiredQuestions.some((x) => x.id === r.id)) retiredQuestions = [...retiredQuestions, r]
  }
  let pending = uniq([
    ...(Array.isArray(p.pendingNotificationCancelIds)
      ? p.pendingNotificationCancelIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []),
    ...merged.orphanedNotificationIds,
  ])
  let cleanup = p.notificationCleanupPending === true

  if (isOnboardingDone && !isUsableQuestionList(rawQuestions)) {
    // A3: 問いの設定が使えない → 問いだけを空にする（記録・言語・テーマは残す）
    pending = uniq([...pending, ...readableNotificationIds(rawQuestions)])
    cleanup = true
    settings.questions = []
    settings.activeQuestionId = ''
  }

  // いまの問いと同じIDの「外した問い」は、いまの問いとして扱う（一覧から除く）
  // 旧データ（v1.2.3 以前）には「最後の正しい時刻」が無い。保存値が正しい時刻なら引き継ぐ（R5-A）
  settings.questions = settings.questions.map(withLastValidReminderTime)

  const currentIds = new Set(settings.questions.map((q) => q.id))
  retiredQuestions = retiredQuestions.filter((r) => !currentIds.has(r.id))

  return {
    entries: sanitizeEntries(p.entries),
    settings,
    isOnboardingDone,
    retiredQuestions,
    pendingNotificationCancelIds: pending,
    notificationCleanupPending: cleanup,
  }
}

/** オンボーディング完了済みなのに問いが無い → 問いの入力し直し画面を出す（A3） */
export const needsQuestionRecovery = (s: Pick<PersistedData, 'isOnboardingDone' | 'settings'>): boolean =>
  s.isOnboardingDone && !isUsableQuestionList(s.settings.questions)

/** いまの問いの通知ID（通知の整理で残すもの） */
export const currentNotificationIds = (s: Pick<PersistedData, 'settings'>): string[] =>
  s.settings.questions
    .map((q) => q.notificationId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
