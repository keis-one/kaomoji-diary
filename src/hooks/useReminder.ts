import { useRef } from 'react'
import { Alert } from 'react-native'
import { useSettings } from './useSettings'
import { useDiaryStore } from '@/store'
import {
  isNotificationsSupported,
  requestNotificationPermissions,
  scheduleReminder,
} from '@/utils/notifications'

export const useReminder = () => {
  const { settings, updateQuestion } = useSettings()
  const isJa = settings.language === 'ja'
  // 問いごとに「最後に呼ばれた操作」（ON/OFF・時刻変更）を記録し、最後の操作の結果だけを残す（Sprint 18）。
  // 予約そのものはストアの scheduleQuestionReminder / disableQuestionReminder が、通知の整理（A3）と
  // 同じ列で1つずつ行い、全データリセットをまたいだ操作の結果は捨てる（操作の世代。Sprint 19b 評価 #1・#2）。
  const latestToggleRef = useRef(new Map<string, symbol>())
  const scheduleQuestionReminder = useDiaryStore((s) => s.scheduleQuestionReminder)
  const disableQuestionReminder = useDiaryStore((s) => s.disableQuestionReminder)
  const getNotificationEpoch = useDiaryStore((s) => s.getNotificationEpoch)

  const beginOperation = (questionId: string) => {
    const token = Symbol()
    latestToggleRef.current.set(questionId, token)
    return () => latestToggleRef.current.get(questionId) === token
  }

  const toggleReminder = async (questionId: string, enabled: boolean) => {
    const question = settings.questions.find((q) => q.id === questionId)
    if (!question) return

    if (!isNotificationsSupported) {
      // Web プラットフォームはグレースフルにフォールバック
      Alert.alert(
        isJa ? 'リマインダー非対応' : 'Reminder Not Supported',
        isJa
          ? 'リマインダーはネイティブアプリのみ対応しています。'
          : 'Reminders are only supported in the native app.',
      )
      return
    }

    // 操作を始めた時点の世代（許可の確認を待っている間にリセットされても結果を捨てられるように）
    const epoch = getNotificationEpoch()
    const isLatest = beginOperation(questionId)

    if (enabled) {
      // 通知許可を確認
      const granted = await requestNotificationPermissions()
      if (!granted) {
        Alert.alert(
          isJa ? '通知の許可が必要です' : 'Permission Required',
          isJa
            ? '通知を有効にするには、設定アプリから通知の許可を与えてください。'
            : 'Please allow notifications in your device settings to enable reminders.',
        )
        return
      }
      await scheduleQuestionReminder(questionId, (q) => scheduleReminder(q, settings.language), { epoch, isLatest })
    } else {
      await disableQuestionReminder(questionId, { epoch, isLatest })
    }
  }

  const updateReminderTime = async (questionId: string, time: string) => {
    const question = settings.questions.find((q) => q.id === questionId)
    if (!question) return

    // 時刻を更新
    updateQuestion(questionId, { reminderTime: time })

    // リマインダーが ON の場合は通知を再スケジュール（予約し直す前の通知IDはストアの最新の値を使う）
    if (question.reminderEnabled && isNotificationsSupported) {
      const epoch = getNotificationEpoch()
      const isLatest = beginOperation(questionId)
      await scheduleQuestionReminder(questionId, (q) => scheduleReminder(q, settings.language), {
        epoch,
        isLatest,
        reminderTime: time,
      })
    }
  }

  return { toggleReminder, updateReminderTime }
}
