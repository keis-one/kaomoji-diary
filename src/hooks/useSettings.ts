import { useDiaryStore } from '@/store'
import type { UserSettings, Question, Language } from '@/types'

/**
 * 設定画面・各画面向けの設定フック。
 * 無料版は問い1つのみのため、問いの追加・削除・切り替え（および上限の判定）は提供しない。
 * 問い数の上限は読み込み時の正規化（src/store/freeEdition.ts）とオンボーディングで保たれる。
 */
export interface UseSettingsReturn {
  settings: UserSettings
  activeQuestion: Question | undefined
  updateSettings: (partial: Partial<Omit<UserSettings, 'questions'>>) => void
  updateQuestion: (id: string, partial: Partial<Omit<Question, 'id' | 'kaomojiSet'>>) => void
  completeOnboarding: (firstQuestionLabel: string, language?: Language, reminderEnabled?: boolean, reminderTime?: string) => void
  isOnboardingDone: boolean
}

export const useSettings = (): UseSettingsReturn => {
  const settings = useDiaryStore((s) => s.settings)
  const isOnboardingDone = useDiaryStore((s) => s.isOnboardingDone)
  const updateSettings = useDiaryStore((s) => s.updateSettings)
  const updateQuestion = useDiaryStore((s) => s.updateQuestion)
  const completeOnboarding = useDiaryStore((s) => s.completeOnboarding)

  const activeQuestion = settings.questions?.find((q) => q.id === settings.activeQuestionId)

  return {
    settings,
    activeQuestion,
    updateSettings,
    updateQuestion,
    completeOnboarding,
    isOnboardingDone,
  }
}
