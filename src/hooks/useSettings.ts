import { useDiaryStore } from '@/store'
import type { UserSettings, Question, Language } from '@/types'
import { FREE_QUESTION_LIMIT, PREMIUM_QUESTION_LIMIT } from '@/constants/app'

export interface UseSettingsReturn {
  settings: UserSettings
  activeQuestion: Question | undefined
  questionLimit: number
  canAddQuestion: boolean
  updateSettings: (partial: Partial<Omit<UserSettings, 'questions'>>) => void
  addQuestion: (label: string) => Question | null
  updateQuestion: (id: string, partial: Partial<Omit<Question, 'id'>>) => void
  removeQuestion: (id: string) => void
  setActiveQuestion: (id: string) => void
  completeOnboarding: (firstQuestionLabel: string, language?: Language, reminderEnabled?: boolean, reminderTime?: string) => void
  isOnboardingDone: boolean
}

export const useSettings = (): UseSettingsReturn => {
  const settings = useDiaryStore((s) => s.settings)
  const isOnboardingDone = useDiaryStore((s) => s.isOnboardingDone)
  const updateSettings = useDiaryStore((s) => s.updateSettings)
  const addQuestion = useDiaryStore((s) => s.addQuestion)
  const updateQuestion = useDiaryStore((s) => s.updateQuestion)
  const removeQuestion = useDiaryStore((s) => s.removeQuestion)
  const setActiveQuestion = useDiaryStore((s) => s.setActiveQuestion)
  const completeOnboarding = useDiaryStore((s) => s.completeOnboarding)

  const activeQuestion = settings.questions?.find((q) => q.id === settings.activeQuestionId)
  const questionLimit = settings.isPremium ? PREMIUM_QUESTION_LIMIT : FREE_QUESTION_LIMIT
  const canAddQuestion = (settings.questions?.length ?? 0) < questionLimit

  return {
    settings,
    activeQuestion,
    questionLimit,
    canAddQuestion,
    updateSettings,
    addQuestion,
    updateQuestion,
    removeQuestion,
    setActiveQuestion,
    completeOnboarding,
    isOnboardingDone,
  }
}
