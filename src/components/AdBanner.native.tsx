import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads'
import { useTheme } from '@/hooks/useTheme'
import { getBannerAdUnitId } from '@/constants/ads'

// 開発ビルドではテスト広告、リリースビルドでは本番広告ユニットを使う。
const RESOLVED_UNIT_ID = __DEV__ ? TestIds.BANNER : getBannerAdUnitId()

// アンカー型アダプティブバナーの標準的な高さ。読み込み前/失敗時も
// この高さを確保しておくことでレイアウトが崩れないようにする。
const BANNER_HEIGHT = 50

/**
 * タブバー上部に表示するバナー広告。
 *
 * - 無料版アプリでは全ユーザーに常に表示する（プランの判定はしない。製品仕様 Sprint 13 改訂版）。
 * - 広告ユニット ID が未取得のプラットフォームでは表示しない。
 * - 読み込み前/読み込み失敗時/オフライン時も一定高さの空の領域を確保し、
 *   レイアウト崩れや操作の妨げを防ぐ（失敗時は BannerAd を外して空の領域だけ残す）。
 */
export default function AdBanner() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [failed, setFailed] = useState(false)

  // 広告ユニット未設定のプラットフォームでは領域ごと非表示。
  if (!RESOLVED_UNIT_ID) {
    return null
  }

  return (
    <View
      style={[
        styles.container,
        {
          height: BANNER_HEIGHT,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          // タブバー分の左右セーフエリアは Tabs 側が処理するため、
          // ここでは左右のインセットのみ考慮して中央寄せを保つ。
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {!failed && (
        <BannerAd
          unitId={RESOLVED_UNIT_ID}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          onAdFailedToLoad={() => setFailed(true)}
          onAdLoaded={() => setFailed(false)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
})
