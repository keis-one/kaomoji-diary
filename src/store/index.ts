import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DiaryEntry, UserSettings, KaomojiLevel, Question, Language } from '@/types'
import { DEFAULT_SETTINGS, STORAGE_KEYS, createDefaultQuestion } from '@/constants/app'
import { todayIso } from '@/utils/date'
import { cancelAllReminders, cancelReminder } from '@/utils/notifications'
import { mergePersistedState } from './freeEdition'

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

  // 無料版は問い1つのみ（QUESTION_LIMIT）。問いの追加・削除・切り替えの操作は持たない。
  // 問いを作るのはオンボーディング（completeOnboarding）だけで、以後は文言・リマインダーの更新のみ。
  updateQuestion: (id: string, partial: Partial<Omit<Question, 'id' | 'kaomojiSet'>>) => void

  updateSettings: (partial: Partial<Omit<UserSettings, 'questions'>>) => void
  completeOnboarding: (firstQuestionLabel: string, language?: Language, reminderEnabled?: boolean, reminderTime?: string) => void
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
      // 読み込み時に設定を無料版の形（問い1つ・デフォルト顔文字・isPremium なし）に揃える。
      // 記録データ（entries）はそのまま残す。詳細は ./freeEdition.ts。
      merge: (persisted: unknown, current: DiaryStore): DiaryStore => {
        const { state, orphanedNotificationIds } = mergePersistedState(persisted, current)
        // 無効にした問いのリマインダーが届き続けないよう取り消す（取り消し済みの ID でも害はない）
        orphanedNotificationIds.forEach((id) => {
          cancelReminder(id).catch(() => {})
        })
        return state
      },
    },
  ),
)
