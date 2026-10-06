import { useMemo } from 'react'
import { Alert } from 'react-native'
import { diaryStore, useDiaryStore } from '@/store'
import { createReminderController } from '@/store/reminderController'
import {
  isNotificationsSupported,
  requestNotificationPermissions,
  scheduleReminder,
} from '@/utils/notifications'

/**
 * 設定画面のリマインダー操作（ON/OFF・時刻変更）。
 * 手順は src/store/reminderController.ts（操作券をストアで管理するので、画面を離れてこのフックが
 * 作り直されても、古い操作が後から有効になることはない。Sprint 19b 再評価 R1）。
 */
export const useReminder = () => {
  const language = useDiaryStore((s) => s.settings.language)
  const isJa = language === 'ja'

  return useMemo(() => {
    const controller = createReminderController({
      store: diaryStore,
      isSupported: isNotificationsSupported,
      requestPermission: requestNotificationPermissions,
      schedule: scheduleReminder,
      onUnsupported: () =>
        Alert.alert(
          isJa ? 'リマインダー非対応' : 'Reminder Not Supported',
          isJa ? 'リマインダーはネイティブアプリのみ対応しています。' : 'Reminders are only supported in the native app.',
        ),
      onPermissionDenied: () =>
        Alert.alert(
          isJa ? '通知の許可が必要です' : 'Permission Required',
          isJa
            ? '通知を有効にするには、設定アプリから通知の許可を与えてください。'
            : 'Please allow notifications in your device settings to enable reminders.',
        ),
    })
    return {
      toggleReminder: (questionId: string, enabled: boolean): void => void controller.toggle(questionId, enabled),
      updateReminderTime: (questionId: string, time: string): void => void controller.changeTime(questionId, time),
      finishReminderTimeEdit: (questionId: string, time: string): void => void controller.finishTimeEdit(questionId, time),
    }
  }, [isJa])
}
