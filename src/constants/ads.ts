import { Platform } from 'react-native'

/**
 * AdMob 関連の ID を1箇所に集約する。
 *
 * これらの値は AdMob の仕組み上クライアントに公開される前提の値であり、
 * 秘匿情報（API キー等）ではないため、直接埋め込んで管理する。
 *
 * iOS の App ID / 広告ユニット ID は Apple Developer Program 未登録のため未取得。
 * 取得後は下記の空文字を差し替えるだけでよい。
 */

// app.json の plugins に渡す App ID（プラグイン側で参照）。
export const ADMOB_APP_ID = {
  android: 'ca-app-pub-4395545227647434~2792613047',
  ios: '', // 未取得（プレースホルダー）
} as const

// バナー広告ユニット ID。
const BANNER_AD_UNIT_ID = {
  android: 'ca-app-pub-4395545227647434/5289572426',
  ios: '', // 未取得（プレースホルダー）
} as const

/**
 * 実行中のプラットフォームに対応するバナー広告ユニット ID を返す。
 * 未取得（空文字）のプラットフォームでは undefined を返し、
 * 呼び出し側で広告を表示しない判断ができるようにする。
 */
export const getBannerAdUnitId = (): string | undefined => {
  const id = Platform.select({
    android: BANNER_AD_UNIT_ID.android,
    ios: BANNER_AD_UNIT_ID.ios,
    default: '',
  })
  return id ? id : undefined
}
