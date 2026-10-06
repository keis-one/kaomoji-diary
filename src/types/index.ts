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

/**
 * ユーザー設定。
 * 無料版アプリでは問いは常に1つ（QUESTION_LIMIT）で、顔文字はデフォルトセットのみ。
 * 旧 preview 版にあった `isPremium` は廃止した（無料版・有料版は別アプリのため、
 * アプリ内でプランを切り替えない）。保存データに残っていても読み込み時に除去する。
 */
export interface UserSettings {
  questions: Question[]
  activeQuestionId: string
  language: Language
  theme: Theme
}

export interface DiaryEntry {
  date: string
  questionId: string
  level: KaomojiLevel
  comment: string
}

/**
 * preview 版で2つ目以降だった問い（無料版では設定から外した問い）。画面には出さない。
 * 書き出し（F51）の question_no と question に使う（製品仕様 Sprint 19a 追補 A2）。
 */
export interface RetiredQuestion {
  id: string
  label: string
  /** 元の並び順（2つ目 = 2、3つ目 = 3 …） */
  order: number
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
