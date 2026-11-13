/**
 * シェアする文の中身（純粋関数）。ホームの「SNS にシェア」と保存しましたシートの「SNS にシェア」は
 * どちらも todayShareOptions → buildShareText を通し、同じ内容を渡す（製品仕様 S20-4）。
 */
import type { DiaryEntry, KaomojiSet, Language } from '@/types'
import { LEVEL_LABELS } from '@/constants/kaomoji'

export interface ShareOptions {
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


/** 今日の記録のシェアの中身（問い・顔文字・一言・連続記録） */
export const todayShareOptions = (a: {
  entry: DiaryEntry
  question: { label: string; kaomojiSet: KaomojiSet }
  language: Language
  streak: number
}): ShareOptions => ({
  entry: a.entry,
  kaomojiSet: a.question.kaomojiSet,
  question: a.question.label,
  language: a.language,
  streak: a.streak,
})
