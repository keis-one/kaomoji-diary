/**
 * アプリで使うストア（保存先: Android は AsyncStorage、Web は localStorage。通知: expo-notifications）。
 * ストアの中身と保存の方式は ./createDiaryStore.ts（React Native に依存せずテストできる）。
 */
import { useStore } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { cancelReminder, listScheduledNotificationIds } from '@/utils/notifications'
import { createDiaryStore, type DiaryState, type KeyValueStorage } from './createDiaryStore'

const storage: KeyValueStorage =
  Platform.OS === 'web'
    ? {
        // Web は確認用（公開対象は Android）。localStorage には複数キーをまとめて書く仕組みが無い
        getItem: async (key) => localStorage.getItem(key),
        setItem: async (key, value) => localStorage.setItem(key, value),
        multiGet: async (keys) => keys.map((k) => [k, localStorage.getItem(k)] as const),
        multiSet: async (pairs) => pairs.forEach(([k, v]) => localStorage.setItem(k, v)),
        getAllKeys: async () => Object.keys(localStorage),
        multiRemove: async (keys) => keys.forEach((k) => localStorage.removeItem(k)),
      }
    : {
        getItem: (key) => AsyncStorage.getItem(key),
        setItem: (key, value) => AsyncStorage.setItem(key, value),
        multiGet: (keys) => AsyncStorage.multiGet(keys),
        // Android の multiSet は1つのトランザクションで書き込む（全部書けるか、何も書かないか）
        multiSet: (pairs) => AsyncStorage.multiSet(pairs),
        getAllKeys: () => AsyncStorage.getAllKeys(),
        multiRemove: (keys) => AsyncStorage.multiRemove(keys),
      }

export const diaryStore = createDiaryStore({
  storage,
  notifier: { cancel: cancelReminder, listScheduledIds: listScheduledNotificationIds },
})

/** 画面から使うフック。`useDiaryStore((s) => s.entries)` のように必要な値だけを選ぶ */
export const useDiaryStore = Object.assign(
  <T,>(selector: (s: DiaryState) => T): T => useStore(diaryStore, selector),
  { getState: diaryStore.getState },
)

// アプリの起動時に保存データを読み込む（読み込み後、解除待ちの通知の解除・通知の整理も行う）
void diaryStore.getState().hydrate()

export type { DiaryState } from './createDiaryStore'
export { needsQuestionRecovery } from './persisted'
