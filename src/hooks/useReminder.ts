import { useRef } from 'react'
import { Alert } from 'react-native'
import { useSettings } from './useSettings'
import {
  isNotificationsSupported,
  requestNotificationPermissions,
  scheduleReminder,
  cancelReminder,
} from '@/utils/notifications'

export const useReminder = () => {
  const { settings, updateQuestion } = useSettings()
  const isJa = settings.language === 'ja'
  // 問いごとに「最後に呼ばれたtoggle操作」を記録する。
  // ON操作の非同期処理（許可確認・スケジューリング）が完了する前に
  // 別のtoggle操作が入ると、後から完了した処理が状態を上書きしてしまう
  // 競合状態を防ぐため、完了時にまだ自分が最新の操作かを確認する。
  const latestToggleRef = useRef(new Map<string, symbol>())

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

    const token = Symbol()
    latestToggleRef.current.set(questionId, token)
    const isLatestToggle = () => latestToggleRef.current.get(questionId) === token

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

      // 既存の通知をキャンセルしてから再スケジュール
      if (question.notificationId) {
        await cancelReminder(question.notificationId)
      }

      const notificationId = await scheduleReminder(question, settings.language)

      if (!isLatestToggle()) {
        // 待っている間に別のtoggle操作が入っていた場合、
        // この呼び出しの結果は保存せず、取得した通知だけ破棄する。
        if (notificationId) {
          await cancelReminder(notificationId)
        }
        return
      }

      updateQuestion(questionId, {
        reminderEnabled: true,
        notificationId,
      })
    } else {
      // リマインダー OFF — 通知をキャンセル
      if (question.notificationId) {
        await cancelReminder(question.notificationId)
      }

      if (!isLatestToggle()) return

      updateQuestion(questionId, { reminderEnabled: false, notificationId: undefined })
    }
  }

  const updateReminderTime = async (questionId: string, time: string) => {
    const question = settings.questions.find((q) => q.id === questionId)
    if (!question) return

    // 時刻を更新
    updateQuestion(questionId, { reminderTime: time })

    // リマインダーが ON の場合は通知を再スケジュール
    if (question.reminderEnabled && isNotificationsSupported) {
      if (question.notificationId) {
        await cancelReminder(question.notificationId)
      }
      const updatedQuestion = { ...question, reminderTime: time }
      const notificationId = await scheduleReminder(updatedQuestion, settings.language)
      updateQuestion(questionId, { notificationId })
    }
  }

  return { toggleReminder, updateReminderTime }
}
