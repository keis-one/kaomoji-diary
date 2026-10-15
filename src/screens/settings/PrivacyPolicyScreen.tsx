/**
 * 「プライバシーポリシー」の URL を表示する画面（ブラウザを開けなかったときだけ表示する。
 * お問い合わせ先の画面 6-4 と同じ方針: 開けなかった理由を書き、URL を表示し、「URLをコピー」でクリップボードにコピーする）。
 */
import React, { useCallback } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { t } from '@/i18n/strings'
import { PRIVACY_POLICY_URL } from '@/domain/privacyPolicy'
import { copyToClipboard } from '@/utils/appInfo'
import { showToast } from '@/components/Toast'
import { SubScreenHeader, useHardwareBack } from '@/components/Dialogs'
import { makeStyles } from './ExportScreen'

export const PrivacyPolicyScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const language = useDiaryStore((s) => s.settings.language)
  const { colors } = useTheme()
  const s = t(language)
  const styles = makeStyles(colors)

  const handleBack = useCallback(() => {
    onBack()
    return true
  }, [onBack])
  useHardwareBack(handleBack)

  const handleCopy = async () => {
    try {
      await copyToClipboard(PRIVACY_POLICY_URL)
      showToast(s.toastCopied)
    } catch {
      // コピーできなかったときはトーストを出さない（URL は画面に表示されている）
    }
  }

  return (
    <View style={styles.flex}>
      <SubScreenHeader title={s.privacyPolicy} onBack={handleBack} colors={colors} backLabel={s.back} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.value}>{s.privacyNoBrowser}</Text>
        <View style={styles.card}>
          <Text selectable style={[styles.value, { fontSize: 15, fontWeight: '700', textAlign: 'center' }]}>
            {PRIVACY_POLICY_URL}
          </Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={handleCopy}>
          <Text style={styles.primaryBtnText}>{s.privacyCopy}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
