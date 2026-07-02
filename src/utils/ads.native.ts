import mobileAds from 'react-native-google-mobile-ads'

export const isAdsSupported = true

/**
 * Mobile Ads SDK を初期化する。
 * 失敗してもアプリの起動を妨げないよう握りつぶす（広告が出ないだけ）。
 */
export const initializeAds = async (): Promise<void> => {
  try {
    await mobileAds().initialize()
  } catch {
    // 初期化失敗時は広告非表示のまま続行する。
  }
}
