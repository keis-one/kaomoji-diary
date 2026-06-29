import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DiaryEntry, UserSettings, KaomojiLevel, Question } from '@/types'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  createDefaultQuestion,
  FREE_QUESTION_LIMIT,
  PREMIUM_QUESTION_LIMIT,
} from '@/constants/app'
import { todayIso } from '@/utils/date'
import { cancelAllReminders, cancelReminder } from '@/utils/notifications'

const storage =
  Platform.OS === 'web'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => AsyncStorage)

interface DiaryStore {
  entries: DiaryEntry[]
  settings: UserSettings
  isOnboardingDone: boolean

  addOrUpdateEntry: (questionId: string, level: KaomojiLevel, comment: string, date?: string) => void
  getEntry: (date: string, questionId: string) => DiaryEntry | undefined

  addQuestion: (label: string) => Question | null
  updateQuestion: (id: string, partial: Partial<Omit<Question, 'id'>>) => void
  removeQuestion: (id: string) => void
  setActiveQuestion: (id: string) => void

  updateSettings: (partial: Partial<Omit<UserSettings, 'questions'>>) => void
  completeOnboarding: (firstQuestionLabel: string, language?: string, reminderEnabled?: boolean, reminderTime?: string) => void
  resetAll: () => void
}

export const useDiaryStore = create<DiaryStore>()(
  persist(
    (set, get) => ({
      entries: [],
      settings: { ...DEFAULT_SETTINGS },
      isOnboardingDone: false,

      addOrUpdateEntry: (questionId, level, comment, date) => {
        const targetDate = date ?? todayIso()
        set((state) => {
          const idx = state.entries.findIndex(
            (e) => e.date === targetDate && e.questionId === questionId,
          )
          const newEntry: DiaryEntry = { date: targetDate, questionId, level, comment }
          if (idx >= 0) {
            const updated = [...state.entries]
            updated[idx] = newEntry
            return { entries: updated }
          }
          return { entries: [...state.entries, newEntry] }
        })
      },

      getEntry: (date, questionId) =>
        get().entries.find((e) => e.date === date && e.questionId === questionId),

      addQuestion: (label) => {
        const { settings } = get()
        const limit = settings.isPremium ? PREMIUM_QUESTION_LIMIT : FREE_QUESTION_LIMIT
        if (settings.questions.length >= limit) return null
        const q = createDefaultQuestion(label)
        set((state) => ({
          settings: {
            ...state.settings,
            questions: [...state.settings.questions, q],
            activeQuestionId: state.settings.activeQuestionId || q.id,
          },
        }))
        return q
      },

      updateQuestion: (id, partial) => {
        set((state) => ({
          settings: {
            ...state.settings,
            questions: state.settings.questions.map((q) =>
              q.id === id ? { ...q, ...partial } : q,
            ),
          },
        }))
      },

      removeQuestion: (id) => {
        // 削除対象の通知をキャンセル
        const targetQuestion = get().settings.questions.find((q) => q.id === id)
        if (targetQuestion?.notificationId) {
          cancelReminder(targetQuestion.notificationId).catch(() => {})
        }
        set((state) => {
          const questions = state.settings.questions.filter((q) => q.id !== id)
          const activeQuestionId =
            state.settings.activeQuestionId === id
              ? (questions[0]?.id ?? '')
              : state.settings.activeQuestionId
          return { settings: { ...state.settings, questions, activeQuestionId } }
        })
      },

      setActiveQuestion: (id) =>
        set((state) => ({ settings: { ...state.settings, activeQuestionId: id } })),

      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),

      completeOnboarding: (firstQuestionLabel, language, reminderEnabled, reminderTime) => {
        const q = createDefaultQuestion(firstQuestionLabel)
        if (reminderEnabled !== undefined) q.reminderEnabled = reminderEnabled
        if (reminderTime) q.reminderTime = reminderTime
        set((state) => ({
          isOnboardingDone: true,
          settings: {
            ...state.settings,
            ...(language ? { language } : {}),
            questions: [q],
            activeQuestionId: q.id,
          },
        }))
      },

      resetAll: () => {
        cancelAllReminders().catch(() => {})
        set({ entries: [], settings: { ...DEFAULT_SETTINGS }, isOnboardingDone: false })
      },
    }),
    {
      name: STORAGE_KEYS.DIARY_ENTRIES,
      storage,
      merge: (persisted: unknown, current: DiaryStore): DiaryStore => {
        const p = persisted as Partial<DiaryStore>
        return {
          ...current,
          ...p,
          settings: {
            ...current.settings,
            ...(p.settings ?? {}),
            questions: Array.isArray(p.settings?.questions)
              ? p.settings.questions
              : current.settings.questions,
          },
        }
      },
    },
  ),
)
