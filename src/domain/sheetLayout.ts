/**
 * 下から出るシートの下の余白（純粋関数）。
 * Android（SDK 56 は edge-to-edge）では Modal の中身がナビゲーションバーの下まで広がるため、
 * 安全領域の下の幅を足す（Sprint 20 実機確認の不具合 D2）。キーボードを出している間はキーボードの高さを
 * 別に空けているので足さない。
 */
export const sheetBottomPadding = (a: { base: number; insetBottom: number; keyboardOffset: number }): number => {
  if (a.keyboardOffset > 0) return a.base
  const inset = Number.isFinite(a.insetBottom) && a.insetBottom > 0 ? a.insetBottom : 0
  return a.base + inset
}
