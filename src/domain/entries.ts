/**
 * 記録データ（entries）の操作と集計（純粋関数）。React Native に依存しない。
 */
import type { DiaryEntry, KaomojiLevel } from '@/types'

/** 同じ日・同じ問いの記録を置き換え、無ければ加える */
export const upsertEntry = (
  entries: DiaryEntry[],
  date: string,
  questionId: string,
  level: KaomojiLevel,
  comment: string,
): DiaryEntry[] => {
  const next: DiaryEntry = { date, questionId, level, comment }
  const idx = entries.findIndex((e) => e.date === date && e.questionId === questionId)
  if (idx < 0) return [...entries, next]
  const copy = [...entries]
  copy[idx] = next
  return copy
}

/** 指定した日・問いの記録だけを消す（ほかの日・ほかの問いの記録は残す） */
export const removeEntry = (entries: DiaryEntry[], date: string, questionId: string): DiaryEntry[] =>
  entries.filter((e) => !(e.date === date && e.questionId === questionId))

export const findEntry = (entries: DiaryEntry[], date: string, questionId: string): DiaryEntry | undefined =>
  entries.find((e) => e.date === date && e.questionId === questionId)

/** YYYY-MM-DD の前日（タイムゾーン・夏時間の影響を受けないよう UTC で計算する） */
export const previousIsoDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

/** 今日を含む連続記録日数（今日の記録が無ければ 0） */
export const calcStreak = (dates: Iterable<string>, today: string): number => {
  const set = new Set(dates)
  let streak = 0
  let cursor = today
  while (set.has(cursor)) {
    streak++
    cursor = previousIsoDate(cursor)
  }
  return streak
}

/** ホームの連続記録の表示（現行実装: 2日以上のときに表示） */
export const shouldShowStreak = (streak: number): boolean => streak >= 2

/** ホームのボタン: 今日の記録が無ければ「記録」、あれば「更新（編集）」 */
export const homeButtonMode = (todayEntry: DiaryEntry | undefined): 'record' | 'edit' =>
  todayEntry ? 'edit' : 'record'

/**
 * 問いの設定が壊れたときに引き継ぐ問いID（製品仕様 Sprint 19a 追補 A3・オーナー確定 U3）。
 * 記録の日付が最も新しい記録の問いID。同じ日に複数あれば問いIDの文字列の辞書順で先。記録が無ければ null。
 */
export const pickRecoveryQuestionId = (entries: DiaryEntry[]): string | null => {
  let best: DiaryEntry | null = null
  for (const e of entries) {
    if (typeof e?.questionId !== 'string' || typeof e?.date !== 'string') continue
    if (
      best === null ||
      e.date > best.date ||
      (e.date === best.date && e.questionId < best.questionId)
    ) {
      best = e
    }
  }
  return best ? best.questionId : null
}
