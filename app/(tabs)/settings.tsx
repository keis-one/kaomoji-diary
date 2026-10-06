import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { useSettings } from '@/hooks/useSettings'
import { useReminder } from '@/hooks/useReminder'
import { useTheme } from '@/hooks/useTheme'
import { useDiaryStore } from '@/store'
import type { Language, Theme } from '@/types'
import type { AppColors } from '@/constants/colors'
import { KAOMOJI_LEVELS } from '@/constants/kaomoji'
import { t } from '@/i18n/strings'
import { buildMailtoUrl, openContactMail, DEVELOPER_NAME } from '@/domain/contact'
import { getAppVersion, getOsVersion } from '@/utils/appInfo'
import { BusyOverlay, ConfirmDialog } from '@/components/Dialogs'
import { ExportScreen } from '@/screens/settings/ExportScreen'
import { ImportScreen } from '@/screens/settings/ImportScreen'
import { ContactScreen } from '@/screens/settings/ContactScreen'

/**
 * 設定画面（UI仕様 6章）。
 * セクションの順番: 記録の設定 → 顔文字 → アプリ設定 → データ → アプリについて。
 *
 * 設定の下の画面（書き出し・読み込み・お問い合わせ先）は、広告・タブバーを出したままにするため
 * このタブの中で切り替える（view）。タブを移ると設定の最初の画面に戻り、途中の書き出し・確認内容は捨てる。
 *
 * 無料版は問い1つのみ。問いの追加・削除・切り替え、顔文字カスタム、プラン関連の表示・開発用トグルは置かない。
 */
type View_ = 'main' | 'export' | 'import' | 'contact'

export default function SettingsScreen() {
  const { colors } = useTheme()
  const [view, setView] = useState<View_>('main')

  // タブを移ったら（画面がフォーカスを失ったら）最初の画面に戻す
  useFocusEffect(
    useCallback(() => {
      return () => setView('main')
    }, []),
  )

  const backToMain = useCallback(() => setView('main'), [])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'left', 'right']}>
      {view === 'main' && <SettingsMain onOpen={setView} />}
      {view === 'export' && <ExportScreen onBack={backToMain} />}
      {view === 'import' && <ImportScreen onBack={backToMain} onDone={backToMain} />}
      {view === 'contact' && <ContactScreen onBack={backToMain} />}
    </SafeAreaView>
  )
}

