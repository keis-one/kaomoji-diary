import { Alert } from 'react-native'
import { useSettings } from './useSettings'

export const useReminder = () => {
  const { settings, updateQuestion } = useSettings()
  const isJa = settings.language === 'ja'

  const toggleReminder = async (questionId: string, enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        isJa ? 'リマインダー（準備中）' : 'Reminder (Coming Soon)',
        isJa
          ? 'リマインダー機能は現在準備中です。\nアプリの正式リリース版でご利用いただけます。'
          : 'The reminder feature is coming soon.\nIt will be available in the official app release.',
      )
      return
    }
    updateQuestion(questionId, { reminderEnabled: false, notificationId: undefined })
  }

  const updateReminderTime = (questionId: string, time: string) => {
    updateQuestion(questionId, { reminderTime: time })
  }

  return { toggleReminder, updateReminderTime }
}
