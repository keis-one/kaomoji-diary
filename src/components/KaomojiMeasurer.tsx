/**
 * カレンダーのマスの顔文字の大きさを決めるため、いまの顔文字セットの幅・高さを実際の字体で測る（見えない場所に描く）。
 * 端末の文字サイズの設定も含めて測るので、文字サイズを大きくしてもマスからはみ出さない（製品仕様 S20-5）。
 * 顔文字セットが変わったとき・文字サイズの設定が変わって描き直されたときに測り直す。
 */
import React, { useRef } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import type { KaomojiLevel, KaomojiSet } from '@/types'
import { KAOMOJI_LEVELS } from '@/constants/kaomoji'
import { DAY_NUM_TEXT_STYLE, type KaomojiMeasure } from './MonthGrid'

/** 測るときの文字の大きさ（大きくして測り、誤差を小さくする） */
const MEASURE_FONT_SIZE = 100

interface Props {
  kaomojiSet: KaomojiSet
  onMeasured: (m: KaomojiMeasure) => void
}

export const KaomojiMeasurer: React.FC<Props> = ({ kaomojiSet, onMeasured }) => {
  const sizes = useRef<{ w: Partial<Record<KaomojiLevel, number>>; h: Partial<Record<KaomojiLevel, number>>; day?: number }>({
    w: {},
    h: {},
  })

  const report = () => {
    const { w, h, day } = sizes.current
    if (day === undefined || KAOMOJI_LEVELS.some((lv) => w[lv] === undefined || h[lv] === undefined)) return
    const widthPerDp = {} as Record<KaomojiLevel, number>
    const heightPerDp = {} as Record<KaomojiLevel, number>
    for (const lv of KAOMOJI_LEVELS) {
      widthPerDp[lv] = (w[lv] as number) / MEASURE_FONT_SIZE
      heightPerDp[lv] = (h[lv] as number) / MEASURE_FONT_SIZE
    }
    onMeasured({ widthPerDp, heightPerDp, dayNumHeight: day })
  }

  const onKaomojiLayout = (lv: KaomojiLevel) => (e: LayoutChangeEvent) => {
    sizes.current.w[lv] = e.nativeEvent.layout.width
    sizes.current.h[lv] = e.nativeEvent.layout.height
    report()
  }

  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {KAOMOJI_LEVELS.map((lv) => (
        <Text key={`${lv}:${kaomojiSet[lv]}`} style={styles.kaomoji} numberOfLines={1} onLayout={onKaomojiLayout(lv)}>
          {kaomojiSet[lv]}
        </Text>
      ))}
      <Text
        style={DAY_NUM_TEXT_STYLE}
        onLayout={(e) => {
          sizes.current.day = e.nativeEvent.layout.height
          report()
        }}
      >
        30
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // 画面の外に、折り返さない広さで置く
  offscreen: { position: 'absolute', left: -20000, top: 0, width: 10000, opacity: 0, alignItems: 'flex-start' },
  kaomoji: { fontSize: MEASURE_FONT_SIZE },
})
