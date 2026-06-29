import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { useSettings } from '@/hooks/useSettings'
import {
  isNotificationsSupported,
  requestNotificationPermissions,
  scheduleReminder,
} from '@/utils/notifications'
import { useDiaryStore } from '@/store'
import type { Language } from '@/types'

type Step = 'language' | 'question' | 'reminder'

const StepDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <View style={dotStyles.row}>
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} style={[dotStyles.dot, i < current && dotStyles.dotFilled]} />
    ))}
    <Text style={dotStyles.label}>{current}/{total}</Text>
  </View>
)

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: '#66bb6a', backgroundColor: '#fff',
  },
  dotFilled: { backgroundColor: '#66bb6a' },
  label: { fontSize: 12, color: '#aaa', marginLeft: 4 },
})

export default function OnboardingScreen() {
  const { completeOnboarding } = useSettings()
  const updateQuestion = useDiaryStore((s) => s.updateQuestion)
  const [step, setStep] = useState<Step>('language')
  const [language, setLanguage] = useState<Language>('ja')
  const [questionLabel, setQuestionLabel] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderTime, setReminderTime] = useState('21:00')

  const isJa = language === 'ja'

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang)
    setStep('question')
  }

  const handleQuestionNext = () => {
    if (!questionLabel.trim()) return
    setStep('reminder')
  }

  const handleFinish = async () => {
    completeOnboarding(questionLabel.trim(), language, reminderEnabled, reminderTime)

    // リマインダーが ON かつネイティブアプリの場合、通知をスケジュール
    if (reminderEnabled && isNotificationsSupported) {
      const granted = await requestNotificationPermissions()
      if (granted) {
        // completeOnboarding で生成された question を store から取得して通知スケジュール
        // store 更新は同期的なので、直後に questions を参照できる
        const { settings } = useDiaryStore.getState()
        const question = settings.questions[0]
        if (question) {
          const notificationId = await scheduleReminder(question, language)
          if (notificationId) {
            updateQuestion(question.id, { notificationId })
          }
        }
      }
    }

    router.replace('/(tabs)/')
  }

  // ── STEP 1: 言語 ──────────────────────────────────────────
  if (step === 'language') {
    return (
      <View style={styles.container}>
        <Text style={styles.appName}>今日、〇〇できた？</Text>
        <Text style={styles.title}>ようこそ！</Text>
        <Text style={styles.subtitle}>まず言語を選んでください</Text>

        <View style={styles.langRow}>
          <Pressable style={styles.langBtn} onPress={() => handleLanguageSelect('ja')}>
            <Text style={styles.langText}>🇯🇵 日本語</Text>
          </Pressable>
          <Pressable style={styles.langBtn} onPress={() => handleLanguageSelect('en')}>
            <Text style={styles.langText}>🇺🇸 English</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  // ── STEP 2: 問い ──────────────────────────────────────────
  if (step === 'question') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <StepDots current={2} total={3} />
          <Text style={styles.title}>
            {isJa ? 'あなたは毎日\n何を続けたいですか？' : 'What habit do you\nwant to build?'}
          </Text>

          <View style={styles.questionPreview}>
            <Text style={styles.questionFixed}>
              {isJa ? '今日、' : 'Did you '}
            </Text>
            <TextInput
              style={styles.questionInput}
              placeholder={isJa ? '禁煙' : 'exercise'}
              value={questionLabel}
              onChangeText={setQuestionLabel}
              maxLength={20}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleQuestionNext}
            />
            <Text style={styles.questionFixed}>
              {isJa ? 'できた？' : ' today?'}
            </Text>
          </View>

          <Text style={styles.hint}>
            {isJa ? '例：禁煙 / ダイエット / 勉強 / 運動' : 'e.g. exercise / study / meditation'}
          </Text>

          <Pressable
            style={[styles.nextBtn, !questionLabel.trim() && styles.nextBtnDisabled]}
            onPress={handleQuestionNext}
            disabled={!questionLabel.trim()}
          >
            <Text style={styles.nextBtnText}>{isJa ? '次へ →' : 'Next →'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  // ── STEP 3: リマインダー ──────────────────────────────────
  return (
    <View style={styles.container}>
      <StepDots current={3} total={3} />
      <Text style={styles.title}>
        {isJa ? '毎日の記録を\nお知らせしますか？' : 'Get a daily reminder?'}
      </Text>

      <View style={styles.reminderRow}>
        <Pressable
          style={[styles.reminderBtn, reminderEnabled && styles.reminderBtnActive]}
          onPress={() => setReminderEnabled(true)}
        >
          <Text style={[styles.reminderBtnText, reminderEnabled && styles.reminderBtnTextActive]}>
            {isJa ? '◉ する' : '◉ Yes'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.reminderBtn, !reminderEnabled && styles.reminderBtnActive]}
          onPress={() => setReminderEnabled(false)}
        >
          <Text style={[styles.reminderBtnText, !reminderEnabled && styles.reminderBtnTextActive]}>
            {isJa ? '○ しない' : '○ No'}
          </Text>
        </Pressable>
      </View>

      {reminderEnabled && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>{isJa ? '時刻：' : 'Time:'}</Text>
          <TextInput
            style={styles.timeInput}
            value={reminderTime}
            onChangeText={setReminderTime}
            placeholder="21:00"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </View>
      )}

      <Pressable style={styles.nextBtn} onPress={handleFinish}>
        <Text style={styles.nextBtnText}>{isJa ? 'はじめる！' : 'Get Started!'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 24,
    backgroundColor: '#fff',
  },
  appName: { fontSize: 18, color: '#66bb6a', fontWeight: '700' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#777', textAlign: 'center' },
  langRow: { flexDirection: 'row', gap: 16, marginVertical: 8 },
  langBtn: {
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 2,
    borderColor: '#66bb6a',
    borderRadius: 16,
    backgroundColor: '#e8f5e9',
  },
  langText: { fontSize: 18, color: '#2e7d32', fontWeight: '600' },
  questionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  questionFixed: { fontSize: 20, color: '#555', fontWeight: '500' },
  questionInput: {
    fontSize: 20,
    color: '#333',
    fontWeight: '700',
    borderBottomWidth: 2,
    borderBottomColor: '#66bb6a',
    minWidth: 80,
    textAlign: 'center',
    paddingVertical: 4,
  },
  hint: { fontSize: 13, color: '#bbb', textAlign: 'center' },
  nextBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#66bb6a',
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#ccc' },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', gap: 16 },
  reminderBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  reminderBtnActive: { borderColor: '#66bb6a', backgroundColor: '#e8f5e9' },
  reminderBtnText: { fontSize: 16, color: '#999' },
  reminderBtnTextActive: { color: '#2e7d32', fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeLabel: { fontSize: 16, color: '#555' },
  timeInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 10,
    width: 90,
    textAlign: 'center',
  },
})
