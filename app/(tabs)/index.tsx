import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useDiary } from '@/hooks/useDiary'
import { useSettings } from '@/hooks/useSettings'
import { useStats } from '@/hooks/useStats'
import { useTheme } from '@/hooks/useTheme'
import { KaomojiSelector } from '@/components/KaomojiSelector'
import { QuestionTabs } from '@/components/QuestionTabs'
import { todayIso } from '@/utils/date'
import { shareEntry } from '@/utils/share'
import { getDayOfWeek, getWhatDay } from '@/utils/dayInfo'
import type { AppColors } from '@/constants/colors'
import type { KaomojiLevel } from '@/types'

export default function HomeScreen() {
  const { todayEntry, record } = useDiary()
  const { settings, activeQuestion, setActiveQuestion, canAddQuestion } = useSettings()
  const { stats } = useStats()
  const { colors } = useTheme()
  const [level, setLevel] = useState<KaomojiLevel | null>(todayEntry?.level ?? null)
  const [comment, setComment] = useState(todayEntry?.comment ?? '')
  const [saved, setSaved] = useState(false)

  React.useEffect(() => {
    setLevel(todayEntry?.level ?? null)
    setComment(todayEntry?.comment ?? '')
    setSaved(false)
  }, [todayEntry, settings.activeQuestionId])

  const handleSave = () => {
    if (!level) return
    record(level, comment)
    setSaved(true)
  }

  const handleShare = async () => {
    if (!todayEntry || !activeQuestion) return
    await shareEntry({
      entry: todayEntry,
      kaomojiSet: activeQuestion.kaomojiSet,
      question: activeQuestion.label,
      language: settings.language,
      streak: stats.currentStreak,
    })
  }

  const today = todayIso()
  const [y, m, d] = today.split('-')
  const dow = getDayOfWeek(today, settings.language)
  const whatDay = getWhatDay(today, settings.language)
  const isJa = settings.language === 'ja'
  const dateLabel = isJa
    ? `${y}年${parseInt(m)}月${parseInt(d)}日（${dow}）`
    : `${dow}, ${parseInt(m)}/${parseInt(d)}/${y}`
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.date}>{dateLabel}</Text>
          {whatDay && (
            <Text style={styles.whatDay}>
              {isJa ? `今日は「${whatDay}」` : whatDay}
            </Text>
          )}
          <Text style={styles.question}>
            {settings.language === 'ja'
              ? `今日、${activeQuestion?.label ?? '…'}できた？`
              : `Did you ${activeQuestion?.label ?? '…'} today?`}
          </Text>

          <View style={styles.kaomojiCard}>
            {level !== null && activeQuestion ? (
              <Text style={styles.bigKaomoji}>{activeQuestion.kaomojiSet[level]}</Text>
            ) : (
              <Text style={styles.placeholder}>
                {settings.language === 'ja' ? '選んでね' : 'Choose'}
              </Text>
            )}
          </View>

          <KaomojiSelector
            kaomojiSet={activeQuestion?.kaomojiSet ?? settings.questions[0]?.kaomojiSet ?? { 1: '', 2: '', 3: '', 4: '', 5: '' }}
            selected={level}
            onSelect={setLevel}
            language={settings.language}
          />

          <TextInput
            style={styles.commentInput}
            placeholder={settings.language === 'ja' ? '一言メモ（任意）' : 'Comment (optional)'}
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            maxLength={100}
            multiline
          />

          <Pressable
            style={[styles.saveBtn, !level && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!level}
          >
            <Text style={styles.saveBtnText}>
              {settings.language === 'ja'
                ? (todayEntry ? '編集する' : '記録する')
                : (todayEntry ? 'Update' : 'Save')}
            </Text>
          </Pressable>

          {(saved || todayEntry) && (
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>
                {settings.language === 'ja' ? '📤 SNS にシェア' : '📤 Share'}
              </Text>
            </Pressable>
          )}

          {stats.currentStreak > 1 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>
                {settings.language === 'ja'
                  ? `🔥 ${stats.currentStreak}日連続記録中！`
                  : `🔥 ${stats.currentStreak} day streak!`}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { padding: 24, gap: 16, alignItems: 'center' },
  date: { fontSize: 14, color: c.textMuted },
  whatDay: { fontSize: 12, color: c.accent, fontWeight: '500' },
  question: { fontSize: 20, fontWeight: '600', color: c.text, textAlign: 'center' },
  kaomojiCard: {
    width: '100%', alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.card, borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 16,
    borderWidth: 1, borderColor: c.border,
  },
  bigKaomoji: { fontSize: 48, textAlign: 'center', lineHeight: 64, color: c.text },
  placeholder: { fontSize: 48, textAlign: 'center', color: c.border, lineHeight: 64 },
  commentInput: {
    width: '100%', borderWidth: 1, borderColor: c.inputBorder,
    borderRadius: 12, padding: 12, fontSize: 14, color: c.text,
    minHeight: 60, textAlignVertical: 'top', backgroundColor: c.card,
  },
  saveBtn: { width: '100%', paddingVertical: 15, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: c.border },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  shareBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: c.accentLight, alignItems: 'center', borderWidth: 1, borderColor: c.accent },
  shareBtnText: { color: c.accentDark, fontSize: 15, fontWeight: '600' },
  streakBadge: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#fff3e0', borderRadius: 20, borderWidth: 1, borderColor: '#ffb74d' },
  streakText: { fontSize: 14, color: '#e65100', fontWeight: '600' },
})
