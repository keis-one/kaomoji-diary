/**
 * カレンダーの今日・過去日の入力・編集ポップアップ（UI仕様 4章・製品仕様 Sprint 19b）。
 *
 * - 記録が無い日: 顔文字（未選択）・一言・「キャンセル」「記録する」。顔文字を選ぶまで「記録する」は押せない
 * - 記録がある日: 保存済みの顔文字・一言・「キャンセル」「保存」・「この日の記録を削除」
 * - 「キャンセル」・外側のタップ・戻る操作: 保存せずに閉じる
 * - 保存・削除の処理中はボタンを押せない。失敗したら開いたままエラーを出し、入力は残す（成功のトーストは出さない）
 * - 一言は変更したときだけ 100 文字の上限を当てはめる（U6）
 */
import React, { useState, useEffect } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView, Keyboard, Platform } from 'react-native'
import type { DiaryEntry, KaomojiSet, Language, KaomojiLevel } from '@/types'
import { KaomojiSelector } from './KaomojiSelector'
import { getDayOfWeek, getWhatDay } from '@/utils/dayInfo'
import { checkCommentEdit, popupMode } from '@/domain/dayEditor'
import type { DayActionResult } from '@/domain/dayActions'
import { showToast } from './Toast'
import { t } from '@/i18n/strings'

interface Props {
  visible: boolean
  date: string | null
  entry: DiaryEntry | undefined
  kaomojiSet: KaomojiSet
  questionLabel: string
  language: Language
  onSubmit: (level: KaomojiLevel, comment: string) => Promise<DayActionResult>
  onDelete: () => Promise<DayActionResult>
  onClose: () => void
}

export const formatPopupDate = (date: string, language: Language): string => {
  const [y, m, d] = date.split('-')
  const dow = getDayOfWeek(date, language)
  return language === 'ja'
    ? `${parseInt(m)}月${parseInt(d)}日（${dow}）`
    : `${dow}, ${parseInt(m)}/${parseInt(d)}/${y}`
}

