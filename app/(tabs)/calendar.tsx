import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native'
import { useDiaryStore } from '@/store'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { DayPopup } from '@/components/DayPopup'
import { QuestionTabs } from '@/components/QuestionTabs'
import type { AppColors } from '@/constants/colors'
import {
  formatMonthHeader,
  getDaysInMonth,
  getMonthStartOffset,
  WEEKDAY_LABELS,
  isDateToday,
} from '@/utils/date'
import { DEFAULT_KAOMOJI_SET } from '@/constants/kaomoji'
import type { KaomojiLevel } from '@/types'

export default function CalendarScreen() {
  const addOrUpdateEntry = useDiaryStore((s) => s.addOrUpdateEntry)
  const entries = useDiaryStore((s) => s.entries)
  const entryMap = useMemo(
    () => Object.fromEntries(entries.map((e) => [`${e.questionId}:${e.date}`, e])),
    [entries],
  )
  const getEntry = (date: string, questionId: string) => entryMap[`${questionId}:${date}`]
  const { settings, activeQuestion, setActiveQuestion, canAddQuestion } = useSettings()

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

  const openDay = (date: string) => {
    setSelectedDate(date)
    setPopupVisible(true)
  }

  const handleSave = (level: KaomojiLevel, comment: string) => {
    if (!selectedDate || !activeQuestion) return
    addOrUpdateEntry(activeQuestion.id, level, comment, selectedDate)
  }

  const selectedEntry = selectedDate && activeQuestion
    ? getEntry(selectedDate, activeQuestion.id)
    : undefined

  const emojiSet = activeQuestion?.kaomojiSet ?? DEFAULT_KAOMOJI_SET
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe}>
      <QuestionTabs
        questions={settings.questions}
        activeQuestionId={settings.activeQuestionId}
        onSelect={setActiveQuestion}
        canAdd={canAddQuestion}
        isPremium={settings.isPremium}
      />

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
            const isToday = isDateToday(date)
            return (
              <Pressable
                key={date}
                style={[styles.cell, isToday && styles.cellToday]}
                onPress={() => openDay(date)}
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
        onSave={handleSave}
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
  dayNum: { fontSize: 12, color: c.textSecondary, fontWeight: '500' },
  dayNumToday: { color: c.accentDark, fontWeight: '700' },
  emoji: { fontSize: 18, lineHeight: 22 },
})
