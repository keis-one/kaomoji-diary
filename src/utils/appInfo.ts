/**
 * アプリのバージョンと OS のバージョン（お問い合わせのメール本文・「アプリについて」に使う）。
 * 端末の機種名は扱わない（製品仕様 F80・NF07）。
 */
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Clipboard from 'expo-clipboard'

/** app.json の expo.version（例: 1.2.0） */
export const getAppVersion = (): string => Constants.expoConfig?.version ?? '-'

/** 例: Android 14 */
export const getOsVersion = (): string => {
  if (Platform.OS === 'android') {
    const release = (Platform.constants as { Release?: string }).Release
    return `Android ${release ?? Platform.Version}`
  }
  if (Platform.OS === 'ios') return `iOS ${Platform.Version}`
  return 'Web'
}

export const copyToClipboard = async (text: string): Promise<void> => {
  await Clipboard.setStringAsync(text)
}
