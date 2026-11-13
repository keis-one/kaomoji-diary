/**
 * 保存した後の演出（スタンプ・保存しましたシート・紙吹雪）のレベル別の表（製品仕様 Sprint 20「レベル別の演出」）。
 * 表はここ 1 か所だけに置く。画面（StampKaomoji・SavedSheet・Confetti）はこの結果に従って動かす。
 *
 * 5・4・1 はオーナーの指示。3・2 と、1・2 のスタンプ・1〜3 の見出しの出し方は Planner の提案（オーナー承認済み）。
 */
import type { KaomojiLevel } from '@/types'

/** pon = 大きく出て着地 / soft = そっと押す */
export type StampKind = 'pon' | 'soft'
/** pop = ポンと出る / quiet = 静かに出る */
export type TitleKind = 'pop' | 'quiet'
export type KaomojiMotion = 'bounce2' | 'bounce1' | 'bounceSmall' | 'sway' | 'tremble'

export interface LevelEffects {
  stamp: StampKind
  /** スタンプのときにマスが揺れる */
  shake: boolean
  title: TitleKind
  /** 見出しの前後のクラッカー 🎉 */
  crackers: boolean
  kaomoji: KaomojiMotion
  /** 紙吹雪を降らせる時間（0 = 出さない） */
  confettiMs: number
  confettiCount: number
}

export const LEVEL_EFFECTS: Record<KaomojiLevel, LevelEffects> = {
  5: { stamp: 'pon', shake: true, title: 'pop', crackers: true, kaomoji: 'bounce2', confettiMs: 3000, confettiCount: 90 },
  4: { stamp: 'pon', shake: true, title: 'pop', crackers: true, kaomoji: 'bounce1', confettiMs: 1000, confettiCount: 50 },
  3: { stamp: 'pon', shake: false, title: 'quiet', crackers: false, kaomoji: 'bounceSmall', confettiMs: 0, confettiCount: 0 },
  2: { stamp: 'soft', shake: false, title: 'quiet', crackers: false, kaomoji: 'sway', confettiMs: 0, confettiCount: 0 },
  1: { stamp: 'soft', shake: false, title: 'quiet', crackers: false, kaomoji: 'tremble', confettiMs: 0, confettiCount: 0 },
}

export interface ResolvedEffects {
  stamp: StampKind | 'fade'
  shake: boolean
  title: TitleKind | 'fade'
  crackers: boolean
  /** burst = 弾ける / fade = 見出しと一緒に短いフェード / none = 🎉 なし */
  crackerMotion: 'burst' | 'fade' | 'none'
  kaomoji: KaomojiMotion | 'none'
  confettiMs: number
  confettiCount: number
}

/**
 * レベルと端末の「動きを減らす」設定から、実際に出す演出を決める（S20-9）。
 * 動きを減らす設定がオンなら、紙吹雪・揺れ・跳ね・傾き・震えを出さず、スタンプと見出しは短いフェードだけにする。
 * 🎉 の有無（見出しの中身）はレベルどおりで、動きだけフェードにする。
 */
export const effectsFor = (level: KaomojiLevel, reduceMotion: boolean): ResolvedEffects => {
  const e = LEVEL_EFFECTS[level]
  if (reduceMotion) {
    return {
      stamp: 'fade',
      shake: false,
      title: 'fade',
      crackers: e.crackers,
      crackerMotion: e.crackers ? 'fade' : 'none',
      kaomoji: 'none',
      confettiMs: 0,
      confettiCount: 0,
    }
  }
  return { ...e, crackerMotion: e.crackers ? 'burst' : 'none' }
}

/** 保存した後の流れの時間（UI仕様 4章「時間の目安」） */
export const SAVED_FLOW_TIMING = {
  /** カレンダーが出てからスタンプまで */
  stampDelayMs: 250,
  /** スタンプの開始から保存しましたシートまで */
  sheetDelayAfterStampMs: 1000,
  /** 編集シートで保存したとき、シートが閉じてからスタンプまで（閉じる動き 220ms の後） */
  editStampDelayMs: 300,
} as const
