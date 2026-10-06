/**
 * 今日・過去日のポップアップの「記録する／保存」「削除する」の結果（成功ならトースト、失敗ならエラー表示）。
 * 保存先への書き込みが失敗したときは成功のトーストを出さない（製品仕様 Sprint 19b）。
 */
import type { KaomojiLevel } from '@/types'

export type DayActionResult =
  | { ok: true; toast: 'recorded' | 'saved' | 'deleted' }
  | { ok: false; error: 'saveFailed' | 'deleteFailed' }

export const submitDayEntry = async (
  saveEntry: (date: string, questionId: string, level: KaomojiLevel, comment: string) => Promise<void>,
  args: { date: string; questionId: string; level: KaomojiLevel; comment: string; hadEntry: boolean },
): Promise<DayActionResult> => {
  try {
    await saveEntry(args.date, args.questionId, args.level, args.comment)
    return { ok: true, toast: args.hadEntry ? 'saved' : 'recorded' }
  } catch {
    return { ok: false, error: 'saveFailed' }
  }
}

export const deleteDayEntry = async (
  deleteEntry: (date: string, questionId: string) => Promise<void>,
  date: string,
  questionId: string,
): Promise<DayActionResult> => {
  try {
    await deleteEntry(date, questionId)
    return { ok: true, toast: 'deleted' }
  } catch {
    return { ok: false, error: 'deleteFailed' }
  }
}
