import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useDiary } from '@/hooks/useDiary'
import { useSettings } from '@/hooks/useSettings'
import { useStats } from '@/hooks/useStats'
import { useTheme } from '@/hooks/useTheme'
import { KaomojiSelector } from '@/components/KaomojiSelector'
import { todayIso } from '@/utils/date'
import { useShareToday } from '@/hooks/useShareToday'
import { savedFlow } from '@/store/savedFlow'
import { saveTodayFromHome } from '@/domain/savedFlow'
import { getDayOfWeek, getWhatDay } from '@/utils/dayInfo'
import type { AppColors } from '@/constants/colors'
import type { KaomojiLevel } from '@/types'
import { checkCommentEdit } from '@/domain/dayEditor'
import { shouldShowStreak } from '@/domain/entries'
import { t } from '@/i18n/strings'
import { useDiaryStore } from '@/store'

export default function HomeScreen() {
  const { todayEntry, record } = useDiary()
  const shareToday = useShareToday()
  const { settings, activeQuestion } = useSettings()
  const { stats } = useStats()
  const { colors } = useTheme()
  const [level, setLevel] = useState<KaomojiLevel | null>(todayEntry?.level ?? null)
  const [comment, setComment] = useState(todayEntry?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  // オンボーディング等でリマインダーを設定できなかったとき（リマインダーは OFF に戻っている）
  const reminderFailure = useDiaryStore((s) => s.reminderFailure)
  const clearReminderFailure = useDiaryStore((s) => s.clearReminderFailure)

  // カレンダーで今日の記録を保存・削除したときも、この表示に反映する
  React.useEffect(() => {
    setLevel(todayEntry?.level ?? null)
    setComment(todayEntry?.comment ?? '')
    setSaveFailed(false)
  }, [todayEntry, settings.activeQuestionId])

  // 一言は変更したときだけ 100 文字の上限を当てはめる（読み込みで入った長い一言はそのまま保存できる。U6）
  const commentCheck = checkCommentEdit(todayEntry?.comment ?? '', comment)
  const canSave = !!level && commentCheck.ok && !saving

  // 保存に成功したらカレンダーへ移り、今日のマスにスタンプ → 保存しましたシート（S20-2）。トーストは出さない。
  // 失敗したらホームにとどまり、エラーの文を出す
  const handleSave = async () => {
    if (!level || !canSave) return
    setSaving(true)
    setSaveFailed(false)
    const r = await saveTodayFromHome({
      record,
      level,
      comment,
      today: todayIso(),
      startFlow: (a) => savedFlow.start(a),
      navigateToCalendar: () => router.navigate('/calendar'),
    })
    if (!r.ok) setSaveFailed(true)
    setSaving(false)
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
  const s = t(settings.language)

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {reminderFailure && (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{t(settings.language).reminderSetupFailed}</Text>
              <Pressable onPress={clearReminderFailure} hitSlop={8} accessibilityLabel={t(settings.language).dismiss}>
                <Text style={styles.noticeClose}>×</Text>
              </Pressable>
            </View>
          )}
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
            multiline
          />
          {commentCheck.tooLong && (
            <Text style={styles.errorText}>{t(settings.language).commentTooLong(commentCheck.length)}</Text>
          )}
          {saveFailed && <Text style={styles.errorText}>{t(settings.language).homeSaveFailed}</Text>}

          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>{s.homeSave}</Text>
          </Pressable>

          {/* 今日の記録がある日だけ出す（S20-8） */}
          {todayEntry && (
            <Pressable style={styles.shareBtn} onPress={shareToday}>
              <Text style={styles.shareBtnText}>{s.shareButton}</Text>
            </Pressable>
          )}

          {shouldShowStreak(stats.currentStreak) && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>{s.streakLabel(stats.currentStreak)}</Text>
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
  errorText: { width: '100%', fontSize: 13, color: c.danger },
  noticeBanner: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.danger, backgroundColor: c.card,
  },
  noticeText: { flex: 1, fontSize: 13, color: c.danger },
  noticeClose: { fontSize: 18, color: c.textMuted, paddingHorizontal: 4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  shareBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: c.accentLight, alignItems: 'center', borderWidth: 1, borderColor: c.accent },
  shareBtnText: { color: c.accentDark, fontSize: 15, fontWeight: '600' },
  streakBadge: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#fff3e0', borderRadius: 20, borderWidth: 1, borderColor: '#ffb74d' },
  streakText: { fontSize: 14, color: '#e65100', fontWeight: '600' },
})
