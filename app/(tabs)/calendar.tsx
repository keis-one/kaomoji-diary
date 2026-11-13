import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { useDiaryStore } from '@/store'
import { savedFlow } from '@/store/savedFlow'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { useStats } from '@/hooks/useStats'
import { useReduceMotion } from '@/hooks/useReduceMotion'
import { useShareToday } from '@/hooks/useShareToday'
import { DayPopup } from '@/components/DayPopup'
import { SavedSheet } from '@/components/SavedSheet'
import { MonthGrid, GRID_HORIZONTAL_INSET, type CellStamp, type KaomojiMeasure } from '@/components/MonthGrid'
import { KaomojiMeasurer } from '@/components/KaomojiMeasurer'
import type { AppColors } from '@/constants/colors'
import { formatMonthHeader, WEEKDAY_LABELS, todayIso } from '@/utils/date'
import type { KaomojiLevel } from '@/types'
import { dayTapAction } from '@/domain/dayEditor'
import { submitDayEntry, deleteDayEntry, shouldStampAfterDayAction } from '@/domain/dayActions'
import { effectsFor, SAVED_FLOW_TIMING } from '@/domain/celebration'
import { decideMonthSwipe, lockMonthSwipe } from '@/domain/gestures'
import { createMonthSlider } from '@/domain/monthSlider'

type YearMonth = { year: number; month: number }
const addMonths = (v: YearMonth, k: number): YearMonth => {
  const t = v.year * 12 + (v.month - 1) + k
  return { year: Math.floor(t / 12), month: (t % 12) + 1 }
}
const EMPTY_SET = { 1: '', 2: '', 3: '', 4: '', 5: '' }
const SLIDE_MS = 240
const SNAP_BACK_MS = 200

