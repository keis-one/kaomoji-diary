import { format, parseISO, isToday, subDays } from 'date-fns'
import type { Language } from '@/types'

export const todayIso = (): string => format(new Date(), 'yyyy-MM-dd')
export const fromIso = (iso: string): Date => parseISO(iso)
export const isDateToday = (iso: string): boolean => isToday(parseISO(iso))
export const daysAgoIso = (n: number): string =>
  format(subDays(new Date(), n), 'yyyy-MM-dd')

export const formatMonthHeader = (date: Date, lang: Language): string =>
  lang === 'ja' ? format(date, 'yyyy年 M月') : format(date, 'MMMM yyyy')

export const WEEKDAY_LABELS: Record<Language, string[]> = {
  ja: ['月', '火', '水', '木', '金', '土', '日'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

export const getDaysInMonth = (year: number, month: number): string[] => {
  const days: string[] = []
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    days.push(format(date, 'yyyy-MM-dd'))
    date.setDate(date.getDate() + 1)
  }
  return days
}

export const getMonthStartOffset = (year: number, month: number): number => {
  const day = new Date(year, month - 1, 1).getDay()
  return (day + 6) % 7
}
