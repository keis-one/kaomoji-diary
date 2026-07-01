import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native'
import type { DiaryEntry, KaomojiSet, Language, KaomojiLevel } from '@/types'
import { KaomojiSelector } from './KaomojiSelector'
import { LEVEL_LABELS } from '@/constants/kaomoji'
import { getDayOfWeek, getWhatDay } from '@/utils/dayInfo'

interface Props {
  visible: boolean
  date: string | null
  entry: DiaryEntry | undefined
  kaomojiSet: KaomojiSet
  questionLabel: string
  language: Language
  onSave: (level: KaomojiLevel, comment: string) => void
  onClose: () => void
}

export const DayPopup: React.FC<Props> = ({
  visible,
  date,
  entry,
  kaomojiSet,
  questionLabel,
  language,
  onSave,
  onClose,
}) => {
  const [level, setLevel] = useState<KaomojiLevel | null>(entry?.level ?? null)
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardOffset(e.endCoordinates.height)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOffset(0)
    })
    return () => { show.remove(); hide.remove() }
  }, [])

  React.useEffect(() => {
    setLevel(entry?.level ?? null)
    setComment(entry?.comment ?? '')
  }, [entry, date])

  const handleSave = () => {
    if (!level) return
    onSave(level, comment)
    onClose()
  }

  const labels = LEVEL_LABELS[language]
  const isJa = language === 'ja'

  const dateLabel = date ? (() => {
    const [y, m, d] = date.split('-')
    const dow = getDayOfWeek(date, language)
    return isJa
      ? `${parseInt(m)}月${parseInt(d)}日（${dow}）`
      : `${dow}, ${parseInt(m)}/${parseInt(d)}/${y}`
  })() : ''
  const whatDay = date ? getWhatDay(date, language) : null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.wrapper, { paddingBottom: keyboardOffset }]}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sheetContent}
            >
              <View style={styles.handle} />

              <Text style={styles.dateText}>{dateLabel}</Text>
              {whatDay && (
                <Text style={styles.whatDayText}>
                  {isJa ? `「${whatDay}」` : whatDay}
                </Text>
              )}
              <Text style={styles.questionText}>
                {isJa ? `今日、${questionLabel}できた？` : `Did you ${questionLabel} today?`}
              </Text>

              {level !== null && (
                <Text style={styles.bigKaomoji}>{kaomojiSet[level]}</Text>
              )}

              <KaomojiSelector
                kaomojiSet={kaomojiSet}
                selected={level}
                onSelect={setLevel}
                language={language}
              />

              <TextInput
                style={styles.commentInput}
                placeholder={isJa ? '一言メモ（任意）' : 'Note (optional)'}
                value={comment}
                onChangeText={setComment}
                maxLength={100}
                multiline
              />

              <View style={styles.actions}>
                <Pressable
                  onPress={handleSave}
                  style={[styles.btn, styles.btnSave, !level && styles.btnDisabled]}
                  disabled={!level}
                >
                  <Text style={styles.btnSaveText}>
                    {entry ? (isJa ? '更新' : 'Update') : (isJa ? '記録' : 'Save')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetContent: {
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  whatDayText: {
    fontSize: 12,
    color: '#66bb6a',
    textAlign: 'center',
    fontWeight: '500',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  bigKaomoji: {
    fontSize: 32,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSave: {
    backgroundColor: '#66bb6a',
  },
  btnSaveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    backgroundColor: '#ccc',
  },
})
