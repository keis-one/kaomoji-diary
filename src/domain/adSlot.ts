/**
 * バナー広告の枠の高さ（製品仕様 Sprint 19a 追補 A4・オーナー確定 U4）。
 *
 * アンカー型アダプティブバナーは端末の幅で高さが変わり、読み込みが終わるまで高さが分からない。
 * 読み込み前の空の枠と広告表示時の枠の高さを揃えられないため、U4 の「読み込み前に高さを決められない
 * 場合」に当たるとして、高さ固定の 320×50 バナー（BannerAdSize.BANNER）を使う。
 * 枠の高さは読み込みの状態（読み込み前・表示中・失敗）に関係なく常に同じ。
 */

export const AD_BANNER_WIDTH = 320
export const AD_SLOT_HEIGHT = 50

export type AdSlotState = 'loading' | 'loaded' | 'failed'
export type AdSlotEvent = 'loaded' | 'failedToLoad'

export const nextAdSlotState = (_state: AdSlotState, event: AdSlotEvent): AdSlotState =>
  event === 'loaded' ? 'loaded' : 'failed'

/** 広告の枠の高さ。状態に関係なく一定（読み込みの前後・失敗時で画面がずれない） */
export const adSlotHeight = (_state: AdSlotState): number => AD_SLOT_HEIGHT

/** 失敗したら広告部品を外し、空の枠だけ残す */
export const shouldRenderAd = (state: AdSlotState): boolean => state !== 'failed'
