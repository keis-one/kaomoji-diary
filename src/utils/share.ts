import { Share, Platform, Alert } from 'react-native'
import { buildShareText, type ShareOptions } from '@/domain/shareContent'

export { buildShareText }


export const shareEntry = async (options: ShareOptions): Promise<void> => {
  const message = buildShareText(options)
  const isJa = options.language === 'ja'

  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text: message })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    // Clipboard fallback
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message)
        Alert.alert(
          isJa ? 'コピーしました！' : 'Copied!',
          isJa ? 'テキストをクリップボードにコピーしました。SNSに貼り付けてシェアしてください。' : 'Text copied to clipboard. Paste it into your favorite app to share.',
        )
        return
      } catch {
        // clipboard also failed
      }
    }
    // Last resort: show text in alert
    Alert.alert(
      isJa ? 'シェア' : 'Share',
      message,
    )
  } else {
    await Share.share({ message })
  }
}
