import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Question, Language } from '@/types'

// ローカル通知をフォアグラウンド中も表示する
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export const isNotificationsSupported = true

/** 通知チャンネル（Android）の作成 */
export const setupNotifications = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminder', {
      name: 'Daily Reminder',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#66bb6a',
    })
  }
}

/** 通知許可を要求する。許可済みなら true を返す */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true

  const { status } = await Notifications.requestPermissionsAsync()
  return status === 'granted'
}

/** 問いに対してリマインダーをスケジュールし、通知 ID を返す */
export const scheduleReminder = async (
  question: Question,
  language: Language,
): Promise<string | undefined> => {
  const granted = await requestNotificationPermissions()
  if (!granted) return undefined

  // reminderTime は "HH:MM" 形式
  const [hourStr, minuteStr] = question.reminderTime.split(':')
  const hour = parseInt(hourStr ?? '21', 10)
  const minute = parseInt(minuteStr ?? '0', 10)

  if (isNaN(hour) || isNaN(minute)) return undefined

  const title =
    language === 'ja'
      ? `今日、${question.label}できた？`
      : `Did you ${question.label} today?`
  const body =
    language === 'ja'
      ? '顔文字で記録しよう！'
      : 'Record it with a kaomoji!'

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { questionId: question.id },
      ...(Platform.OS === 'android' && { channelId: 'reminder' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })

  return notificationId
}

/** 特定の通知をキャンセルする */
export const cancelReminder = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId)
}

/** すべてのスケジュール済み通知をキャンセルする */
export const cancelAllReminders = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/** 通知タップ時のリスナーを登録し、解除関数を返す */
export const addNotificationTapListener = (onTap: () => void): (() => void) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(() => {
    onTap()
  })
  return () => subscription.remove()
}
