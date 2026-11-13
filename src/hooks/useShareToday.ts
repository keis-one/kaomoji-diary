import { useDiary } from '@/hooks/useDiary'
import { useSettings } from '@/hooks/useSettings'
import { useStats } from '@/hooks/useStats'
import { todayShareOptions } from '@/domain/shareContent'
import { shareEntry } from '@/utils/share'

/**
 * 今日の記録を端末の共有画面でシェアする。ホームの「SNS にシェア」と保存しましたシートの「SNS にシェア」で
 * 同じ処理を使い、同じ内容（問い・顔文字・一言・連続記録）を渡す（製品仕様 S20-4・S20-8）。
 */
export const useShareToday = (): (() => Promise<void>) => {
  const { todayEntry } = useDiary()
  const { settings, activeQuestion } = useSettings()
  const { stats } = useStats()
  return async () => {
    if (!todayEntry || !activeQuestion) return
    await shareEntry(
      todayShareOptions({
        entry: todayEntry,
        question: activeQuestion,
        language: settings.language,
        streak: stats.currentStreak,
      }),
    )
  }
}
