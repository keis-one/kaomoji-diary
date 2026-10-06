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
import { adSlotHeight, nextAdSlotState, shouldRenderAd, type AdSlotState } from '@/domain/adSlot'

// 開発ビルドではテスト広告、リリースビルドでは本番広告ユニットを使う。
const RESOLVED_UNIT_ID = __DEV__ ? TestIds.BANNER : getBannerAdUnitId()

/**
 * タブバー上部に表示するバナー広告。
 *
 * - 無料版アプリでは全ユーザーに常に表示する（プランの判定はしない。製品仕様 Sprint 13 改訂版）。
 * - 広告ユニット ID が未取得のプラットフォームでは表示しない。
 * - 高さ固定の 320×50 バナー（BannerAdSize.BANNER）を使い、枠の高さを広告と同じ 50 にする。
 *   読み込み前・失敗時・オフライン時も同じ高さの空の枠を保ち、広告が切れたり画面がずれたりしない
 *   （製品仕様 Sprint 19a 追補 A4。理由は src/domain/adSlot.ts）。
 * - 失敗時は BannerAd を外して空の枠だけ残す。
 */
export default function AdBanner() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [slot, setSlot] = useState<AdSlotState>('loading')

  // 広告ユニット未設定のプラットフォームでは領域ごと非表示。
  if (!RESOLVED_UNIT_ID) {
    return null
  }

  return (
    <View>
      {/* 区切り線は広告の枠の外に置く（枠の中に描くと高さ 50 の広告の下端が線の分だけ切れるため） */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View
        style={[
          styles.container,
          {
            height: adSlotHeight(slot),
            backgroundColor: colors.tabBar,
            // タブバー分の左右セーフエリアは Tabs 側が処理するため、
            // ここでは左右のインセットのみ考慮して中央寄せを保つ。
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {shouldRenderAd(slot) && (
          <BannerAd
            unitId={RESOLVED_UNIT_ID}
            size={BannerAdSize.BANNER}
            onAdFailedToLoad={() => setSlot((s) => nextAdSlotState(s, 'failedToLoad'))}
            onAdLoaded={() => setSlot((s) => nextAdSlotState(s, 'loaded'))}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth },
})