export const DayPopup: React.FC<Props> = ({
  visible,
  date,
  entry,
  kaomojiSet,
  questionLabel,
  language,
  onSubmit,
  onDelete,
  onClose,
}) => {
  const [level, setLevel] = useState<KaomojiLevel | null>(entry?.level ?? null)
  const [comment, setComment] = useState(entry?.comment ?? '')
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const s = t(language)

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardOffset(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOffset(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // 開くたびに保存済みの内容から始める（前回キャンセルした入力を持ち越さない）
  useEffect(() => {
    if (!visible) return
    setLevel(entry?.level ?? null)
    setComment(entry?.comment ?? '')
    setError(null)
    setConfirmingDelete(false)
    setBusy(false)
  }, [visible, entry, date])

  const mode = popupMode(!!entry)
  const commentCheck = checkCommentEdit(entry?.comment ?? '', comment)
  const canSubmit = level !== null && commentCheck.ok && !busy

  const close = () => {
    if (busy) return // 処理中は閉じない（結果を表示するため）
    if (confirmingDelete) {
      setConfirmingDelete(false) // 確認ダイアログの戻る操作 → ポップアップに戻る
      return
    }
    onClose()
  }

  const toastFor = (r: DayActionResult) =>
    r.ok ? (r.toast === 'recorded' ? s.toastRecorded : r.toast === 'saved' ? s.toastSaved : s.toastDeleted) : ''

  const handleSubmit = async () => {
    if (!canSubmit || level === null) return
    setBusy(true)
    setError(null)
    const r = await onSubmit(level, comment)
    setBusy(false)
    if (r.ok) {
      showToast(toastFor(r))
      onClose()
    } else {
      setError(s.popupSaveFailed)
    }
  }

  const handleDelete = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const r = await onDelete()
    setBusy(false)
    setConfirmingDelete(false)
    if (r.ok) {
      showToast(toastFor(r))
      onClose()
    } else {
      setError(s.popupDeleteFailed)
    }
  }

  const isJa = language === 'ja'
  const dateLabel = date ? formatPopupDate(date, language) : ''
  const whatDay = date ? getWhatDay(date, language) : null

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <View style={[styles.wrapper, { paddingBottom: keyboardOffset }]}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
              <View style={styles.handle} />

              <Text style={styles.dateText}>{dateLabel}</Text>
              {whatDay && <Text style={styles.whatDayText}>{isJa ? `「${whatDay}」` : whatDay}</Text>}
              <Text style={styles.questionText}>
                {isJa ? `今日、${questionLabel}できた？` : `Did you ${questionLabel} today?`}
              </Text>

              {level !== null && <Text style={styles.bigKaomoji}>{kaomojiSet[level]}</Text>}

              <KaomojiSelector kaomojiSet={kaomojiSet} selected={level} onSelect={setLevel} language={language} />

              <TextInput
                style={styles.commentInput}
                placeholder={isJa ? '一言メモ（任意）' : 'Note (optional)'}
                value={comment}
                onChangeText={setComment}
                multiline
                editable={!busy}
              />
              {commentCheck.tooLong && <Text style={styles.errorText}>{s.commentTooLong(commentCheck.length)}</Text>}
              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.actions}>
                <Pressable onPress={close} style={[styles.btn, styles.btnCancel]} disabled={busy}>
                  <Text style={styles.btnCancelText}>{s.cancel}</Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmit}
                  style={[styles.btn, styles.btnSave, !canSubmit && styles.btnDisabled]}
                  disabled={!canSubmit}
                >
                  <Text style={styles.btnSaveText}>{mode === 'save' ? s.popupSave : s.popupRecord}</Text>
                </Pressable>
              </View>

              {entry && (
                <Pressable onPress={() => setConfirmingDelete(true)} disabled={busy} style={styles.deleteLink}>
                  <Text style={[styles.deleteText, busy && styles.textDisabled]}>{s.popupDelete}</Text>
                </Pressable>
              )}
            </ScrollView>

            {confirmingDelete && (
              // 記録の削除の確認ダイアログ（ポップアップの上に重ねる）
              <View style={styles.confirmOverlay}>
                <View style={styles.confirmCard}>
                  <Text style={styles.confirmTitle}>{s.deleteConfirmTitle}</Text>
                  <Text style={styles.confirmBody}>{s.deleteConfirmBody(dateLabel)}</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => setConfirmingDelete(false)} style={[styles.btn, styles.btnCancel]} disabled={busy}>
                      <Text style={styles.btnCancelText}>{s.cancel}</Text>
                    </Pressable>
                    <Pressable onPress={handleDelete} style={[styles.btn, styles.btnDanger, busy && styles.btnDisabled]} disabled={busy}>
                      <Text style={styles.btnSaveText}>{s.deleteConfirmOk}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  wrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetContent: { gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 8 },
  dateText: { fontSize: 14, color: '#999', textAlign: 'center', fontWeight: '500' },
  whatDayText: { fontSize: 12, color: '#66bb6a', textAlign: 'center', fontWeight: '500' },
  questionText: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center' },
  bigKaomoji: { fontSize: 32, textAlign: 'center', color: '#333' },
  commentInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, fontSize: 14, color: '#333',
    minHeight: 60, maxHeight: 160, textAlignVertical: 'top',
  },
  errorText: { fontSize: 13, color: '#e53935' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f0f0f0' },
  btnCancelText: { color: '#555', fontWeight: '600', fontSize: 15 },
  btnSave: { backgroundColor: '#66bb6a' },
  btnDanger: { backgroundColor: '#e53935' },
  btnSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { backgroundColor: '#ccc' },
  deleteLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  deleteText: { color: '#e53935', fontSize: 14, fontWeight: '600' },
  textDisabled: { color: '#ccc' },
  confirmOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 14 },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  confirmBody: { fontSize: 14, color: '#555', lineHeight: 20 },
})
