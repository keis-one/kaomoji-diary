/**
 * カレンダーの 1 か月分のマス（UI仕様 4章）。マスには日付の数字と、その日のレベルの顔文字を 1 行で出す（Sprint 20）。
 *
 * - 顔文字の大きさは顔文字ごとに、マスに収まる最大の大きさ（上限 16dp）。8dp でも収まらなければ 8dp のまま末尾を「…」で省く
 *   （fitKaomojiFont。文字の幅は KaomojiMeasurer で端末の字体・文字サイズのまま測った値）
 * - stamp を渡したマスでは、顔文字をスタンプのように押す（強さはレベル別。src/domain/celebration.ts）
 */
import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import type { DiaryEntry, KaomojiLevel, KaomojiSet } from '@/types'
import { KAOMOJI_LEVELS } from '@/constants/kaomoji'
import { getDaysInMonth, getMonthStartOffset } from '@/utils/date'
import { dayTapAction } from '@/domain/dayEditor'
import { cellAvailWidth, fitKaomojiFont, type KaomojiFit } from '@/domain/kaomojiFit'
import type { StampKind } from '@/domain/celebration'

/** KaomojiMeasurer が測った値（文字の大きさ 1dp あたり） */
export interface KaomojiMeasure {
  widthPerDp: Record<KaomojiLevel, number>
  heightPerDp: Record<KaomojiLevel, number>
  /** 日付の数字の行の高さ */
  dayNumHeight: number
}

export interface CellStamp {
  date: string
  /** 押すたびに変える */
  key: number
  kind: StampKind | 'fade'
  shake: boolean
}

/** マスの上下の線・余白（右の線 1・上下の余白 2 ずつ）と、日付の数字と顔文字の間 */
const CELL_VERTICAL_INSET = 1 + 2 * 2
const DAY_KAOMOJI_GAP = 2

interface Props {
  year: number
  month: number
  today: string
  cellWidth: number
  entryFor: (date: string) => DiaryEntry | undefined
  kaomojiSet: KaomojiSet
  measure: KaomojiMeasure | null
  stamp: CellStamp | null
  onPressDay: (date: string) => void
  colors: AppColors
}

export const MonthGrid: React.FC<Props> = ({
  year,
  month,
  today,
  cellWidth,
  entryFor,
  kaomojiSet,
  measure,
  stamp,
  onPressDay,
  colors,
}) => {
  const styles = useMemo(() => makeStyles(colors), [colors])
  const days = getDaysInMonth(year, month)
  const offset = getMonthStartOffset(year, month)
  const availWidth = cellAvailWidth(cellWidth)

  // 顔文字ごとの大きさ（マスの大きさはどのマスも同じなので、レベルごとに 1 回だけ計算する）
  const fits = useMemo(() => {
    const r = {} as Record<KaomojiLevel, KaomojiFit>
    for (const lv of KAOMOJI_LEVELS) {
      r[lv] = measure
        ? fitKaomojiFont({
            widthPerDp: measure.widthPerDp[lv],
            availWidth,
            heightPerDp: measure.heightPerDp[lv],
            availHeight: cellWidth - CELL_VERTICAL_INSET - measure.dayNumHeight - DAY_KAOMOJI_GAP,
          })
        : fitKaomojiFont({ widthPerDp: 0, availWidth })
    }
    return r
  }, [measure, availWidth, cellWidth])

  return (
    <View style={styles.grid}>
      {Array.from({ length: offset }).map((_, i) => (
        <View key={`pad-${i}`} style={styles.cell} />
      ))}
      {days.map((date) => {
        const entry = entryFor(date)
        const isFuture = dayTapAction(date, today) === 'none'
        return (
          <DayCell
            key={date}
            date={date}
            dayNum={parseInt(date.split('-')[2])}
            isToday={date === today}
            isFuture={isFuture}
            kaomoji={entry ? kaomojiSet[entry.level] : null}
            fit={entry ? fits[entry.level] : null}
            maxWidth={availWidth + 2}
            stamp={stamp && stamp.date === date ? stamp : null}
            onPress={onPressDay}
            styles={styles}
          />
        )
      })}
    </View>
  )
}

interface CellProps {
  date: string
  dayNum: number
  isToday: boolean
  isFuture: boolean
  kaomoji: string | null
  fit: KaomojiFit | null
  maxWidth: number
  stamp: CellStamp | null
  onPress: (date: string) => void
  styles: ReturnType<typeof makeStyles>
}

const DayCell = React.memo(function DayCell({
  date,
  dayNum,
  isToday,
  isFuture,
  kaomoji,
  fit,
  maxWidth,
  stamp,
  onPress,
  styles,
}: CellProps) {
  const shake = useRef(new Animated.Value(0)).current
  const stampT = useRef(new Animated.Value(1)).current
  const kind = stamp?.kind ?? 'fade'

  useEffect(() => {
    if (!stamp) return
    stampT.setValue(0)
    const duration = stamp.kind === 'pon' ? 560 : stamp.kind === 'soft' ? 420 : 300
    const easing = stamp.kind === 'soft' ? Easing.out(Easing.quad) : Easing.linear
    const anims = [Animated.timing(stampT, { toValue: 1, duration, easing, useNativeDriver: true })]
    if (stamp.shake) {
      shake.setValue(0)
      anims.push(
        Animated.sequence([
          Animated.delay(300),
          Animated.timing(shake, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      )
    }
    const a = Animated.parallel(anims)
    a.start()
    return () => a.stop()
    // stamp.key が変わったときだけ押す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp?.key])

  const stampStyle =
    kind === 'pon'
      ? {
          opacity: stampT.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [
            { scale: stampT.interpolate({ inputRange: [0, 0.55, 0.78, 1], outputRange: [3, 0.86, 1.08, 1] }) },
            { rotate: stampT.interpolate({ inputRange: [0, 0.55, 0.78, 1], outputRange: ['-14deg', '2deg', '0deg', '0deg'] }) },
          ],
        }
      : kind === 'soft'
        ? {
            opacity: stampT,
            transform: [{ scale: stampT.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) }],
          }
        : { opacity: stampT }

  const shakeStyle = {
    transform: [
      { translateX: shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -2, 2, -1, 1, 0] }) },
      { translateY: shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, 1, -1, 1, 0, 0] }) },
    ],
  }

  return (
    <Animated.View style={[styles.cell, isToday && styles.cellToday, isFuture && styles.cellFuture, shakeStyle]}>
      <Pressable style={styles.cellPress} onPress={() => onPress(date)} disabled={isFuture}>
        <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{dayNum}</Text>
        {kaomoji !== null && fit && (
          <Animated.View style={stampStyle}>
            <Text
              style={[styles.kaomoji, { fontSize: fit.size, maxWidth }, fit.clip && { width: maxWidth }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {kaomoji}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  )
})

/** マスの横の余白・線（calendar.tsx のマスの幅の計算と合わせる） */
export const GRID_HORIZONTAL_INSET = 8 * 2 + 8 * 2 + 1

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderColor: c.border,
      marginHorizontal: 8,
    },
    cell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    cellPress: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 2, gap: DAY_KAOMOJI_GAP },
    cellToday: { backgroundColor: c.accentLight },
    cellFuture: { opacity: 0.35 },
    dayNum: { fontSize: 12, color: c.textSecondary, fontWeight: '500' },
    dayNumToday: { color: c.accentDark, fontWeight: '700' },
    kaomoji: { color: c.text, textAlign: 'center' },
  })

/** 日付の数字の字（KaomojiMeasurer で高さを測るため） */
export const DAY_NUM_TEXT_STYLE = { fontSize: 12, fontWeight: '500' as const }
