export type KaomojiLevel = 1 | 2 | 3 | 4 | 5
export type KaomojiSet = Record<KaomojiLevel, string>
export type EmojiSet = Record<KaomojiLevel, string>
export type Language = 'ja' | 'en'

export interface Question {
  id: string
  label: string
  kaomojiSet: KaomojiSet
  reminderEnabled: boolean
  reminderTime: string
  notificationId?: string
}

export type Theme = 'light' | 'dark' | 'system'

export interface UserSettings {
  questions: Question[]
  activeQuestionId: string
  language: Language
  isPremium: boolean
  theme: Theme
}

export interface DiaryEntry {
  date: string
  questionId: string
  level: KaomojiLevel
  comment: string
}

export interface DiaryStats {
  averageLevel: number
  maxLevel: KaomojiLevel
  currentStreak: number
}

export interface ChartPoint {
  date: string
  level: number    // 0 = 未記録, 1-5 = 記録済み
  hasEntry: boolean
}

export type OnboardingStep = 'language' | 'question' | 'reminder'
export type GraphPeriod = 'week' | 'month' | 'all'
export const KAOMOJI_MAX_LENGTH = 15
