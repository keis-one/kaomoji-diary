import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSettings } from '@/hooks/useSettings'
import { useReminder } from '@/hooks/useReminder'
import { useTheme } from '@/hooks/useTheme'
import { useDiaryStore } from '@/store'
import type { Language, KaomojiSet, Theme } from '@/types'
import { KAOMOJI_LEVELS } from '@/constants/kaomoji'
import { KaomojiEditor } from '@/components/KaomojiEditor'

export default function SettingsScreen() {
  const {
    settings,
    canAddQuestion,
    updateSettings,
    addQuestion,
    updateQuestion,
    removeQuestion,
    setActiveQuestion,
  } = useSettings()
  const resetAll = useDiaryStore((s) => s.resetAll)
  const entries = useDiaryStore((s) => s.entries)

  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [kaomojiEditId, setKaomojiEditId] = useState<string | null>(null)

  const kaomojiEditQuestion = kaomojiEditId
    ? settings.questions.find((q) => q.id === kaomojiEditId)
    : null

  const { toggleReminder, updateReminderTime } = useReminder()
  const { colors } = useTheme()
  const isJa = settings.language === 'ja'

  const handleAddQuestion = () => {
    const label = newLabel.trim()
    if (!label) return
    addQuestion(label)
    setNewLabel('')
  }

  const startEdit = (id: string, label: string) => {
    setEditingId(id)
    setEditLabel(label)
  }

  const saveEdit = () => {
    if (!editingId || !editLabel.trim()) return
    updateQuestion(editingId, { label: editLabel.trim() })
    setEditingId(null)
  }

  const handleRemove = (id: string, label: string) => {
    Alert.alert(
      isJa ? '問いを削除' : 'Delete Question',
      isJa ? `「${label}」を削除しますか？この問いの記録も削除されます。` : `Delete "${label}"? Records for this question will also be deleted.`,
      [
        { text: isJa ? 'キャンセル' : 'Cancel', style: 'cancel' },
        { text: isJa ? '削除' : 'Delete', style: 'destructive', onPress: () => removeQuestion(id) },
      ],
    )
  }

  const handleReset = () => {
    Alert.alert(
      isJa ? 'データを全削除' : 'Reset All Data',
      isJa ? 'すべての記録と設定をリセットします。この操作は元に戻せません。' : 'This will delete all records and settings. This cannot be undone.',
      [
        { text: isJa ? 'キャンセル' : 'Cancel', style: 'cancel' },
        { text: isJa ? '削除する' : 'Delete', style: 'destructive', onPress: () => resetAll() },
      ],
    )
  }

  const handleExport = () => {
    const header = 'date,questionId,level,comment'
    const rows = entries.map((e) =>
      `${e.date},${e.questionId},${e.level},"${e.comment.replace(/"/g, '""')}"`,
    )
    const csv = [header, ...rows].join('\n')
    Alert.alert(isJa ? 'エクスポート' : 'Export', csv.slice(0, 300) + (csv.length > 300 ? '...' : ''))
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>{isJa ? '設定' : 'Settings'}</Text>

        {/* 言語 */}
        <Section title={isJa ? '言語' : 'Language'}>
          <View style={styles.langRow}>
            {(['ja', 'en'] as Language[]).map((lang) => (
              <Pressable
                key={lang}
                style={[styles.langBtn, settings.language === lang && styles.langBtnActive]}
                onPress={() => updateSettings({ language: lang })}
              >
                <Text style={[styles.langText, settings.language === lang && styles.langTextActive]}>
                  {lang === 'ja' ? '🇯🇵 日本語' : '🇺🇸 English'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* テーマ */}
        <Section title={isJa ? 'テーマ' : 'Theme'}>
          <View style={styles.langRow}>
            {([['light', isJa ? '☀️ ライト' : '☀️ Light'], ['dark', isJa ? '🌙 ダーク' : '🌙 Dark'], ['system', isJa ? '⚙️ 自動' : '⚙️ Auto']] as [Theme, string][]).map(([t, label]) => (
              <Pressable
                key={t}
                style={[styles.langBtn, settings.theme === t && styles.langBtnActive]}
                onPress={() => updateSettings({ theme: t })}
              >
                <Text style={[styles.langText, settings.theme === t && styles.langTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.themeHint}>
            {isJa ? '自動はスマホ本体のダーク/ライト設定に連動します' : "Auto follows your device's dark/light mode setting"}
          </Text>
        </Section>

        {/* 問い管理 */}
        <Section title={isJa ? '記録の設定' : 'Questions'}>
          {settings.questions.map((q) => (
            <View key={q.id} style={styles.questionBlock}>
              {/* 問いラベル行 */}
              {editingId === q.id ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={editLabel}
                    onChangeText={setEditLabel}
                    maxLength={20}
                    autoFocus
                  />
                  <Pressable style={styles.editSaveBtn} onPress={saveEdit}>
                    <Text style={styles.editSaveBtnText}>{isJa ? '保存' : 'Save'}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.questionRow}>
                  <Pressable
                    style={styles.questionLabelWrap}
                    onPress={() => setActiveQuestion(q.id)}
                  >
                    <Text style={styles.questionLabel}>
                      {isJa ? `「${q.label}できた？」` : `"Did you ${q.label} today?"`}
                    </Text>
                    {q.id === settings.activeQuestionId && (
                      <Text style={styles.activeTag}>{isJa ? '使用中' : 'Active'}</Text>
                    )}
                  </Pressable>
                  <Pressable onPress={() => startEdit(q.id, q.label)} style={styles.iconBtn}>
                    <Text style={styles.iconText}>✏️</Text>
                  </Pressable>
                  {settings.questions.length > 1 && (
                    <Pressable onPress={() => handleRemove(q.id, q.label)} style={styles.iconBtn}>
                      <Text style={styles.iconText}>🗑️</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* 顔文字セット表示 */}
              <View style={styles.kaomojiRow}>
                {KAOMOJI_LEVELS.map((lv) => (
                  <Text key={lv} style={styles.kaomojiPreview}>{q.kaomojiSet[lv]}</Text>
                ))}
                <Pressable
                  style={[styles.customizeBtn, !settings.isPremium && styles.customizeBtnLocked]}
                  onPress={() => {
                    if (!settings.isPremium) {
                      Alert.alert(
                        isJa ? '👑 プレミアム限定' : '👑 Premium Feature',
                        isJa
                          ? '顔文字カスタムはプレミアム機能です。プレミアムにアップグレードすると、各レベルの顔文字を自由に変更できます。'
                          : 'Custom kaomoji is a premium feature. Upgrade to premium to freely customize each level.',
                        [{ text: isJa ? 'OK' : 'OK' }],
                      )
                      return
                    }
                    setKaomojiEditId(q.id)
                  }}
                >
                  <Text style={[styles.customizeBtnText, !settings.isPremium && styles.customizeBtnTextLocked]}>
                    {settings.isPremium
                      ? (isJa ? 'カスタム ✏️' : 'Custom ✏️')
                      : (isJa ? 'カスタム 🔒' : 'Custom 🔒')}
                  </Text>
                </Pressable>
              </View>

              {/* リマインダー */}
              <View style={styles.reminderRow}>
                <Text style={styles.reminderLabel}>
                  {isJa ? 'リマインダー' : 'Reminder'}
                </Text>
                <View style={styles.reminderRight}>
                  {q.reminderEnabled && (
                    <TextInput
                      style={styles.reminderTimeInput}
                      value={q.reminderTime}
                      onChangeText={(t) => updateReminderTime(q.id, t)}
                      onEndEditing={(e) => updateReminderTime(q.id, e.nativeEvent.text)}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                  )}
                  <Switch
                    value={q.reminderEnabled}
                    onValueChange={(v) => toggleReminder(q.id, v)}
                    trackColor={{ true: '#66bb6a' }}
                  />
                </View>
              </View>
            </View>
          ))}

          {canAddQuestion && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder={isJa ? '新しい問いを追加' : 'Add question'}
                value={newLabel}
                onChangeText={setNewLabel}
                maxLength={20}
              />
              <Pressable
                style={[styles.addBtn, !newLabel.trim() && styles.addBtnDisabled]}
                onPress={handleAddQuestion}
                disabled={!newLabel.trim()}
              >
                <Text style={styles.addBtnText}>{isJa ? '追加' : 'Add'}</Text>
              </Pressable>
            </View>
          )}

          {!settings.isPremium && (
            <Text style={styles.premiumNote}>
              {isJa ? '👑 プレミアムで最大5つの問いを設定できます' : '👑 Premium: up to 5 questions'}
            </Text>
          )}
        </Section>

        {/* プレミアム */}
        {!settings.isPremium && (
          <Pressable style={styles.premiumBanner}>
            <Text style={styles.premiumBannerText}>
              👑 {isJa ? 'プレミアムにする' : 'Upgrade to Premium'}
            </Text>
            <Text style={styles.premiumBannerSub}>
              {isJa ? 'グラフ・複数問い・顔文字カスタム（準備中）' : 'Graph, multi-questions, custom kaomoji (coming soon)'}
            </Text>
          </Pressable>
        )}

        {settings.isPremium && (
          <Section title={isJa ? 'プレミアム' : 'Premium'}>
            <Text style={styles.premiumTitle}>👑 {isJa ? 'プレミアム会員' : 'Premium Member'}</Text>
            <Text style={styles.premiumSub}>{isJa ? '全機能が使えます' : 'All features unlocked'}</Text>
          </Section>
        )}

        {/* DEV toggle — Expo Go / dev client (__DEV__) と EAS preview ビルド
            (EXPO_PUBLIC_ENABLE_DEV_TOOLS=true) でのみ表示。production では非表示 */}
        {(__DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_TOOLS === 'true') && (
          <Section title="[DEV] Premium">
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Premium toggle</Text>
              <Switch
                value={settings.isPremium}
                onValueChange={(v) => updateSettings({ isPremium: v })}
                trackColor={{ true: '#66bb6a' }}
              />
            </View>
          </Section>
        )}

        {/* データ */}
        <Section title={isJa ? 'データ' : 'Data'}>
          <Pressable style={styles.rowBtn} onPress={handleExport}>
            <Text style={styles.rowBtnText}>
              {isJa ? 'データをエクスポート（CSV）' : 'Export Data (CSV)'}
            </Text>
            <Text style={styles.rowBtnArrow}>›</Text>
          </Pressable>
          <Pressable style={styles.dangerBtn} onPress={handleReset}>
            <Text style={styles.dangerBtnText}>
              {isJa ? 'すべてのデータを削除' : 'Delete All Data'}
            </Text>
          </Pressable>
        </Section>
      </ScrollView>
      </KeyboardAvoidingView>
      {kaomojiEditQuestion && (
        <KaomojiEditor
          visible={!!kaomojiEditId}
          kaomojiSet={kaomojiEditQuestion.kaomojiSet}
          questionLabel={kaomojiEditQuestion.label}
          language={settings.language}
          onSave={(newSet: KaomojiSet) => updateQuestion(kaomojiEditQuestion.id, { kaomojiSet: newSet })}
          onClose={() => setKaomojiEditId(null)}
        />
      )}
    </SafeAreaView>
  )
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
)

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 4 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, color: '#999', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionBody: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 14,
    borderWidth: 1, borderColor: '#ebebeb',
  },
  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 10,
  },
  langBtnActive: { borderColor: '#66bb6a', backgroundColor: '#e8f5e9' },
  langText: { fontSize: 14, color: '#555' },
  langTextActive: { color: '#2e7d32', fontWeight: '600' },
  questionBlock: {
    gap: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  questionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  questionLabel: { fontSize: 14, color: '#333' },
  activeTag: {
    fontSize: 11, color: '#66bb6a', backgroundColor: '#e8f5e9',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  iconBtn: { padding: 4 },
  iconText: { fontSize: 18 },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editInput: {
    flex: 1, borderWidth: 1, borderColor: '#66bb6a',
    borderRadius: 8, padding: 8, fontSize: 14, color: '#333',
  },
  editSaveBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#66bb6a', borderRadius: 8 },
  editSaveBtnText: { color: '#fff', fontWeight: '600' },
  kaomojiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  kaomojiPreview: { fontSize: 11, color: '#555' },
  customizeBtn: {
    paddingVertical: 3, paddingHorizontal: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#f0c040', backgroundColor: '#fffde7',
  },
  customizeBtnLocked: {
    borderColor: '#ccc', backgroundColor: '#f5f5f5',
  },
  customizeBtnText: { fontSize: 11, color: '#f9a825' },
  customizeBtnTextLocked: { color: '#aaa' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderLabel: { fontSize: 14, color: '#555' },
  reminderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reminderTimeInput: {
    fontSize: 15, fontWeight: '600', color: '#333',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingVertical: 4, paddingHorizontal: 8, width: 70, textAlign: 'center',
  },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd',
    borderRadius: 8, padding: 10, fontSize: 14, color: '#333',
  },
  addBtn: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: '#66bb6a', borderRadius: 8 },
  addBtnDisabled: { backgroundColor: '#ccc' },
  addBtnText: { color: '#fff', fontWeight: '600' },
  themeHint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 4 },
  premiumNote: { fontSize: 12, color: '#999', textAlign: 'center' },
  premiumBanner: {
    backgroundColor: '#fffde7', borderRadius: 14, padding: 18,
    borderWidth: 1.5, borderColor: '#f0c040', gap: 6, alignItems: 'center',
  },
  premiumBannerText: { fontSize: 17, fontWeight: '700', color: '#5d4037' },
  premiumBannerSub: { fontSize: 12, color: '#999', textAlign: 'center' },
  premiumTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  premiumSub: { fontSize: 13, color: '#999' },
  devRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  devLabel: { fontSize: 13, color: '#999' },
  rowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowBtnText: { fontSize: 14, color: '#333' },
  rowBtnArrow: { fontSize: 18, color: '#ccc' },
  dangerBtn: {
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#ef5350', borderRadius: 10, marginTop: 4,
  },
  dangerBtnText: { fontSize: 14, color: '#ef5350', fontWeight: '600' },
})
