/**
 * 無料版アプリの設定を「問い1つ・デフォルト顔文字」の状態に揃える純粋関数群。
 *
 * 背景: preview 版では `[DEV] Premium` トグルで複数の問い・顔文字カスタムを設定できた。
 * その保存データが残った端末に無料版を入れた場合、オーナー決定により
 * 「設定は初期状態に戻す（2つ目以降の問い・カスタム顔文字は無効にしてデフォルトに戻す）」。
 * 記録データ（entries）はここでは一切触らない（黙って削除しない）。無効にした問いの記録は
 * 画面に表示されないだけで、保存データには残る。
 *
 * React Native に依存しないため、Node のテストランナーで直接テストできる（__tests__ 参照）。
 */
import type { Question, RetiredQuestion, UserSettings } from '@/types'
import { DEFAULT_KAOMOJI_SET } from '@/constants/kaomoji'
import { QUESTION_LIMIT } from '@/constants/app'

export interface FreeEditionNormalizeResult {
  /** 無料版として正しい形に揃えた設定 */
  settings: UserSettings
  /**
   * 無効にした問いに紐づいていたリマインダー通知の ID。
   * 呼び出し側でキャンセルしないと、表示されない問いの通知が届き続ける。
   */
  orphanedNotificationIds: string[]
  /**
   * 無効にした問い（2つ目以降）の問いID・文言・元の並び順（2つ目 = 2 …）。
   * 書き出しの question_no と question に使うため、保存データに残す（製品仕様 Sprint 19a 追補 A2）。
   */
  retiredQuestions: RetiredQuestion[]
}

/**
 * 設定を無料版の形に揃える。何度呼んでも同じ結果になる（冪等）。
 *
 * - 問いは先頭から QUESTION_LIMIT 個（=1つ）だけ残す。2つ目以降は無効にする
 * - 残した問いの顔文字はデフォルトセットに戻す
 * - 使用中の問い（activeQuestionId）は残した問いを指すようにする
 * - 廃止した `isPremium` など、UserSettings に無いプラン関連の値は取り除く
 */
export const normalizeSettingsForFreeEdition = (
  settings: UserSettings,
): FreeEditionNormalizeResult => {
  const questions: Question[] = Array.isArray(settings.questions) ? settings.questions : []

  const kept = questions
    .slice(0, QUESTION_LIMIT)
    .map((q) => ({ ...q, kaomojiSet: { ...DEFAULT_KAOMOJI_SET } }))
  const dropped = questions.slice(QUESTION_LIMIT)

  const activeQuestionId = kept.some((q) => q.id === settings.activeQuestionId)
    ? settings.activeQuestionId
    : (kept[0]?.id ?? '')

  return {
    settings: {
      questions: kept,
      activeQuestionId,
      language: settings.language,
      theme: settings.theme,
    },
    orphanedNotificationIds: dropped
      .map((q) => q?.notificationId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
    retiredQuestions: dropped
      .map((q, i) => ({
        id: typeof q?.id === 'string' ? q.id : '',
        label: typeof q?.label === 'string' ? q.label : '',
        order: QUESTION_LIMIT + i + 1,
      }))
      .filter((r) => r.id.length > 0),
  }
}

/**
 * zustand persist の merge 本体。保存済みの状態を現在の状態に重ね、設定だけを無料版の形に揃える。
 * 記録データ（entries）など設定以外の値は保存済みのものをそのまま使う。
 */
export const mergePersistedState = <T extends { settings: UserSettings }>(
  persisted: unknown,
  current: T,
): { state: T; orphanedNotificationIds: string[]; retiredQuestions: RetiredQuestion[] } => {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<T>
  const { settings, orphanedNotificationIds, retiredQuestions } = mergePersistedSettings(p.settings, current.settings)
  return { state: { ...current, ...p, settings }, orphanedNotificationIds, retiredQuestions }
}

/**
 * 保存済みの設定（旧バージョンの形を含む）を現在の既定値に重ね、無料版の形に揃える。
 */
export const mergePersistedSettings = (
  persistedSettings: unknown,
  currentSettings: UserSettings,
): FreeEditionNormalizeResult => {
  const p =
    persistedSettings && typeof persistedSettings === 'object'
      ? (persistedSettings as Partial<UserSettings>)
      : {}
  const merged: UserSettings = {
    ...currentSettings,
    ...p,
    questions: Array.isArray(p.questions) ? p.questions : currentSettings.questions,
  }
  return normalizeSettingsForFreeEdition(merged)
}
