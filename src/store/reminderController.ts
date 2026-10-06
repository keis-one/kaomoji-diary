/**
 * リマインダーの操作（ON・OFF・時刻変更・オンボーディングの完了）の手順。React Native に依存しない。
 * 画面（useReminder・オンボーディング）はこれを呼ぶだけにし、手順の正しさはテストで確かめる。
 *
 * どの操作も、許可の確認など「待ち」の前にストアの beginReminderOperation で操作券を受け取り、
 * 待ちの後に券がまだ最新か（同じ問いで後から別の操作が始まっていないか・全データリセットされていないか）を
 * 確かめる。券はストアにあるので、画面を離れてフックが作り直されても、古い操作は後から有効にならない。
 * 予約・OFF そのものもストアが券を確かめてから行う（scheduleQuestionReminder / disableQuestionReminder）。
 */
import type { Language, Question } from '@/types'
import type { DiaryStore } from './createDiaryStore'

export interface ReminderDeps {
  store: DiaryStore
  isSupported: boolean
  requestPermission: () => Promise<boolean>
  schedule: (q: Question, language: Language) => Promise<string | undefined>
  /** 端末が通知に対応していない（Web） */
  onUnsupported?: () => void
  /** 通知の許可が得られなかった（その操作がまだ最新のときだけ呼ぶ） */
  onPermissionDenied?: () => void
}

export type ReminderResult =
  | 'scheduled'
  | 'notScheduled'
  | 'disabled'
  | 'discarded'
  | 'denied'
  | 'unsupported'
  | 'saved'
  | 'noQuestion'

export const createReminderController = (deps: ReminderDeps) => {
  const { store } = deps
  const scheduleFn = (q: Question) => deps.schedule(q, store.getState().settings.language)

  /** リマインダーの ON / OFF */
  const toggle = async (questionId: string, enabled: boolean): Promise<ReminderResult> => {
    const st = store.getState()
    if (!st.settings.questions.some((q) => q.id === questionId)) return 'noQuestion'
    if (!deps.isSupported) {
      deps.onUnsupported?.()
      return 'unsupported'
    }
    // 待ちの前に券を受け取る（同じ問いのそれまでの操作はすべて古くなる）
    const ticket = st.beginReminderOperation(questionId, enabled ? 'on' : 'off')
    if (!enabled) return store.getState().disableQuestionReminder(ticket)

    const granted = await deps.requestPermission()
    if (!store.getState().isReminderOperationCurrent(ticket)) return 'discarded'
    if (!granted) {
      store.getState().endReminderOperation(ticket)
      deps.onPermissionDenied?.()
      return 'denied'
    }
    return store.getState().scheduleQuestionReminder(ticket, scheduleFn)
  }

  /**
   * 時刻の変更。保存値はすぐ変える。ON のとき（または ON の操作の途中のとき）は新しい時刻で予約し直し、
   * それまでの操作を古くする（保存値と予約した時刻が食い違わないように）。OFF の操作の途中なら予約しない。
   */
  const changeTime = async (questionId: string, time: string): Promise<ReminderResult> => {
    const st = store.getState()
    const question = st.settings.questions.find((q) => q.id === questionId)
    if (!question) return 'noQuestion'
    st.updateQuestion(questionId, { reminderTime: time })
    if (!deps.isSupported) return 'saved'
    const pending = st.pendingReminderOperation(questionId)
    const reschedule =
      pending === 'on' || pending === 'onboarding' || (pending !== 'off' && question.reminderEnabled)
    if (!reschedule) return 'saved'
    const ticket = st.beginReminderOperation(questionId, 'time')
    return store.getState().scheduleQuestionReminder(ticket, scheduleFn, { reminderTime: time })
  }

  return { toggle, changeTime }
}

export interface OnboardingInput {
  label: string
  language: Language
  reminderEnabled: boolean
  reminderTime: string
}

/**
 * オンボーディングの「はじめる」。問いを保存 →（リマインダー ON なら）許可の確認 → 予約 → ホームへ。
 * 許可の確認の前に、作った問いの操作券（リセットの世代を含む）を受け取り、待ちの後に確かめる。
 * その間に全データリセット・新しいオンボーディング等が入っていたら、予約も画面の移動もしない。
 */
export const finishOnboarding = async (
  deps: ReminderDeps & { navigateHome: () => void },
  input: OnboardingInput,
): Promise<'done' | 'saveFailed' | 'discarded'> => {
  const { store } = deps
  try {
    await store.getState().completeOnboarding(input.label, input.language, input.reminderEnabled, input.reminderTime)
  } catch {
    return 'saveFailed'
  }
  const question = store.getState().settings.questions[0]
  if (!question) return 'discarded'
  const ticket = store.getState().beginReminderOperation(question.id, 'onboarding')

  if (input.reminderEnabled && deps.isSupported) {
    const granted = await deps.requestPermission()
    if (!store.getState().isReminderOperationCurrent(ticket)) return 'discarded'
    if (granted) {
      const r = await store.getState().scheduleQuestionReminder(ticket, (q) => deps.schedule(q, input.language))
      if (r === 'discarded') return 'discarded'
    } else {
      store.getState().endReminderOperation(ticket)
    }
  } else {
    store.getState().endReminderOperation(ticket)
  }

  // 画面を移る直前にも確かめる（この問いのオンボーディングがまだ有効か）
  const stillThisOnboarding =
    store.getState().settings.questions.some((q) => q.id === question.id) &&
    store.getState().isOnboardingDone &&
    ticket.epoch === store.getState().getNotificationEpoch()
  if (!stillThisOnboarding) return 'discarded'
  deps.navigateHome()
  return 'done'
}