const SettingsMain: React.FC<{ onOpen: (v: View_) => void }> = ({ onOpen }) => {
  const { settings, activeQuestion: q, updateSettings, updateQuestion } = useSettings()
  const entries = useDiaryStore((s) => s.entries)
  const resetAllData = useDiaryStore((s) => s.resetAllData)
  const reminderFailure = useDiaryStore((s) => s.reminderFailure)
  const { toggleReminder, updateReminderTime, finishReminderTimeEdit } = useReminder()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const s = t(settings.language)
  const isJa = settings.language === 'ja'

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [resetDialog, setResetDialog] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetFailed, setResetFailed] = useState(false)

  const startEdit = (id: string, label: string) => {
    setEditingId(id)
    setEditLabel(label)
  }

  const saveEdit = () => {
    if (!editingId || !editLabel.trim()) return
    updateQuestion(editingId, { label: editLabel.trim() })
    setEditingId(null)
  }

  // 全データリセット: (1) 初期状態を保存 →（成功したら）(2) リセット前の通知を解除 → (3) 言語選択へ
  // 保存に失敗したら設定画面のまま失敗を表示し、データ・通知は変えない
  const handleReset = async () => {
    setResetDialog(false)
    setResetting(true)
    setResetFailed(false)
    try {
      await resetAllData()
      setResetting(false)
      router.replace('/onboarding')
    } catch {
      setResetting(false)
      setResetFailed(true)
    }
  }

  const handleContact = async () => {
    const url = buildMailtoUrl(settings.language, getAppVersion(), getOsVersion())
    const result = await openContactMail((u) => Linking.openURL(u), url)
    if (result === 'fallback') onOpen('contact')
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>{s.settingsTitle}</Text>

        {/* 記録の設定（今日の問い。文言の編集のみ） */}
        <Section title={s.sectionRecord} styles={styles}>
          <Text style={styles.itemLabel}>{s.todaysQuestion}</Text>
          {q &&
            (editingId === q.id ? (
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
                <Text style={styles.questionLabel}>
                  {isJa ? `「${q.label}できた？」` : `"Did you ${q.label} today?"`}
                </Text>
                <Pressable onPress={() => startEdit(q.id, q.label)} style={styles.iconBtn}>
                  <Text style={styles.iconText}>✏️</Text>
                </Pressable>
              </View>
            ))}
        </Section>

        {/* 顔文字（デフォルトセットの表示のみ） */}
        <Section title={s.sectionKaomoji} styles={styles}>
          {q && (
            <View style={styles.kaomojiRow}>
              {KAOMOJI_LEVELS.map((lv) => (
                <Text key={lv} style={styles.kaomojiPreview}>
                  {q.kaomojiSet[lv]}
                </Text>
              ))}
            </View>
          )}
        </Section>

        {/* アプリ設定（リマインダー・言語・テーマ） */}
        <Section title={s.sectionApp} styles={styles}>
          {q && (
            <View style={styles.reminderRow}>
              <Text style={styles.itemLabel}>{s.reminder}</Text>
              <View style={styles.reminderRight}>
                {q.reminderEnabled && (
                  <TextInput
                    style={styles.reminderTimeInput}
                    value={q.reminderTime}
                    onChangeText={(v) => updateReminderTime(q.id, v)}
                    onEndEditing={(e) => finishReminderTimeEdit(q.id, e.nativeEvent.text)}
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
          )}
          {/* 許可の拒否・予約の失敗のあと（リマインダーは OFF に戻っている）。もう一度 ON にすると再試行できる */}
          {reminderFailure && <Text style={styles.errorText}>{s.reminderSetupFailed}</Text>}

          <Text style={styles.itemLabel}>{s.language}</Text>
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

          <Text style={styles.itemLabel}>{s.theme}</Text>
          <View style={styles.langRow}>
            {(
              [
                ['light', isJa ? '☀️ ライト' : '☀️ Light'],
                ['dark', isJa ? '🌙 ダーク' : '🌙 Dark'],
                ['system', isJa ? '⚙️ 自動' : '⚙️ Auto'],
              ] as [Theme, string][]
            ).map(([th, label]) => (
              <Pressable
                key={th}
                style={[styles.langBtn, settings.theme === th && styles.langBtnActive]}
                onPress={() => updateSettings({ theme: th })}
              >
                <Text style={[styles.langText, settings.theme === th && styles.langTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.themeHint}>
            {isJa ? '自動はスマホ本体のダーク/ライト設定に連動します' : "Auto follows your device's dark/light mode setting"}
          </Text>
        </Section>

        {/* データ */}
        <Section title={s.sectionData} styles={styles}>
          <RowButton label={s.rowExport} onPress={() => onOpen('export')} styles={styles} />
          <RowButton label={s.rowImport} onPress={() => onOpen('import')} styles={styles} />
          <RowButton
            label={s.rowReset}
            onPress={() => {
              setResetFailed(false)
              setResetDialog(true)
            }}
            styles={styles}
            danger
          />
          {resetFailed && <Text style={styles.errorText}>{s.resetFailed}</Text>}
        </Section>

        {/* アプリについて（プライバシーポリシーの行は URL が決まってから出す: Sprint 19 の残り） */}
        <Section title={s.sectionAbout} styles={styles}>
          <View style={styles.rowBtn}>
            <Text style={styles.rowBtnText}>{s.developer}</Text>
            <Text style={styles.rowValue}>{DEVELOPER_NAME}</Text>
          </View>
          <View style={styles.rowBtn}>
            <Text style={styles.rowBtnText}>{s.version}</Text>
            <Text style={styles.rowValue}>{getAppVersion()}</Text>
          </View>
          <RowButton label={s.contact} onPress={handleContact} styles={styles} />
        </Section>
      </ScrollView>

      <ConfirmDialog
        visible={resetDialog}
        colors={colors}
        onCancel={() => setResetDialog(false)}
        title={s.resetTitle}
        lines={[
          s.resetLead,
          [s.resetRecords(entries.length), s.resetQuestion(q?.label ?? ''), s.resetReminder, s.resetLangTheme].join('\n'),
        ]}
        extraButton={{
          label: s.resetExportFirst,
          onPress: () => {
            setResetDialog(false)
            onOpen('export')
          },
        }}
        buttons={[
          { label: s.cancel, onPress: () => setResetDialog(false) },
          { label: s.resetOk, onPress: handleReset, kind: 'danger' },
        ]}
      />
      <BusyOverlay visible={resetting} message={s.resetting} />
    </KeyboardAvoidingView>
  )
}

const Section: React.FC<{ title: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }> = ({
  title,
  children,
  styles,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionBody}>{children}</View>
  </View>
)

const RowButton: React.FC<{
  label: string
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
  danger?: boolean
}> = ({ label, onPress, styles, danger }) => (
  <Pressable style={styles.rowBtn} onPress={onPress}>
    <Text style={[styles.rowBtnText, danger && styles.dangerText]}>{label}</Text>
    <Text style={styles.rowBtnArrow}>›</Text>
  </Pressable>
)

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    content: { padding: 16, gap: 16, paddingBottom: 40 },
    pageTitle: { fontSize: 22, fontWeight: '700', color: c.text, marginBottom: 4 },
    section: { gap: 8 },
    sectionTitle: { fontSize: 13, color: c.textMuted, fontWeight: '600', letterSpacing: 0.5 },
    sectionBody: {
      backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 12,
      borderWidth: 1, borderColor: c.border,
    },
    itemLabel: { fontSize: 14, color: c.textSecondary },
    langRow: { flexDirection: 'row', gap: 12 },
    langBtn: {
      flex: 1, paddingVertical: 10, alignItems: 'center',
      borderWidth: 1.5, borderColor: c.border, borderRadius: 10,
    },
    langBtnActive: { borderColor: c.accent, backgroundColor: c.accentLight },
    langText: { fontSize: 14, color: c.textSecondary },
    langTextActive: { color: c.accentDark, fontWeight: '600' },
    questionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    questionLabel: { flex: 1, fontSize: 15, color: c.text },
    iconBtn: { padding: 4 },
    iconText: { fontSize: 18 },
    editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    editInput: {
      flex: 1, borderWidth: 1, borderColor: c.accent,
      borderRadius: 8, padding: 8, fontSize: 14, color: c.text,
    },
    editSaveBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: c.accent, borderRadius: 8 },
    editSaveBtnText: { color: '#fff', fontWeight: '600' },
    kaomojiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    kaomojiPreview: { fontSize: 12, color: c.textSecondary },
    reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    reminderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    reminderTimeInput: {
      fontSize: 15, fontWeight: '600', color: c.text,
      borderWidth: 1, borderColor: c.inputBorder, borderRadius: 8,
      paddingVertical: 4, paddingHorizontal: 8, width: 70, textAlign: 'center',
    },
    themeHint: { fontSize: 12, color: c.textMuted, textAlign: 'center' },
    rowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
    rowBtnText: { fontSize: 15, color: c.text },
    rowValue: { fontSize: 14, color: c.textMuted },
    rowBtnArrow: { fontSize: 20, color: c.textMuted },
    dangerText: { color: c.danger, fontWeight: '600' },
    errorText: { fontSize: 13, color: c.danger },
  })
