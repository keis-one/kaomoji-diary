/**
 * カレンダーのマスの顔文字の大きさ（製品仕様 S20-5・UI仕様 4章「マスの顔文字」）。
 *
 * 顔文字ごとに、マスに収まる最大の大きさ（上限 16dp・0.5dp 刻み）にする。
 * 8dp でも収まらなければ 8dp のまま末尾を「…」で省く（8dp より小さくしない）。
 * 文字の幅は端末の字体・文字サイズの設定で変わるので、画面側で実際に測った値（widthPerDp）を渡す。
 */

export const KAOMOJI_FONT = { max: 16, min: 8, step: 0.5 } as const

/** マスの右の線（1）・内側の余白（左右 2 ずつ）・測った幅との誤差のゆとり（2） */
const CELL_HORIZONTAL_INSET = 1 + 2 * 2 + 2

/** マスの幅から、顔文字に使える幅 */
export const cellAvailWidth = (cellWidth: number): number => cellWidth - CELL_HORIZONTAL_INSET

export interface KaomojiFit {
  size: number
  /** true のとき 8dp のまま末尾を「…」で省く */
  clip: boolean
}

const floorToStep = (v: number): number => Math.floor(v / KAOMOJI_FONT.step + 1e-9) * KAOMOJI_FONT.step

/**
 * @param widthPerDp 文字の大きさ 1dp あたりの顔文字の幅（端末の文字サイズの設定を含めて測った値）
 * @param availWidth 顔文字に使える幅
 * @param heightPerDp 1dp あたりの行の高さ（渡すと高さにも収める）
 * @param availHeight 顔文字に使える高さ
 */
export const fitKaomojiFont = (a: {
  widthPerDp: number
  availWidth: number
  heightPerDp?: number
  availHeight?: number
}): KaomojiFit => {
  const { widthPerDp, availWidth } = a
  if (!(widthPerDp > 0) || !(availWidth > 0) || !Number.isFinite(widthPerDp)) {
    return { size: KAOMOJI_FONT.min, clip: true }
  }
  const byWidth = floorToStep(availWidth / widthPerDp)
  if (byWidth < KAOMOJI_FONT.min) return { size: KAOMOJI_FONT.min, clip: true }
  let size = Math.min(byWidth, KAOMOJI_FONT.max)
  if (a.heightPerDp && a.heightPerDp > 0 && a.availHeight !== undefined) {
    const byHeight = floorToStep(Math.max(0, a.availHeight) / a.heightPerDp)
    size = Math.max(KAOMOJI_FONT.min, Math.min(size, byHeight))
  }
  return { size, clip: false }
}
