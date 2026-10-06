import { Redirect } from 'expo-router'
import { View, ActivityIndicator, Text, Pressable, StyleSheet } from 'react-native'
import { useDiaryStore, needsQuestionRecovery } from '@/store'
import { useHydration } from '@/hooks/useHydration'
import { t } from '@/i18n/strings'

/**
 * 起動時の振り分け。
 * - 保存データの読み込み前: 読み込み中の表示
 * - 読み込めなかった: 記録を上書きしないよう先に進まず、もう一度試すボタンを出す
 * - オンボーディング未完了: オンボーディング
 * - オンボーディング完了済みなのに問いの設定が使えない: 問いの入力し直し（記録は消さない。製品仕様 Sprint 19a 追補 A3）
 * - それ以外: ホーム
 *
 * 起動時の判定から全記録を削除することはしない（全記録を消すのは全データリセットと
 * 読み込みの「すべて置き換える」の確定だけ）。
 */
export default function Index() {
  const { hydrated, hydrationError } = useHydration()
  const isOnboardingDone = useDiaryStore((s) => s.isOnboardingDone)
  const recovery = useDiaryStore((s) => needsQuestionRecovery(s))
  const hydrate = useDiaryStore((s) => s.hydrate)

  if (hydrationError) {
    // 言語の設定も読めていないため、日本語・英語を並べて出す
    return (
      <View style={styles.center}>
        {(['ja', 'en'] as const).map((lang) => (
          <View key={lang} style={styles.block}>
            <Text style={styles.title}>{t(lang).loadFailedTitle}</Text>
            <Text style={styles.body}>{t(lang).loadFailedBody}</Text>
          </View>
        ))}
        <Pressable style={styles.btn} onPress={() => void hydrate()}>
          <Text style={styles.btnText}>{`${t('ja').retry} / ${t('en').retry}`}</Text>
        </Pressable>
      </View>
    )
  }

  if (!hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#66bb6a" />
      </View>
    )
  }

  if (!isOnboardingDone) return <Redirect href="/onboarding" />
  if (recovery) return <Redirect href="/recover-question" />
  return <Redirect href="/(tabs)/" />
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 32, gap: 20 },
  block: { gap: 6 },
  title: { fontSize: 17, fontWeight: '700', color: '#333', textAlign: 'center' },
  body: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  btn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#66bb6a' },
  btnText: { color: '#fff', fontWeight: '700' },
})