export default function CalendarScreen() {
  const saveEntry = useDiaryStore((s) => s.saveEntry)
  const deleteEntry = useDiaryStore((s) => s.deleteEntry)
  const entries = useDiaryStore((s) => s.entries)
  const entryMap = useMemo(
    () => Object.fromEntries(entries.map((e) => [`${e.questionId}:${e.date}`, e])),
    [entries],
  )
  const { settings, activeQuestion } = useSettings()
  const { colors, isDark } = useTheme()
  const { stats } = useStats()
  const reduceMotion = useReduceMotion()
  const shareToday = useShareToday()
  const { width: screenW } = useWindowDimensions()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const questionId = activeQuestion?.id ?? ''
  const getEntry = useCallback((date: string) => entryMap[`${questionId}:${date}`], [entryMap, questionId])
  const kaomojiSet = activeQuestion?.kaomojiSet ?? settings.questions[0]?.kaomojiSet ?? EMPTY_SET

  const [view, setView] = useState<YearMonth>(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupVisible, setPopupVisible] = useState(false)
  // 保存しましたシート（閉じる動きの間も中身を出しておくため、開閉と中身を分けて持つ）
  const [savedOpen, setSavedOpen] = useState(false)
  const [saved, setSaved] = useState<{ date: string; level: KaomojiLevel } | null>(null)
  const [stamp, setStamp] = useState<CellStamp | null>(null)
  const [measure, setMeasure] = useState<KaomojiMeasure | null>(null)

  const todayStr = todayIso()
  const weekdays = WEEKDAY_LABELS[settings.language]
  const cellWidth = (screenW - GRID_HORIZONTAL_INSET) / 7

  // ---------- スタンプ ----------
  const stampSeq = useRef(0)
  const reduceMotionRef = useRef(reduceMotion)
  reduceMotionRef.current = reduceMotion
  const playStamp = useCallback((date: string, level: KaomojiLevel) => {
    const fx = effectsFor(level, reduceMotionRef.current)
    stampSeq.current += 1
    setStamp({ date, key: stampSeq.current, kind: fx.stamp, shake: fx.shake })
  }, [])
  const editStampTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 編集シートで保存した後のスタンプの予約を取り消す（月の切り替え・カレンダーから離れたとき・アンマウント）
  const cancelEditStamp = useCallback(() => {
    if (editStampTimer.current) clearTimeout(editStampTimer.current)
    editStampTimer.current = null
  }, [])
  useEffect(() => cancelEditStamp, [cancelEditStamp])

  // ---------- ホームで保存した後の流れ（S20-2） ----------
  useEffect(
    () =>
      savedFlow.subscribe((e) => {
        if (e.type === 'stamp') {
          playStamp(e.date, e.level)
        } else {
          setSaved({ date: e.date, level: e.level })
          setSavedOpen(true)
        }
      }),
    [playStamp],
  )
  useFocusEffect(
    useCallback(() => {
      // ホームで保存してきたときは、前に見ていた月に関係なく今日の月を出す
      const m = savedFlow.calendarShown()
      if (m) setView(m)
      // 別のタブへ移ったら、まだ始まっていないスタンプ・シートを取り消す（戻っても再生しない）
      return () => {
        savedFlow.cancel()
        cancelEditStamp()
      }
    }, [cancelEditStamp]),
  )

  // ---------- 月の切り替え（‹ › ・左右スワイプ。S20-6） ----------
  const translateX = useRef(new Animated.Value(-screenW)).current
  const widthRef = useRef(screenW)
  widthRef.current = screenW

  // 動きの間（月を変える・戻る）は次のスワイプ・‹ › を受け付けない（S20-6・E20-01。手順は src/domain/monthSlider.ts）
  const slider = useMemo(
    () =>
      createMonthSlider({
        animateTo: (target, done) => {
          const W = widthRef.current
          const toValue = target === 'next' ? -2 * W : target === 'prev' ? 0 : -W
          Animated.timing(translateX, {
            toValue,
            duration: target === 'center' ? SNAP_BACK_MS : SLIDE_MS,
            easing: target === 'center' ? Easing.out(Easing.quad) : Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(({ finished }) => done(finished))
        },
        commitMonth: (dir) => setView((v) => addMonths(v, dir)),
        // 月を切り替えたら、保存した後のまだ始まっていない演出と、編集シートの後のスタンプの予約を取り消す
        onMonthChangeStart: () => {
          savedFlow.cancel()
          cancelEditStamp()
        },
      }),
    [translateX, cancelEditStamp],
  )

  // 表示する月・幅が変わったら、真ん中の月が見える位置に戻す（描き直しと同じタイミング）。ここで操作をまた受け付ける
  // 月が変わるとマスを作り直すので、押し終わったスタンプを消しておく（戻ってきたときに押し直さない）
  useLayoutEffect(() => {
    translateX.setValue(-screenW)
    slider.monthShown()
    setStamp(null)
  }, [view, screenW, translateX, slider])

  const swipe = useRef<{ lock: 'horizontal' | 'vertical' | null }>({ lock: null })

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 指を置いた時点ではマス（日付のタップ）に任せ、横に動いたときだけ月の切り替えにする
        onStartShouldSetPanResponderCapture: () => {
          swipe.current.lock = null
          return false
        },
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (slider.isBusy()) return false
          if (swipe.current.lock === null) swipe.current.lock = lockMonthSwipe(g.dx, g.dy)
          return swipe.current.lock === 'horizontal'
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          translateX.setValue(-widthRef.current + g.dx)
        },
        onPanResponderRelease: (_, g) => {
          slider.finishSwipe(decideMonthSwipe({ dx: g.dx, vx: g.vx, width: widthRef.current, cancelled: false }))
        },
        onPanResponderTerminate: (_, g) => {
          slider.finishSwipe(decideMonthSwipe({ dx: g.dx, vx: g.vx, width: widthRef.current, cancelled: true }))
        },
      }),
    [translateX, slider],
  )

  // ---------- 日のタップ・編集シート ----------
  // 今日と過去日は入力・編集ポップアップを開く（範囲の制限なし）。未来の日は何もしない（U8）
  const openDay = useCallback((date: string) => {
    if (dayTapAction(date, todayIso()) !== 'open') return
    savedFlow.cancel() // 保存しましたシートは出さず、編集シートだけを開く（2 つのシートを重ねない）
    setSelectedDate(date)
    setPopupVisible(true)
  }, [])

  const selectedEntry = selectedDate ? getEntry(selectedDate) : undefined

  const handleSubmit = async (level: KaomojiLevel, comment: string) => {
    const date = selectedDate as string
    const r = await submitDayEntry(saveEntry, {
      date,
      questionId,
      level,
      comment,
      hadEntry: !!selectedEntry,
    })
    // 編集シートで保存したときも、シートが閉じてからそのマスにスタンプを押す（保存しましたシートは出さない。S20-3）
    if (shouldStampAfterDayAction(r)) {
      if (editStampTimer.current) clearTimeout(editStampTimer.current)
      editStampTimer.current = setTimeout(() => playStamp(date, level), SAVED_FLOW_TIMING.editStampDelayMs)
    }
    return r
  }

  const handleDelete = () => deleteDayEntry(deleteEntry, selectedDate as string, questionId)

  const savedEntry = saved ? getEntry(saved.date) : undefined

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={styles.header}>
          <Pressable onPress={() => slider.change(-1)} style={styles.navBtn} accessibilityLabel={settings.language === 'ja' ? '前の月' : 'Previous month'}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {formatMonthHeader(new Date(view.year, view.month - 1), settings.language)}
          </Text>
          <Pressable onPress={() => slider.change(1)} style={styles.navBtn} accessibilityLabel={settings.language === 'ja' ? '次の月' : 'Next month'}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((w) => (
            <Text key={w} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        {/* 前の月・表示中の月・次の月を横に並べ、指の動きに合わせて動かす */}
        <View style={styles.swipeArea} {...pan.panHandlers}>
          <Animated.View style={[styles.track, { width: screenW * 3, transform: [{ translateX }] }]}>
            {[-1, 0, 1].map((k) => {
              const ym = addMonths(view, k)
              return (
                <View key={k} style={{ width: screenW }}>
                  <MonthGrid
                    year={ym.year}
                    month={ym.month}
                    today={todayStr}
                    cellWidth={cellWidth}
                    entryFor={getEntry}
                    kaomojiSet={kaomojiSet}
                    measure={measure}
                    stamp={k === 0 ? stamp : null}
                    onPressDay={openDay}
                    colors={colors}
                  />
                </View>
              )
            })}
          </Animated.View>
        </View>
      </ScrollView>

      <KaomojiMeasurer kaomojiSet={kaomojiSet} onMeasured={setMeasure} />

      <DayPopup
        visible={popupVisible}
        date={selectedDate}
        entry={selectedEntry}
        kaomojiSet={kaomojiSet}
        questionLabel={activeQuestion?.label ?? ''}
        language={settings.language}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onClose={() => setPopupVisible(false)}
      />

      <SavedSheet
        visible={savedOpen}
        date={saved?.date ?? null}
        level={saved?.level ?? null}
        entry={savedEntry}
        kaomojiSet={kaomojiSet}
        questionLabel={activeQuestion?.label ?? ''}
        language={settings.language}
        streak={stats.currentStreak}
        reduceMotion={reduceMotion}
        colors={colors}
        isDark={isDark}
        onShare={shareToday}
        onClose={() => setSavedOpen(false)}
      />
    </SafeAreaView>
  )
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: { padding: 8 },
  navText: { fontSize: 24, color: c.accent },
  monthLabel: { fontSize: 18, fontWeight: '600', color: c.text },
  weekRow: { flexDirection: 'row', paddingHorizontal: 8, marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, color: c.textMuted, fontWeight: '500' },
  swipeArea: { overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
})
