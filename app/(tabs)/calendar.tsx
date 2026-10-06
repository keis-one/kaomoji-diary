import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useDiaryStore } from '@/store'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { DayPopup } from '@/components/DayPopup'
import type { AppColors } from '@/constants/colors'
import {
  formatMonthHeader,
  getDaysInMonth,
  getMonthStartOffset,
  WEEKDAY_LABELS,
  todayIso,
} from '@/utils/date'
import { DEFAULT_EMOJI_SET } from '@/constants/kaomoji'
import type { KaomojiLevel } from '@/types'
import { dayTapAction } from '@/domain/dayEditor'
import { submitDayEntry, deleteDayEntry } from '@/domain/dayActions'

export default function CalendarScreen() {
  const saveEntry = useDiaryStore((s) => s.saveEntry)
  const deleteEntry = useDiaryStore((s) => s.deleteEntry)
  const entries = useDiaryStore((s) => s.entries)
  const entryMap = useMemo(
    () => Object.fromEntries(entries.map((e) => [`${e.questionId}:${e.date}`, e])),
    [entries],
  )
  const getEntry = (date: string, questionId: string) => entryMap[`${questionId}:${date}`]
  const { settings, activeQuestion } = useSettings()

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupVisible, setPopupVisible] = useState(false)

  const days = getDaysInMonth(viewYear, viewMonth)
  const offset = getMonthStartOffset(viewYear, viewMonth)
  const weekdays = WEEKDAY_LABELS[settings.language]

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const todayStr = todayIso()

  // 今日と過去日は入力・編集ポップアップを開く（範囲の制限なし）。未来の日は何もしない（U8）
  const openDay = (date: string) => {
    if (dayTapAction(date, todayIso()) !== 'open') return
    setSelectedDate(date)
    setPopupVisible(true)
  }

  const handleSubmit = (level: KaomojiLevel, comment: string) =>
    submitDayEntry(saveEntry, {
      date: selectedDate as string,
      questionId: activeQuestion?.id ?? '',
      level,
      comment,
      hadEntry: !!selectedEntry,
    })

  const handleDelete = () => deleteDayEntry(deleteEntry, selectedDate as string, activeQuestion?.id ?? '')

  const selectedEntry = selectedDate && activeQuestion
    ? getEntry(selectedDate, activeQuestion.id)
    : undefined

  // セルには絵文字、ポップアップには顔文字を出す（UI仕様 4章・要件定義書 8章のハイブリッド方式）
  const emojiSet = DEFAULT_EMOJI_SET
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={styles.header}>
          <Pressable onPress={prevMonth} style={styles.navBtn}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.monthLabel}>
            {formatMonthHeader(new Date(viewYear, viewMonth - 1), settings.language)}
          </Text>
          <Pressable onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((w) => (
            <Text key={w} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {Array.from({ length: offset }).map((_, i) => (
            <View key={`pad-${i}`} style={styles.cell} />
          ))}
          {days.map((date) => {
            const entry = activeQuestion ? getEntry(date, activeQuestion.id) : undefined
            const dayNum = parseInt(date.split('-')[2])
            const isToday = date === todayStr
            const isFuture = dayTapAction(date, todayStr) === 'none'
            return (
              <Pressable
                key={date}
                style={[styles.cell, isToday && styles.cellToday, isFuture && styles.cellFuture]}
                onPress={() => openDay(date)}
                disabled={isFuture}
              >
                <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                  {dayNum}
                </Text>
                {entry && (
                  <Text style={styles.emoji} numberOfLines={1} adjustsFontSizeToFit>
                    {emojiSet[entry.level]}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>

      <DayPopup
        visible={popupVisible}
        date={selectedDate}
        entry={selectedEntry}
        kaomojiSet={activeQuestion?.kaomojiSet ?? settings.questions[0]?.kaomojiSet ?? { 1: '', 2: '', 3: '', 4: '', 5: '' }}
        questionLabel={activeQuestion?.label ?? ''}
        language={settings.language}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        onClose={() => setPopupVisible(false)}
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
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8,
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: c.border, marginHorizontal: 8,
  },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center',
    justifyContent: 'center', padding: 2,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border,
  },
  cellToday: { backgroundColor: c.accentLight },
  cellFuture: { opacity: 0.35 },
  dayNum: { fontSize: 12, color: c.textSecondary, fontWeight: '500' },
  dayNumToday: { color: c.accentDark, fontWeight: '700' },
  emoji: { fontSize: 18, lineHeight: 22, color: c.text },
})
