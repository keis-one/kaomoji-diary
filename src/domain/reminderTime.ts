/**
 * リマインダーの時刻（純粋関数）。
 *
 * 設定画面の時刻欄は1文字ごとに保存するため、保存値が入力途中（"08:" など）のことがある。
 * 予約には必ず「正しい時刻」を使い、入力途中の値は予約にも、予約結果による上書きにも使わない
 * （Sprint 19b 第4回評価 R4-A）。
 */
import type { Question } from '@/types'

export const DEFAULT_REMINDER_TIME = '21:00'

/** リマインダーの時刻として正しいか（H:MM / HH:MM、0:00〜23:59） */
export const isValidReminderTime = (time: string | undefined): time is string =>
  typeof time === 'string' && /^([01]?\d|2[0-3]):[0-5]\d$/.test(time)

/**
 * 最後の正しい時刻が無い（v1.2.3 以前の保存データ・作ったばかりの問い）か正しくないとき、
 * 保存値が正しい時刻ならそれで補う。保存値が入力途中で復元できないときはそのまま（予約には既定の 21:00 を使う）。
 * 何度行っても同じ結果になる（Sprint 19b 第5回評価 R5-A）
 */
export const withLastValidReminderTime = <Q extends Pick<Question, 'reminderTime' | 'lastValidReminderTime'>>(q: Q): Q =>
  !isValidReminderTime(q.lastValidReminderTime) && isValidReminderTime(q.reminderTime)
    ? { ...q, lastValidReminderTime: q.reminderTime }
    : q

/**
 * 予約に使う時刻。保存値が正しければそれ、入力途中なら最後に入力された正しい時刻、どちらも無ければ 21:00
 */
export const effectiveReminderTime = (q: Pick<Question, 'reminderTime' | 'lastValidReminderTime'>): string =>
  isValidReminderTime(q.reminderTime)
    ? q.reminderTime
    : isValidReminderTime(q.lastValidReminderTime)
      ? q.lastValidReminderTime
      : DEFAULT_REMINDER_TIME
