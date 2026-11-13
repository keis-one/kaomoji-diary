/**
 * ホームで今日の分を保存した後の流れ（製品仕様 S20-2）。React Native に依存しない。
 *
 *   1. ホームで保存に成功 → start() してカレンダータブへ移る
 *   2. カレンダーが表示されたら calendarShown() → 今日の月を返す（カレンダーはその月を表示する）
 *   3. 約 0.25 秒後に 'stamp'（今日のマスにスタンプ）
 *   4. スタンプの開始から約 1 秒後に 'openSheet'（保存しましたシート）
 *
 * 途中（シートが出る前）にタブを移った・日付をタップした・月を切り替えたときは cancel() し、
 * まだ始まっていないスタンプ・シートは後から出さない。一度きりで、カレンダーに戻っても再生しない。
 */
import type { KaomojiLevel } from '@/types'
import { SAVED_FLOW_TIMING } from './celebration'

export interface Scheduler {
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

export type SavedFlowEvent =
  | { type: 'stamp'; date: string; level: KaomojiLevel }
  | { type: 'openSheet'; date: string; level: KaomojiLevel }

export interface SavedFlow {
  start: (a: { date: string; level: KaomojiLevel }) => void
  /** カレンダーが表示されたときに呼ぶ。流れを待っていたら表示する月を返し、スタンプ・シートを予約する */
  calendarShown: () => { year: number; month: number } | null
  cancel: () => void
  subscribe: (listener: (e: SavedFlowEvent) => void) => () => void
}

export const createSavedFlow = (scheduler: Scheduler): SavedFlow => {
  let pending: { date: string; level: KaomojiLevel } | null = null
  let timers: unknown[] = []
  const listeners = new Set<(e: SavedFlowEvent) => void>()
  const emit = (e: SavedFlowEvent) => listeners.forEach((l) => l(e))

  const clearTimers = () => {
    timers.forEach((t) => scheduler.clearTimeout(t))
    timers = []
  }

  return {
    start(a) {
      clearTimers()
      pending = { ...a }
    },
    calendarShown() {
      if (!pending) return null
      const { date, level } = pending
      pending = null
      clearTimers()
      timers.push(
        scheduler.setTimeout(() => {
          emit({ type: 'stamp', date, level })
          timers.push(
            scheduler.setTimeout(() => {
              timers = []
              emit({ type: 'openSheet', date, level })
            }, SAVED_FLOW_TIMING.sheetDelayAfterStampMs),
          )
        }, SAVED_FLOW_TIMING.stampDelayMs),
      )
      const [y, m] = date.split('-').map(Number)
      return { year: y, month: m }
    },
    cancel() {
      pending = null
      clearTimers()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * ホームの「保存する」。保存に成功したら流れを始めてカレンダーへ移る。トーストは出さない（保存しましたシートで知らせる）。
 * 失敗したら何もせず { ok: false } を返す（ホームにとどまり、画面がエラーの文を出す）。
 */
export const saveTodayFromHome = async (a: {
  record: (level: KaomojiLevel, comment: string) => Promise<void>
  level: KaomojiLevel
  comment: string
  today: string
  startFlow: (a: { date: string; level: KaomojiLevel }) => void
  navigateToCalendar: () => void
}): Promise<{ ok: boolean }> => {
  try {
    await a.record(a.level, a.comment)
  } catch {
    return { ok: false }
  }
  a.startFlow({ date: a.today, level: a.level })
  a.navigateToCalendar()
  return { ok: true }
}
