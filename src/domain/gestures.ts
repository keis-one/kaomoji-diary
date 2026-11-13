/**
 * 指の動きの判定（純粋関数）。月の左右スワイプ（製品仕様 S20-6）と、シートの下スワイプ（S20-7）。
 * 判定の値は GESTURE の 1 か所だけで定義する（値を変えるときはここだけ直す）。
 * 距離は dp、速さは dp/ms（React Native の PanResponder の gestureState.vx / vy と同じ単位）。
 */

export const GESTURE = {
  /** これ未満の動きはタップとして扱う（方向を決めない） */
  tapSlop: 8,
  /** 表示幅（シートは高さ）のこの割合を超えて動かしたら切り替える・閉じる */
  distanceRatio: 0.25,
  /** 「素早く払う」: 指を離す直前の速さがこれを超え… */
  flingVelocity: 0.5,
  /** …かつ、これを超えて動いたとき */
  flingMinDistance: 30,
} as const

/** 月のスワイプの方向を決める。horizontal のときだけ月を動かす。縦が先・同じなら vertical（縦スクロールを妨げない） */
export const lockMonthSwipe = (dx: number, dy: number): 'horizontal' | 'vertical' | null => {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax > GESTURE.tapSlop && ax > ay) return 'horizontal'
  if (ay > GESTURE.tapSlop) return 'vertical'
  return null
}

const passes = (distance: number, velocity: number, size: number): boolean =>
  distance > size * GESTURE.distanceRatio ||
  (velocity > GESTURE.flingVelocity && distance > GESTURE.flingMinDistance)

/** 指を離したときの月の切り替え。左へ払う（dx < 0）= 次の月、右 = 前の月。取り消されたら元の月 */
export const decideMonthSwipe = (a: { dx: number; vx: number; width: number; cancelled: boolean }): 'next' | 'prev' | 'stay' => {
  if (a.cancelled) return 'stay'
  if (!passes(Math.abs(a.dx), Math.abs(a.vx), a.width)) return 'stay'
  return a.dx < 0 ? 'next' : 'prev'
}

/** シートを動かすか。下へ tapSlop を超え、横より大きいときだけ down。上・横は other（シートは動かさない） */
export const lockSheetDrag = (dx: number, dy: number): 'down' | 'other' | null => {
  if (dy > GESTURE.tapSlop && dy > Math.abs(dx)) return 'down'
  if (Math.abs(dx) > GESTURE.tapSlop || dy < -GESTURE.tapSlop) return 'other'
  return null
}

/** 指を離したときにシートを閉じるか。下向きの距離・速さだけを見る。取り消されたら閉じない */
export const decideSheetDismiss = (a: { dy: number; vy: number; height: number; cancelled: boolean }): 'close' | 'stay' => {
  if (a.cancelled) return 'stay'
  return passes(Math.max(0, a.dy), a.vy, a.height) ? 'close' : 'stay'
}

/**
 * この操作でシートを下スワイプで閉じる動きにしてよいか（操作の開始時点の状態で決める）。
 * 削除の確認中・保存や削除の処理中・一言の入力欄の中から始めた操作・開始時に中身が一番上でない → しない。
 * 途中で中身が一番上に達しても、その操作では閉じない（次の操作から）。
 */
export const canStartSheetDrag = (a: {
  confirming: boolean
  busy: boolean
  startedInInput: boolean
  scrollAtTopAtStart: boolean
}): boolean => !a.confirming && !a.busy && !a.startedInInput && a.scrollAtTopAtStart
