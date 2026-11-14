// Sprint 20 の実機確認（versionCode 4・Galaxy S10+）で出た不具合の回帰テスト。
//
// D1: カレンダーで「編集して保存 → 前の月へスワイプ → 今の月へ戻す」と、見出しは 11 月なのに中身が 12 月（未来日で押せない）。
//     ②③だけでも日付を押しても編集シートが開かない。
//   原因: 月のスライドの動き（ネイティブで動かす）が終わると、React は終わりの位置（-2W / 0）をシャドウツリーに書き込む。
//   その直後に同じ値を setValue(-W) で真ん中へ戻していたが、ネイティブで動かす値の setValue はシャドウツリーに書かれない。
//   その結果「画面に見える位置」と「シャドウツリーの位置」がずれ、(a) 描き直しの順番によっては 12 月の面が見えたまま、
//   (b) 見た目は合っていても、押した場所の判定（Pressable の範囲の計測はシャドウツリーを使う）がずれて押せない。
//   直し方: 月が変わるたびに、真ん中の位置から始まる新しい面（新しい Animated.Value・key）を作る。setValue で戻さない。
//
// ここでは、ネイティブで動かす値とシャドウツリーの関係をまねた小さなモデルで、手順を再現する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initialMonthTrack, shiftMonthTrack, trackPaneMonths, type MonthTrack } from '@/domain/monthTrack'
import { createMonthSlider } from '@/domain/monthSlider'
import { sheetBottomPadding } from '@/domain/sheetLayout'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const code = (r: string) => stripComments(readFileSync(path.join(ROOT, r), 'utf8'))

const W = 412

/** ネイティブで動かす Animated.Value と、それを使う面（View）。React の描き直しで「JS の値」がシャドウツリーに書かれる */
class FabricTrack {
  jsValue: number
  native: number
  shadow: number
  constructor(initial: number) {
    this.jsValue = initial
    this.native = initial
    this.shadow = initial
  }
  /** ネイティブの動きが終わった: 画面と JS の値が終わりの位置になり、React が描き直しを予約する */
  animationEnded(to: number) {
    this.native = to
    this.jsValue = to
  }
  /** ネイティブで動かす値の setValue: 画面と JS の値だけ。シャドウツリーには書かれない（AnimatedValue.setValue の flush なし） */
  setValue(v: number) {
    this.native = v
    this.jsValue = v
  }
  /** React の描き直し（その時点の JS の値を書く） */
  commit(jsValueAtRender: number) {
    this.shadow = jsValueAtRender
  }
}

/** 旧実装の手順: 同じ面を使い回し、月が変わった後の描き直しの後（useLayoutEffect）で setValue(-W) で真ん中に戻す */
const runOldImplementation = (dirs: Array<1 | -1>) => {
  const track = new FabricTrack(-W)
  let month = 11
  for (const dir of dirs) {
    const to = dir > 0 ? -2 * W : 0
    track.animationEnded(to)
    const jsAtRender = track.jsValue // 動きの終わりの描き直しと、月の変更の描き直しは同じ回にまとまる
    month += dir
    track.commit(jsAtRender)
    track.setValue(-W) // useLayoutEffect（描き直しの後）
  }
  return { track, month }
}

/** 新しい手順: 月が変わるたびに、真ん中の位置から始まる新しい面を作る */
const runNewImplementation = (dirs: Array<1 | -1>) => {
  let state: MonthTrack = initialMonthTrack({ year: 2026, month: 11 })
  let track = new FabricTrack(state.startOffset(W))
  const slider = createMonthSlider({
    animateTo: (target, done) => {
      track.animationEnded(target === 'next' ? -2 * W : target === 'prev' ? 0 : -W)
      track.commit(track.jsValue)
      done(true)
    },
    commitMonth: (dir) => {
      state = shiftMonthTrack(state, dir)
      track = new FabricTrack(state.startOffset(W)) // key が変わり、面を作り直す
    },
  })
  for (const dir of dirs) {
    assert.equal(slider.change(dir), true, '前の動きが終わっていれば、次の操作を受け付ける')
    slider.monthShown()
  }
  return { track, state, slider }
}

test('D1 再現: 旧実装の手順では、画面の位置とシャドウツリーの位置がずれる（押した場所の判定がずれる）', () => {
  const { track } = runOldImplementation([-1, 1])
  assert.equal(track.native, -W)
  assert.notEqual(track.shadow, track.native, '旧実装ではずれる（これが不具合）')
  assert.equal(track.shadow, -2 * W, 'シャドウツリーは次の月（12 月）の面の位置のまま')
})

