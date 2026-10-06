/**
 * 問いの入力し直し（UI仕様 2章「問いの入力し直し」・製品仕様 Sprint 19a 追補 A3）。
 * オンボーディング完了済みなのに問いの設定が空・壊れているときだけ表示する。記録・言語・テーマは残っている。
 * 入力欄はオンボーディング STEP 2 と同じ（空欄では進めない）。ステップドット・広告・タブバーは出さない。
 * 進むと、記録の最も新しい問いIDを引き継いで問いを作り直し（リマインダーは OFF）、ホームへ移る。
 */
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useDiaryStore } from '@/store'
import { t } from '@/i18n/strings'

export default function RecoverQuestionScreen() {
  const language = useDiaryStore((s) => s.settings.language)
  const recoverQuestion = useDiaryStore((s) => s.recoverQuestion)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const s = t(language)
  const isJa = language === 'ja'
  const canSubmit = label.trim().length > 0 && !busy

  const handleStart = async () => {
    if (!canSubmit) return
    setBusy(true)
    setFailed(false)
    try {
      await recoverQuestion(label.trim())
      router.replace('/(tabs)/')
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.message}>{s.recoverMessage}</Text>

        <View style={styles.questionPreview}>
          <Text style={styles.questionFixed}>{isJa ? '今日、' : 'Did you '}</Text>
          <TextInput
            style={styles.questionInput}
            placeholder={isJa ? '禁煙' : 'exercise'}
            value={label}
            onChangeText={setLabel}
            maxLength={20}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleStart}
          />
          <Text style={styles.questionFixed}>{isJa ? 'できた？' : ' today?'}</Text>
        </View>

        {failed && <Text style={styles.error}>{s.recoverSaveFailed}</Text>}

        <Pressable
          style={[styles.nextBtn, !canSubmit && styles.nextBtnDisabled]}
          onPress={handleStart}
          disabled={!canSubmit}
        >
          <Text style={styles.nextBtnText}>{s.recoverStart}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 24, backgroundColor: '#fff' },
  message: { fontSize: 16, color: '#333', textAlign: 'center', lineHeight: 24 },
  questionPreview: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  questionFixed: { fontSize: 20, color: '#555', fontWeight: '500' },
  questionInput: {
    fontSize: 20, color: '#333', fontWeight: '700', borderBottomWidth: 2, borderBottomColor: '#66bb6a',
    minWidth: 80, textAlign: 'center', paddingVertical: 4,
  },
  error: { fontSize: 14, color: '#e53935', textAlign: 'center' },
  nextBtn: { width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: '#66bb6a', alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#ccc' },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
})
