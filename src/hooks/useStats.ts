import { useMemo } from 'react'
import { useDiaryStore } from '@/store'
import { todayIso, daysAgoIso } from '@/utils/date'
import type { DiaryStats, DiaryEntry, KaomojiLevel, GraphPeriod, ChartPoint } from '@/types'

const filterByPeriod = (entries: DiaryEntry[], period: GraphPeriod): DiaryEntry[] => {
  if (period === 'all') return entries
  const cutoff = period === 'week' ? daysAgoIso(6) : daysAgoIso(29)
  return entries.filter((e) => e.date >= cutoff)
}

const calcStreak = (entries: DiaryEntry[]): number => {
  const dateSet = new Set(entries.map((e) => e.date))
  let streak = 0
  let cursor = todayIso()
  while (dateSet.has(cursor)) {
    streak++
    const d = new Date(cursor)
    d.setDate(d.getDate() - 1)
    cursor = d.toISOString().split('T')[0]
  }
  return streak
}

const buildChartPoints = (filteredEntries: DiaryEntry[], period: GraphPeriod): ChartPoint[] => {
  if (period === 'all') {
    return filteredEntries.map((e) => ({ date: e.date, level: e.level, hasEntry: true }))
  }
  const days = period === 'week' ? 7 : 30
  const entryMap = new Map(filteredEntries.map((e) => [e.date, e.level as number]))
  return Array.from({ length: days }, (_, i) => {
    const date = daysAgoIso(days - 1 - i)
    const level = entryMap.get(date) ?? 0
    return { date, level, hasEntry: entryMap.has(date) }
  })
}

export const useStats = (period: GraphPeriod = 'week') => {
  const allEntries = useDiaryStore((s) => s.entries)
  const activeQuestionId = useDiaryStore((s) => s.settings.activeQuestionId)

  const entries = useMemo(
    () => allEntries.filter((e) => e.questionId === activeQuestionId),
    [allEntries, activeQuestionId],
  )

  const stats: DiaryStats = useMemo(() => {
    if (entries.length === 0) {
      return { averageLevel: 0, maxLevel: 1 as KaomojiLevel, currentStreak: 0 }
    }
    const levels = entries.map((e) => e.level)
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length
    const max = Math.max(...levels) as KaomojiLevel
    return {
      averageLevel: Math.round(avg * 10) / 10,
      maxLevel: max,
      currentStreak: calcStreak(entries),
    }
  }, [entries])

  const filteredEntries = useMemo(
    () => filterByPeriod([...entries].sort((a, b) => a.date.localeCompare(b.date)), period),
    [entries, period],
  )

  const chartPoints = useMemo(
    () => buildChartPoints(filteredEntries, period),
    [filteredEntries, period],
  )

  return { stats, filteredEntries, chartPoints }
}
