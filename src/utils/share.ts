import { Share, Platform, Alert } from 'react-native'
import type { DiaryEntry, KaomojiSet, Language } from '@/types'
import { LEVEL_LABELS } from '@/constants/kaomoji'

interface ShareOptions {
  entry: DiaryEntry
  kaomojiSet: KaomojiSet
  question: string
  language: Language
  streak?: number
  appName?: string
}

export const buildShareText = ({
  entry,
  kaomojiSet,
  question,
  language,
  streak,
  appName = '今日できた',
}: ShareOptions): string => {
  const kaomoji = kaomojiSet[entry.level]
  const label = LEVEL_LABELS[language][entry.level]
  const streakLine = streak && streak >= 2
    ? (language === 'ja' ? `🔥 ${streak}日連続記録中！` : `🔥 ${streak} day streak!`)
    : ''

  // 仕様書フォーマット: 「今日、禁煙できた？ → (＾▽＾)/ #今日できた」
  const lines =
    language === 'ja'
      ? [
          `今日、${question}できた？ → ${kaomoji}（${label}）`,
          entry.comment ? `「${entry.comment}」` : '',
          streakLine,
          `#${appName} #習慣記録`,
        ]
      : [
          `Did you ${question} today? → ${kaomoji} (${label})`,
          entry.comment ? `"${entry.comment}"` : '',
          streakLine,
          `#KaomojiDiary #HabitTracker`,
        ]

  return lines.filter(Boolean).join('\n')
}

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
