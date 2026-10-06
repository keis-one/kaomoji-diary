/**
 * 確認ダイアログ・処理中の表示・設定の下の画面の見出し（設定・書き出し・読み込みで共通）。
 * Alert.alert は Web で動かず、3つのボタン・赤いボタンの指定もできないため、Modal で作っている。
 */
import React, { useEffect } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator, BackHandler } from 'react-native'
import type { AppColors } from '@/constants/colors'

export interface DialogButton {
  label: string
  onPress: () => void
  kind?: 'default' | 'primary' | 'danger'
}

interface ConfirmDialogProps {
  visible: boolean
  title: string
  lines: string[]
  /** 横に並べるボタン（最後が確定のボタン） */
  buttons: DialogButton[]
  /** ボタンの上に別の行で出すボタン（全データリセットの「先にCSVに書き出す」） */
  extraButton?: DialogButton
  /** 戻る操作・外側のタップ */
  onCancel: () => void
  colors: AppColors
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ visible, title, lines, buttons, extraButton, onCancel, colors }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <Pressable style={styles.backdrop} onPress={onCancel}>
      <Pressable style={[styles.card, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {lines.map((l, i) => (
          <Text key={i} style={[styles.body, { color: colors.textSecondary }]}>
            {l}
          </Text>
        ))}
        {extraButton && (
          <Pressable style={[styles.btn, styles.extraBtn, { borderColor: colors.accent }]} onPress={extraButton.onPress}>
            <Text style={[styles.btnText, { color: colors.accentDark }]}>{extraButton.label}</Text>
          </Pressable>
        )}
        <View style={styles.row}>
          {buttons.map((b) => (
            <Pressable
              key={b.label}
              onPress={b.onPress}
              style={[
                styles.btn,
                styles.rowBtn,
                b.kind === 'danger'
                  ? { backgroundColor: colors.danger }
                  : b.kind === 'primary'
                    ? { backgroundColor: colors.accent }
                    : { backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.btnText, { color: b.kind === 'danger' || b.kind === 'primary' ? '#fff' : colors.textSecondary }]}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Pressable>
  </Modal>
)

/** 処理中の表示。画面全体に重ね、終わるまで戻る操作・タブ移動・ほかのボタンを受け付けない */
export const BusyOverlay: React.FC<{ visible: boolean; message: string }> = ({ visible, message }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
    <View style={styles.backdrop}>
      <View style={styles.busyCard}>
        <ActivityIndicator size="large" color="#66bb6a" />
        <Text style={styles.busyText}>{message}</Text>
      </View>
    </View>
  </Modal>
)

/** 設定の下の画面の見出し（＜ 戻る） */
export const SubScreenHeader: React.FC<{ title: string; onBack: () => void; colors: AppColors; backLabel: string }> = ({
  title,
  onBack,
  colors,
  backLabel,
}) => (
  <View style={[styles.header, { borderBottomColor: colors.border }]}>
    <Pressable onPress={onBack} style={styles.backBtn} accessibilityLabel={backLabel} hitSlop={8}>
      <Text style={[styles.backText, { color: colors.accent }]}>‹</Text>
    </Pressable>
    <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
  </View>
)

/** Android の戻る操作を受け取る（handler が true を返すと既定の動き〔ホームのタブへ戻る等〕をしない） */
export const useHardwareBack = (handler: () => boolean) => {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handler)
    return () => sub.remove()
  }, [handler])
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  rowBtn: { flex: 1 },
  extraBtn: { borderWidth: 1.5, marginTop: 6 },
  btnText: { fontSize: 15, fontWeight: '700' },
  busyCard: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 24, paddingHorizontal: 32, gap: 14, alignItems: 'center' },
  busyText: { fontSize: 15, color: '#333', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { paddingHorizontal: 10, paddingVertical: 2 },
  backText: { fontSize: 30, lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
})
