import { useDiaryStore } from '@/store'
import { todayIso } from '@/utils/date'
import { findEntry } from '@/domain/entries'
import type { KaomojiLevel, DiaryEntry } from '@/types'

export interface UseDiaryReturn {
  entries: DiaryEntry[]
  todayEntry: DiaryEntry | undefined
  activeEntries: DiaryEntry[]
  /** 今日の記録を保存する。保存に失敗したら例外（記録は変わらない） */
  record: (level: KaomojiLevel, comment: string) => Promise<void>
}

export const useDiary = (): UseDiaryReturn => {
  const entries = useDiaryStore((s) => s.entries)
  const activeQuestionId = useDiaryStore((s) => s.settings.activeQuestionId)
  const saveEntry = useDiaryStore((s) => s.saveEntry)

  const todayEntry = findEntry(entries, todayIso(), activeQuestionId)
  const activeEntries = entries.filter((e) => e.questionId === activeQuestionId)

  const record = (level: KaomojiLevel, comment: string) => saveEntry(todayIso(), activeQuestionId, level, comment)

  return { entries, todayEntry, activeEntries, record }
}
