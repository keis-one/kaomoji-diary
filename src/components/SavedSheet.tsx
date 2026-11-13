/**
 * 保存しましたシート（UI仕様 4章・製品仕様 S20-4）。ホームで今日の分を保存したときだけ、カレンダーでスタンプを押した後に出す。
 *
 * 上から: つまみ・日付・問いの行・保存した顔文字（大）・一言（表示だけ。空なら出さない。切り詰めない）・
 * 見出し「保存しました」（全レベル共通。4・5 は前後に 🎉）・「閉じる」「SNS にシェア」・連続記録（2 日以上）。
 * 閉じ方: 「閉じる」・外側のタップ・端末の戻る操作・下スワイプ（BottomSheet）。「SNS にシェア」の後も開いたまま。
 * 演出はレベル別（effectsFor）。動きを減らす設定がオンのときは短いフェードだけ。
 */
import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import type { AppColors } from '@/constants/colors'
import type { DiaryEntry, KaomojiLevel, KaomojiSet, Language } from '@/types'
import { effectsFor, type ResolvedEffects } from '@/domain/celebration'
import { shouldShowStreak } from '@/domain/entries'
import { t } from '@/i18n/strings'
import { BottomSheet } from './BottomSheet'
import { Confetti } from './Confetti'
import { formatPopupDate } from './DayPopup'

interface Props {
  visible: boolean
  date: string | null
  level: KaomojiLevel | null
  entry: DiaryEntry | undefined
  kaomojiSet: KaomojiSet
  questionLabel: string
  language: Language
  streak: number
  reduceMotion: boolean
  colors: AppColors
  isDark: boolean
  onShare: () => void
  onClose: () => void
}

export const SavedSheet: React.FC<Props> = ({
  visible,
  date,
  level,
  entry,
  kaomojiSet,
  questionLabel,
  language,
  streak,
  reduceMotion,
  colors,
  isDark,
  onShare,
  onClose,
}) => {
  const s = t(language)
  const styles = useMemo(() => makeStyles(colors), [colors])
  const fx = effectsFor(level ?? entry?.level ?? 3, reduceMotion)
  const anim = useSheetAnimations(visible, fx)
  const isJa = language === 'ja'

  return (
    <BottomSheet
      visible={visible && !!entry && !!date}
      onRequestClose={onClose}
      onDragDismiss={onClose}
      backgroundColor={colors.card}
      aboveSheet={visible ? <Confetti durationMs={fx.confettiMs} count={fx.confettiCount} isDark={isDark} /> : null}
    >
      {() =>
        entry && date ? (
          <>
            <Text style={styles.dateText}>{formatPopupDate(date, language)}</Text>
            <Text style={styles.questionText}>
              {isJa ? `今日、${questionLabel}できた？` : `Did you ${questionLabel} today?`}
            </Text>
            <Animated.Text style={[styles.bigKaomoji, anim.kaomoji]}>{kaomojiSet[entry.level]}</Animated.Text>
            {entry.comment ? <Text style={styles.memo}>{entry.comment}</Text> : null}
            <View style={styles.savedRow}>
              {fx.crackers && <Animated.Text style={[styles.cracker, anim.crackerLeft]}>🎉</Animated.Text>}
              <Animated.Text style={[styles.savedText, anim.title]} accessibilityRole="header">
                {s.savedTitle}
              </Animated.Text>
              {fx.crackers && <Animated.Text style={[styles.cracker, anim.crackerRight]}>🎉</Animated.Text>}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={onClose} style={[styles.btn, styles.btnClose]}>
                <Text style={styles.btnCloseText}>{s.close}</Text>
              </Pressable>
              <Pressable onPress={onShare} style={[styles.btn, styles.btnShare]}>
                <Text style={styles.btnShareText}>{s.shareButton}</Text>
              </Pressable>
            </View>
            {shouldShowStreak(streak) && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>{s.streakLabel(streak)}</Text>
              </View>
            )}
          </>
        ) : null
      }
    </BottomSheet>
  )
}

