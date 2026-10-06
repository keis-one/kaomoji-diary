/**
 * トースト（UI仕様 1章）。画面下部（広告・タブバーのすぐ上）に出て、数秒で自動的に消える。
 * 操作を妨げないよう、タッチは受け取らない（pointerEvents="none"）。成功したときだけ出す。
 *
 * 使い方: どこからでも showToast('記録しました')。表示は ToastHost（タブバーの上に置いている）が行う。
 */
import { useEffect } from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { createStore, useStore } from 'zustand'

/** トーストを出しておく時間（ミリ秒）。UI仕様 8章「トーストの表示時間」の Engineering 決定 */
export const TOAST_DURATION_MS = 2500

const toastStore = createStore<{ message: string | null; seq: number }>(() => ({ message: null, seq: 0 }))

export const showToast = (message: string): void => {
  toastStore.setState((s) => ({ message, seq: s.seq + 1 }))
}

export function ToastHost() {
  const message = useStore(toastStore, (s) => s.message)
  const seq = useStore(toastStore, (s) => s.seq)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => {
      // 後から別のトーストが出ていたら、そちらは消さない
      if (toastStore.getState().seq === seq) toastStore.setState({ message: null })
    }, TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [message, seq])

  if (!message) return null
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // タブバー（と広告）の入れ物の上端の、さらに上に出す
  wrap: { position: 'absolute', left: 0, right: 0, bottom: '100%', alignItems: 'center', paddingBottom: 12 },
  toast: {
    backgroundColor: 'rgba(40,40,40,0.92)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    maxWidth: '90%',
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
})
