import type { UserSettings, Question } from '@/types'
import { DEFAULT_KAOMOJI_SET } from './kaomoji'

export const STORAGE_KEYS = {
  DIARY_ENTRIES: 'diary_entries',
  USER_SETTINGS: 'user_settings',
  ONBOARDING_DONE: 'onboarding_done',
} as const

export const FREE_QUESTION_LIMIT = 1
export const PREMIUM_QUESTION_LIMIT = 5

export const createDefaultQuestion = (label = ''): Question => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  label,
  kaomojiSet: { ...DEFAULT_KAOMOJI_SET },
  reminderEnabled: false,
  reminderTime: '21:00',
})

export const DEFAULT_SETTINGS: UserSettings = {
  questions: [],
  activeQuestionId: '',
  language: 'ja',
  isPremium: false,
  theme: 'system',
}

export const GRAPH_PERIODS = ['week', 'month', 'all'] as const
