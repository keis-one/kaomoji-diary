/**
 * カレンダーの「前の月・表示中の月・次の月」を横に並べた面（トラック）の状態（純粋なロジック）。
 *
 * 月が変わるたびに key を変え、画面は面を作り直す（真ん中の位置から始まる新しい Animated.Value を使う）。
 * ネイティブで動かした値を setValue で真ん中に戻すと、React のシャドウツリーには書かれず、
 * 見た目と押した場所の判定がずれる（Sprint 20 実機確認の不具合 D1）。そのため戻すのではなく作り直す。
 */
export interface YearMonth {
  year: number
  month: number
}

export interface MonthTrack extends YearMonth {
  /** 面の識別。月が変わるたびに変わる */
  key: number
  /** 面の最初の位置（真ん中の月が見える位置） */
  startOffset: (width: number) => number
}

export const addMonths = (v: YearMonth, k: number): YearMonth => {
  const t = v.year * 12 + (v.month - 1) + k
  return { year: Math.floor(t / 12), month: (t % 12) + 1 }
}

const centerOffset = (width: number): number => -width

let keySeq = 0
const make = (ym: YearMonth): MonthTrack => ({ ...ym, key: ++keySeq, startOffset: centerOffset })

export const initialMonthTrack = (ym: YearMonth): MonthTrack => make(ym)

export const shiftMonthTrack = (t: MonthTrack, dir: number): MonthTrack => make(addMonths(t, dir))

/** 表示する月にする（ホームで保存してきたときなど）。同じ月でも新しい面にする */
export const jumpMonthTrack = (ym: YearMonth): MonthTrack => make(ym)

/** 面に並べる 3 か月（前・表示中・次） */
export const trackPaneMonths = (t: YearMonth): [YearMonth, YearMonth, YearMonth] => [
  addMonths(t, -1),
  { year: t.year, month: t.month },
  addMonths(t, 1),
]
