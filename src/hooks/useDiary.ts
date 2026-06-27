import { useDiaryStore } from '@/store'
import { todayIso } from '@/utils/date'
import type { KaomojiLevel, DiaryEntry } from '@/types'

export interface UseDiaryReturn {
  entries: DiaryEntry[]
  todayEntry: DiaryEntry | undefined
  activeEntries: DiaryEntry[]
  record: (level: KaomojiLevel, comment: string) => void
  getEntry: (date: string, questionId: string) => DiaryEntry | undefined
}

export const useDiary = (): UseDiaryReturn => {
  const entries = useDiaryStore((s) => s.entries)
  const activeQuestionId = useDiaryStore((s) => s.settings.activeQuestionId)
  const addOrUpdateEntry = useDiaryStore((s) => s.addOrUpdateEntry)
  const getEntry = useDiaryStore((s) => s.getEntry)

  const todayEntry = getEntry(todayIso(), activeQuestionId)
  const activeEntries = entries.filter((e) => e.questionId === activeQuestionId)

  const record = (level: KaomojiLevel, comment: string) => {
    addOrUpdateEntry(activeQuestionId, level, comment)
  }

  return { entries, todayEntry, activeEntries, record, getEntry }
}
