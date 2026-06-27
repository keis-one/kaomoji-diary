import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import type { KaomojiSet, KaomojiLevel, Language } from '@/types'
import { KAOMOJI_LEVELS, LEVEL_LABELS, DEFAULT_KAOMOJI_SET, PRESET_KAOMOJI_SETS } from '@/constants/kaomoji'
import { KAOMOJI_MAX_LENGTH } from '@/types'

interface Props {
  visible: boolean
  kaomojiSet: KaomojiSet
  questionLabel: string
  language: Language
  onSave: (newSet: KaomojiSet) => void
  onClose: () => void
}

export const KaomojiEditor: React.FC<Props> = ({
  visible,
  kaomojiSet,
  questionLabel,
  language,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<KaomojiSet>({ ...kaomojiSet })
  const isJa = language === 'ja'

  const update = (level: KaomojiLevel, value: string) => {
    if ([...value].length > KAOMOJI_MAX_LENGTH) return
    setDraft((prev) => ({ ...prev, [level]: value }))
  }

  const handleSave = () => {
    const invalid = KAOMOJI_LEVELS.filter((lv) => !draft[lv].trim())
    if (invalid.length > 0) {
      Alert.alert(
        isJa ? '入力エラー' : 'Input Error',
        isJa ? 'すべてのレベルに顔文字を入力してください' : 'Please enter a kaomoji for each level',
      )
      return
    }
    onSave(draft)
    onClose()
  }

  const handleReset = () => {
    Alert.alert(
      isJa ? 'デフォルトに戻す' : 'Reset to Default',
      isJa ? 'デフォルトの顔文字に戻しますか？' : 'Reset to the default kaomoji set?',
      [
        { text: isJa ? 'キャンセル' : 'Cancel', style: 'cancel' },
        {
          text: isJa ? 'リセット' : 'Reset',
          onPress: () => setDraft({ ...DEFAULT_KAOMOJI_SET }),
        },
      ],
    )
  }

  const applyPreset = (preset: KaomojiSet) => {
    setDraft({ ...preset })
  }

  const charCount = (val: string) => [...val].length

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{isJa ? 'キャンセル' : 'Cancel'}</Text>
          </Pressable>
          <Text style={styles.title}>
            {isJa ? '顔文字をカスタム' : 'Custom Kaomoji'}
          </Text>
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveText}>{isJa ? '保存' : 'Save'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            {isJa
              ? `「${questionLabel}」の顔文字セット`
              : `Kaomoji set for "${questionLabel}"`}
          </Text>

          {/* プレビュー */}
          <View style={styles.previewRow}>
            {KAOMOJI_LEVELS.map((lv) => (
              <View key={lv} style={styles.previewCell}>
                <Text style={styles.previewKaomoji} numberOfLines={1} adjustsFontSizeToFit>
                  {draft[lv] || '　'}
                </Text>
                <Text style={styles.previewLabel}>{LEVEL_LABELS[language][lv]}</Text>
              </View>
            ))}
          </View>

          {/* 各レベル入力 */}
          {KAOMOJI_LEVELS.map((lv) => (
            <View key={lv} style={styles.inputRow}>
              <View style={styles.levelTag}>
                <Text style={styles.levelNum}>{lv}</Text>
                <Text style={styles.levelLabel}>{LEVEL_LABELS[language][lv]}</Text>
              </View>
              <TextInput
                style={styles.input}
                value={draft[lv]}
                onChangeText={(v) => update(lv, v)}
                placeholder={DEFAULT_KAOMOJI_SET[lv]}
                placeholderTextColor="#ccc"
                maxLength={KAOMOJI_MAX_LENGTH * 3} // bytes approx
              />
              <Text style={[styles.count, charCount(draft[lv]) > KAOMOJI_MAX_LENGTH && styles.countOver]}>
                {charCount(draft[lv])}/{KAOMOJI_MAX_LENGTH}
              </Text>
            </View>
          ))}

          {/* プリセット */}
          <Text style={styles.presetTitle}>
            {isJa ? 'プリセット' : 'Presets'}
          </Text>
          {PRESET_KAOMOJI_SETS.map((preset, i) => (
            <Pressable key={i} style={styles.presetRow} onPress={() => applyPreset(preset)}>
              <Text style={styles.presetKaomoji}>
                {KAOMOJI_LEVELS.map((lv) => preset[lv]).join('  ')}
              </Text>
              <Text style={styles.presetApply}>
                {isJa ? '使う' : 'Use'}
              </Text>
            </Pressable>
          ))}

          <Pressable style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetText}>
              {isJa ? 'デフォルトに戻す' : 'Reset to Default'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 15, color: '#999' },
  title: { fontSize: 16, fontWeight: '700', color: '#333' },
  saveBtn: { padding: 4 },
  saveText: { fontSize: 15, color: '#66bb6a', fontWeight: '700' },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  subtitle: { fontSize: 13, color: '#999', textAlign: 'center' },
  previewRow: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  previewCell: { flex: 1, alignItems: 'center', gap: 4 },
  previewKaomoji: { fontSize: 13, color: '#333', textAlign: 'center' },
  previewLabel: { fontSize: 10, color: '#aaa' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  levelTag: { alignItems: 'center', width: 36 },
  levelNum: { fontSize: 18, fontWeight: '700', color: '#66bb6a' },
  levelLabel: { fontSize: 10, color: '#aaa' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    color: '#333',
  },
  count: { fontSize: 11, color: '#bbb', width: 32, textAlign: 'right' },
  countOver: { color: '#ef5350' },
  presetTitle: { fontSize: 13, color: '#999', fontWeight: '600', marginTop: 4 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
  },
  presetKaomoji: { fontSize: 13, color: '#444', flex: 1, flexWrap: 'wrap' },
  presetApply: { fontSize: 13, color: '#66bb6a', fontWeight: '600', marginLeft: 8 },
  resetBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginTop: 4,
  },
  resetText: { fontSize: 14, color: '#999' },
})
