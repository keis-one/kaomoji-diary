/**
 * カレンダーの月のスライド（‹ › ・左右スワイプ）の手順と、動きの間の操作の止め方（純粋なロジック）。
 * 製品仕様 S20-6「切り替えの動きの途中は、次のスワイプ・‹ › を受け付けない」。E20-01 で、戻り（stay）の動きの間も止めるようにした。
 *
 * - change(dir): 月を変える動きを始める。動きの間・戻りの間は受け付けない（false）
 * - finishSwipe(decision): 指を離したときの判定（next / prev / stay）に従って動かす
 * - monthShown(): 新しい月が描かれた（真ん中に戻した）ときに呼ぶ。ここで操作をまた受け付ける
 * 動きが完了しなかった（システムに取り消された）ときも、また受け付ける。
 */
export type SlideTarget = 'prev' | 'next' | 'center'

export interface MonthSliderDeps {
  /** 指定の位置へ動かし、終わったら done(完了したか) を呼ぶ */
  animateTo: (target: SlideTarget, done: (finished: boolean) => void) => void
  /** 表示する月を変える（dir = 1: 次の月、-1: 前の月） */
  commitMonth: (dir: 1 | -1) => void
  /** 月を変える動きを始めたとき（保存した後のまだ始まっていない演出などを取り消す） */
  onMonthChangeStart?: () => void
}

export interface MonthSlider {
  isBusy: () => boolean
  change: (dir: 1 | -1) => boolean
  finishSwipe: (decision: 'next' | 'prev' | 'stay') => void
  monthShown: () => void
}

export const createMonthSlider = (deps: MonthSliderDeps): MonthSlider => {
  let busy = false
  const change = (dir: 1 | -1): boolean => {
    if (busy) return false
    busy = true
    deps.onMonthChangeStart?.()
    deps.animateTo(dir > 0 ? 'next' : 'prev', (finished) => {
      if (finished) deps.commitMonth(dir) // 操作の再開は monthShown（新しい月が描かれてから）
      else busy = false
    })
    return true
  }
  return {
    isBusy: () => busy,
    change,
    finishSwipe(decision) {
      if (decision === 'stay') {
        busy = true
        deps.animateTo('center', () => {
          busy = false
        })
        return
      }
      change(decision === 'next' ? 1 : -1)
    },
    monthShown() {
      busy = false
    },
  }
}