/** シートが開いたときの、見出し・🎉・顔文字の動き（モックアップの値） */
const useSheetAnimations = (visible: boolean, fx: ResolvedEffects) => {
  const title = useRef(new Animated.Value(1)).current
  const cracker = useRef(new Animated.Value(1)).current
  const km = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    title.setValue(0)
    cracker.setValue(0)
    km.setValue(0)
    const titleAnim =
      fx.title === 'pop'
        ? Animated.timing(title, { toValue: 1, delay: 60, duration: 480, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true })
        : Animated.timing(title, { toValue: 1, delay: 60, duration: fx.title === 'fade' ? 300 : 400, easing: Easing.out(Easing.quad), useNativeDriver: true })
    const crackerAnim =
      fx.crackerMotion === 'burst'
        ? Animated.timing(cracker, { toValue: 1, delay: 120, duration: 520, easing: Easing.bezier(0.2, 0.9, 0.3, 1.4), useNativeDriver: true })
        : Animated.timing(cracker, { toValue: 1, delay: 60, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true })
    const kmAnim = (() => {
      switch (fx.kaomoji) {
        case 'bounce2':
        case 'bounce1':
        case 'bounceSmall':
          return Animated.sequence([
            Animated.delay(500),
            Animated.loop(
              Animated.timing(km, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              { iterations: fx.kaomoji === 'bounce2' ? 2 : 1, resetBeforeIteration: true },
            ),
          ])
        case 'sway':
          return Animated.sequence([
            Animated.delay(450),
            Animated.timing(km, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        case 'tremble':
          return Animated.sequence([
            Animated.delay(450),
            Animated.timing(km, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }),
          ])
        default:
          return null
      }
    })()
    const all = Animated.parallel([titleAnim, crackerAnim, ...(kmAnim ? [kmAnim] : [])])
    all.start()
    return () => all.stop()
    // 開いたときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const fadeOnly = { opacity: title }
  const titleStyle =
    fx.title === 'pop'
      ? {
          opacity: title.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ scale: title.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
        }
      : fadeOnly

  const crackerBase = (mirror: boolean) =>
    fx.crackerMotion === 'burst'
      ? {
          opacity: cracker.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [
            ...(mirror ? [{ scaleX: -1 }] : []),
            { rotate: cracker.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '0deg'] }) },
            { scale: cracker.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          ],
        }
      : { opacity: cracker, transform: mirror ? [{ scaleX: -1 }] : [] }

  const kaomojiStyle = (() => {
    switch (fx.kaomoji) {
      case 'bounce2':
      case 'bounce1':
      case 'bounceSmall':
        return {
          transform: [
            {
              translateY: km.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, fx.kaomoji === 'bounceSmall' ? -3 : -5, 0],
              }),
            },
          ],
        }
      case 'sway':
        return {
          transform: [{ rotate: km.interpolate({ inputRange: [0, 0.3, 0.7, 1], outputRange: ['0deg', '-6deg', '6deg', '0deg'] }) }],
        }
      case 'tremble':
        return {
          transform: [
            {
              translateX: km.interpolate({
                inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
                outputRange: [0, -3, 3, -3, 3, -3, 3, -3, 3, -3, 0],
              }),
            },
          ],
        }
      default:
        return {}
    }
  })()

  return { title: titleStyle, crackerLeft: crackerBase(true), crackerRight: crackerBase(false), kaomoji: kaomojiStyle }
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    dateText: { fontSize: 14, color: c.textMuted, textAlign: 'center', fontWeight: '500' },
    questionText: { fontSize: 16, fontWeight: '600', color: c.text, textAlign: 'center' },
    bigKaomoji: { fontSize: 32, lineHeight: 44, textAlign: 'center', color: c.text },
    memo: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      color: c.text,
      backgroundColor: c.surface,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
    savedText: { fontSize: 24, fontWeight: '700', color: c.accentDark },
    cracker: { fontSize: 28 },
    actions: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnClose: { backgroundColor: c.surface },
    btnCloseText: { color: c.textSecondary, fontWeight: '600', fontSize: 15 },
    btnShare: { backgroundColor: c.accentLight, borderWidth: 1, borderColor: c.accent },
    btnShareText: { color: c.accentDark, fontWeight: '600', fontSize: 15 },
    streakBadge: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 20,
      backgroundColor: '#fff3e0',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#ffb74d',
    },
    streakText: { fontSize: 14, color: '#e65100', fontWeight: '600' },
  })
