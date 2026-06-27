import type { Question, Language } from '@/types'

// expo-notifications は Expo Go SDK 53+ では利用不可。
// Development Build でのみ有効化する。
export const isNotificationsSupported = false

export const setupNotifications = async (): Promise<void> => {}

export const requestNotificationPermissions = async (): Promise<boolean> => false

export const scheduleReminder = async (
  _question: Question,
  _language: Language,
): Promise<string | undefined> => undefined

export const cancelReminder = async (_notificationId: string): Promise<void> => {}

export const cancelAllReminders = async (): Promise<void> => {}

export const addNotificationTapListener = (_onTap: () => void): (() => void) => () => {}
