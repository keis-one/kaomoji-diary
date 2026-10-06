import type { UserSettings, Question } from '@/types'
import { DEFAULT_KAOMOJI_SET } from './kaomoji'

export const STORAGE_KEYS = {
  DIARY_ENTRIES: 'diary_entries',
  USER_SETTINGS: 'user_settings',
  ONBOARDING_DONE: 'onboarding_done',
} as const

/**
 * 無料版アプリで持てる問いの数。無料版は問い1つのみ（製品仕様 F01）。
 * 複数問い（最大5つ）は有料版アプリの将来仕様（kaomoji-diary_paid-app-future.md）で扱う。
 */
export const QUESTION_LIMIT = 1

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
  theme: 'system',
}

/** グラフの期間（有料版アプリの将来仕様。無料版の画面からは参照しない） */
export const GRAPH_PERIODS = ['week', 'month', 'all'] as const