for (const [name, dirs] of [
  ['前の月 → 戻す（‹ ›・スワイプとも同じ手順）', [-1, 1]],
  ['次の月 → 戻す', [1, -1]],
  ['前の月へ 3 回続けて', [-1, -1, -1]],
  ['次の月へ 2 回 → 前へ 3 回', [1, 1, -1, -1, -1]],
] as Array<[string, Array<1 | -1>]>) {
  test(`D1: ${name} の後も、見出しの月 = 真ん中の面の月、画面とシャドウツリーの位置が一致し、操作を受け付ける`, () => {
    const { track, state, slider } = runNewImplementation(dirs)
    const expected = 11 + dirs.reduce((a, b) => a + b, 0)
    const panes = trackPaneMonths(state)
    const expectedYm = { year: 2026 + Math.floor((expected - 1) / 12), month: ((expected - 1) % 12 + 12) % 12 + 1 }
    assert.deepEqual({ year: state.year, month: state.month }, expectedYm, '見出しの月')
    assert.deepEqual(panes[1], expectedYm, '真ん中の面の月 = 見出しの月')
    assert.equal(track.native, -W, '真ん中の面が見えている')
    assert.equal(track.shadow, track.native, '押した場所の判定と見た目が一致')
    assert.equal(slider.isBusy(), false)
  })
}

test('D1: 月が変わるたびに面の key が変わる（同じ面を setValue で戻さない）', () => {
  const a = initialMonthTrack({ year: 2026, month: 12 })
  const b = shiftMonthTrack(a, 1)
  const c = shiftMonthTrack(b, -1)
  assert.deepEqual([b.year, b.month], [2027, 1])
  assert.deepEqual([c.year, c.month], [2026, 12])
  assert.notEqual(a.key, b.key)
  assert.notEqual(b.key, c.key)
  assert.notEqual(a.key, c.key, '同じ月に戻っても新しい面')
  assert.equal(a.startOffset(W), -W)
  assert.deepEqual(trackPaneMonths(a), [{ year: 2026, month: 11 }, { year: 2026, month: 12 }, { year: 2027, month: 1 }])
})

test('D1: カレンダーは面を月ごとに作り直し、ネイティブで動かした値を setValue で真ん中へ戻さない', () => {
  const cal = code('app/(tabs)/calendar.tsx')
  assert.match(cal, /key=\{track\.key\}/, '面の key は月ごとに変わる')
  assert.match(cal, /new Animated\.Value\(track\.startOffset\(/, '面ごとに新しい値')
  assert.doesNotMatch(cal, /\.setValue\(-screenW\)|\.setValue\(-W\)|\.setValue\(-widthRef\.current\)/, '真ん中へ戻す setValue を使わない')
  assert.doesNotMatch(cal, /useLayoutEffect/, '描き直しの後で位置を戻す処理を残さない')
})

// ---------- D2: 保存しましたシートの下の「連続記録中」がナビゲーションバーに隠れる ----------

test('D2: シートの下の余白は、ナビゲーションバー（安全領域）の分を足す。キーボードを出している間は足さない', () => {
  assert.equal(sheetBottomPadding({ base: 36, insetBottom: 48, keyboardOffset: 0 }), 84)
  assert.equal(sheetBottomPadding({ base: 36, insetBottom: 0, keyboardOffset: 0 }), 36)
  assert.equal(sheetBottomPadding({ base: 36, insetBottom: 48, keyboardOffset: 300 }), 36)
  assert.equal(sheetBottomPadding({ base: 36, insetBottom: Number.NaN, keyboardOffset: 0 }), 36)
})

test('D2: BottomSheet は安全領域の下の幅（useSafeAreaInsets）を中身の下の余白に足す', () => {
  const bs = code('src/components/BottomSheet.tsx')
  assert.match(bs, /useSafeAreaInsets\(\)/)
  assert.match(bs, /sheetBottomPadding\(/)
})

// ---------- D3: シートを下スワイプで閉じられない ----------

test('D3: つまみの帯（中身のスクロールの外）は、指を置いた時点でシートの下スワイプを受け持つ（動きの取り合いに頼らない）', () => {
  const bs = code('src/components/BottomSheet.tsx')
  const zone = bs.slice(bs.indexOf('const handlePan'), bs.indexOf('const handlePan') + 900)
  assert.match(zone, /onStartShouldSetPanResponder: \(\) => !live\.current\.dragBlocked/)
  // つまみの帯は ScrollView の外（上）に置く
  const jsx = bs.slice(bs.indexOf('<Modal'))
  assert.ok(jsx.indexOf('{...handlePan.panHandlers}') > 0)
  assert.ok(jsx.indexOf('{...handlePan.panHandlers}') < jsx.indexOf('<ScrollView'), 'つまみの帯は ScrollView より前')
  // 中身の部分は、取り込み（capture）と通常（bubble）の両方で下スワイプを判定する
  assert.match(bs, /onMoveShouldSetPanResponderCapture: shouldClaimContentMove/)
  assert.match(bs, /onMoveShouldSetPanResponder: shouldClaimContentMove/)
})
