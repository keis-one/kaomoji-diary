/**
 * 6-4.「お問い合わせ先」画面（メールアプリを開けなかったときだけ表示する。UI仕様 6-4）。
 * アドレスを表示し、「アドレスをコピー」でクリップボードにコピーする。
 */
import React, { useCallback } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { t } from '@/i18n/strings'
import { CONTACT_EMAIL, CONTACT_SUBJECT } from '@/domain/contact'
import { copyToClipboard, getAppVersion, getOsVersion } from '@/utils/appInfo'
import { showToast } from '@/components/Toast'
import { SubScreenHeader, useHardwareBack } from '@/components/Dialogs'
import { makeStyles } from './ExportScreen'

export const ContactScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
      await copyToClipboard(CONTACT_EMAIL)
      showToast(s.toastCopied)
    } catch {
      // コピーできなかったときはトーストを出さない（アドレスは画面に表示されている）
    }
  }

  return (
    <View style={styles.flex}>
      <SubScreenHeader title={s.contactTitle} onBack={handleBack} colors={colors} backLabel={s.back} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.value}>{s.contactNoMailApp}</Text>
        <View style={styles.card}>
          <Text selectable style={[styles.value, { fontSize: 17, fontWeight: '700', textAlign: 'center' }]}>
            {CONTACT_EMAIL}
          </Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={handleCopy}>
          <Text style={styles.primaryBtnText}>{s.contactCopy}</Text>
        </Pressable>
        <View style={styles.card}>
          <Text style={styles.label}>{s.contactSubjectExample}</Text>
          <Text selectable style={styles.value}>
            {CONTACT_SUBJECT}
          </Text>
          <Text selectable style={styles.note}>
            {s.appVersionLine(getAppVersion())}
          </Text>
          <Text selectable style={styles.note}>
            {s.osVersionLine(getOsVersion())}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
