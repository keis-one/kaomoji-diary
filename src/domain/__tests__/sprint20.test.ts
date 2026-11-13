// Sprint 20（ホームの「保存する」・保存後の演出・顔文字のカレンダー・スワイプ操作）の判定のテスト。
// 画面の動きそのものは実機で確かめる（S20-R1〜R11）。ここでは判定・順番・表を確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEVEL_EFFECTS, effectsFor, SAVED_FLOW_TIMING } from '@/domain/celebration'
import {
  GESTURE,
  lockMonthSwipe,
  decideMonthSwipe,
  lockSheetDrag,
  decideSheetDismiss,
  canStartSheetDrag,
} from '@/domain/gestures'
import { KAOMOJI_FONT, fitKaomojiFont, cellAvailWidth } from '@/domain/kaomojiFit'
import { createSavedFlow, saveTodayFromHome, type SavedFlowEvent } from '@/domain/savedFlow'
import { shouldStampAfterDayAction, submitDayEntry, deleteDayEntry } from '@/domain/dayActions'
import { buildConfetti } from '@/domain/confetti'
import { todayShareOptions, buildShareText } from '@/domain/shareContent'
import { DEFAULT_KAOMOJI_SET } from '@/constants/kaomoji'
import type { KaomojiLevel } from '@/types'

// ---------- レベル別の演出（表は 1 か所: LEVEL_EFFECTS） ----------

test('レベル別の演出: 5〜1 の組み合わせが仕様の表どおり', () => {
  const pick = (lv: KaomojiLevel) => {
    const e = effectsFor(lv, false)
    return [e.stamp, e.shake, e.title, e.crackers, e.kaomoji, e.confettiMs > 0 ? e.confettiMs : 0]
  }
  assert.deepEqual(pick(5), ['pon', true, 'pop', true, 'bounce2', 3000])
  assert.deepEqual(pick(4), ['pon', true, 'pop', true, 'bounce1', 1000])
  assert.deepEqual(pick(3), ['pon', false, 'quiet', false, 'bounceSmall', 0])
  assert.deepEqual(pick(2), ['soft', false, 'quiet', false, 'sway', 0])
  assert.deepEqual(pick(1), ['soft', false, 'quiet', false, 'tremble', 0])
  // 紙吹雪の量: 5 は 4 より多い。1〜3 は無し
  assert.ok(LEVEL_EFFECTS[5].confettiCount > LEVEL_EFFECTS[4].confettiCount)
  for (const lv of [1, 2, 3] as KaomojiLevel[]) assert.equal(LEVEL_EFFECTS[lv].confettiCount, 0)
  // 🎉 は 4・5 で弾ける。1〜3 は無し
  assert.equal(effectsFor(5, false).crackerMotion, 'burst')
  assert.equal(effectsFor(3, false).crackerMotion, 'none')
})

test('S20-9 動きを減らす設定: 全レベルで紙吹雪・揺れ・跳ね・傾き・震えを出さず、スタンプと見出しは短いフェード', () => {
  for (const lv of [1, 2, 3, 4, 5] as KaomojiLevel[]) {
    const e = effectsFor(lv, true)
    assert.equal(e.stamp, 'fade', `lv${lv} stamp`)
    assert.equal(e.title, 'fade', `lv${lv} title`)
    assert.equal(e.shake, false)
    assert.equal(e.kaomoji, 'none')
    assert.equal(e.confettiMs, 0)
    assert.equal(e.confettiCount, 0)
    assert.notEqual(e.crackerMotion, 'burst')
    // 🎉 の有無（見出しの中身）はレベルどおり
    assert.equal(e.crackers, lv >= 4)
  }
})

test('時間の目安: スタンプはカレンダーが出てから約 0.25 秒、シートはスタンプの開始から約 1 秒', () => {
  assert.equal(SAVED_FLOW_TIMING.stampDelayMs, 250)
  assert.equal(SAVED_FLOW_TIMING.sheetDelayAfterStampMs, 1000)
})

// ---------- S20-2 ホームで保存した後の流れ ----------

class FakeScheduler {
  now = 0
  private seq = 0
  private tasks = new Map<number, { at: number; fn: () => void }>()
  setTimeout = (fn: () => void, ms: number): number => {
    const id = ++this.seq
    this.tasks.set(id, { at: this.now + ms, fn })
    return id
  }
  clearTimeout = (id: unknown): void => {
    this.tasks.delete(id as number)
  }
  advance(ms: number) {
    const end = this.now + ms
    for (;;) {
      const next = [...this.tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      this.tasks.delete(next[0])
      this.now = next[1].at
      next[1].fn()
    }
    this.now = end
  }
  get pending() {
    return this.tasks.size
  }
}

const setupFlow = () => {
  const sched = new FakeScheduler()
  const events: Array<SavedFlowEvent & { at: number }> = []
  const flow = createSavedFlow(sched)
  flow.subscribe((e) => events.push({ ...e, at: sched.now }))
  return { sched, events, flow }
}

test('S20-2: 保存 → カレンダー（今日の月）→ 約 0.25 秒でスタンプ → 約 1 秒でシート の順に指示が出る', () => {
  const { sched, events, flow } = setupFlow()
  flow.start({ date: '2026-11-13', level: 5 })
  assert.equal(events.length, 0, 'カレンダーが出るまでは何も出さない')
  const month = flow.calendarShown()
  assert.deepEqual(month, { year: 2026, month: 11 })
  sched.advance(249)
  assert.equal(events.length, 0)
  sched.advance(1)
  assert.deepEqual(events.map((e) => [e.type, e.at]), [['stamp', 250]])
  sched.advance(1000)
  assert.deepEqual(events.map((e) => [e.type, e.at]), [['stamp', 250], ['openSheet', 1250]])
  assert.deepEqual(events[1], { type: 'openSheet', date: '2026-11-13', level: 5, at: 1250 })
  // 一度きり（カレンダーをもう一度表示しても再生しない）
  assert.equal(flow.calendarShown(), null)
  sched.advance(5000)
  assert.equal(events.length, 2)
})

test('S20-2: 前に 2026-09 を表示していても、保存後の表示月は今日の月（2026-11）', () => {
  const { flow } = setupFlow()
  // カレンダーが持つ表示月に関係なく、流れは今日の月を返す
  flow.start({ date: '2026-11-13', level: 3 })
  assert.deepEqual(flow.calendarShown(), { year: 2026, month: 11 })
  flow.start({ date: '2027-01-02', level: 3 })
  assert.deepEqual(flow.calendarShown(), { year: 2027, month: 1 })
})

for (const when of [0, 100, 260, 1200]) {
  test(`S20-2: シートが出る前（カレンダー表示から ${when}ms）に取り消すと、まだのスタンプ・シートは後から出ない`, () => {
    const { sched, events, flow } = setupFlow()
    flow.start({ date: '2026-11-13', level: 4 })
    flow.calendarShown()
    sched.advance(when)
    const before = events.length
    flow.cancel()
    sched.advance(10_000)
    assert.equal(events.length, before)
    assert.equal(events.some((e) => e.type === 'openSheet'), false)
    assert.equal(sched.pending, 0)
    // カレンダーに戻っても再生しない
    assert.equal(flow.calendarShown(), null)
    sched.advance(10_000)
    assert.equal(events.length, before)
  })
}

test('S20-2: カレンダーが出る前に取り消した（タブを移った）ときも、後から再生しない', () => {
  const { sched, events, flow } = setupFlow()
  flow.start({ date: '2026-11-13', level: 2 })
  flow.cancel()
  assert.equal(flow.calendarShown(), null)
  sched.advance(10_000)
  assert.deepEqual(events, [])
})

test('S20-2: 保存に成功したら流れを始めてカレンダーへ移る。トーストの関数は受け取らない', async () => {
  const calls: string[] = []
  const r = await saveTodayFromHome({
    record: async (lv, c) => {
      calls.push(`record:${lv}:${c}`)
    },
    level: 5,
    comment: 'よし',
    today: '2026-11-13',
    startFlow: (a) => calls.push(`start:${a.date}:${a.level}`),
    navigateToCalendar: () => calls.push('navigate'),
  })
  assert.deepEqual(r, { ok: true })
  assert.deepEqual(calls, ['record:5:よし', 'start:2026-11-13:5', 'navigate'])
})

test('S20-2: 保存に失敗したら移動・スタンプ・シートのどれも起きない', async () => {
  const calls: string[] = []
  const r = await saveTodayFromHome({
    record: async () => {
      throw new Error('disk full')
    },
    level: 1,
    comment: '',
    today: '2026-11-13',
    startFlow: () => calls.push('start'),
    navigateToCalendar: () => calls.push('navigate'),
  })
  assert.deepEqual(r, { ok: false })
  assert.deepEqual(calls, [])
})

// ---------- S20-3 編集シートのスタンプ ----------

test('S20-3: 編集シートで記録する・保存したらスタンプ、削除・失敗ではスタンプしない', async () => {
  const ok = async () => {}
  const ng = async () => {
    throw new Error('x')
  }
  const base = { date: '2026-11-01', questionId: 'q1', level: 3 as KaomojiLevel, comment: '' }
  assert.equal(shouldStampAfterDayAction(await submitDayEntry(ok, { ...base, hadEntry: false })), true)
  assert.equal(shouldStampAfterDayAction(await submitDayEntry(ok, { ...base, hadEntry: true })), true)
  assert.equal(shouldStampAfterDayAction(await submitDayEntry(ng, { ...base, hadEntry: true })), false)
  assert.equal(shouldStampAfterDayAction(await deleteDayEntry(ok, '2026-11-01', 'q1')), false)
  assert.equal(shouldStampAfterDayAction(await deleteDayEntry(ng, '2026-11-01', 'q1')), false)
})

// ---------- S20-5 マスの顔文字の大きさ ----------

test('S20-5 (a): 収まるときは 8〜16dp で、マスに収まる最大の大きさ（0.5dp 刻み）', () => {
  // 1dp あたり 5dp 幅の顔文字、使える幅 60dp → 12dp
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 5, availWidth: 60 }), { size: 12, clip: false })
  // 0.5 刻みで切り下げ: 60 / 4.9 = 12.24… → 12
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 4.9, availWidth: 60 }), { size: 12, clip: false })
  // 60 / 4.7 = 12.76… → 12.5
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 4.7, availWidth: 60 }), { size: 12.5, clip: false })
  // ちょうど 8dp で収まる
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 5, availWidth: 40 }), { size: 8, clip: false })
  assert.equal(KAOMOJI_FONT.step, 0.5)
})

test('S20-5 (b): 16dp より大きくならない', () => {
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 1, availWidth: 60 }), { size: 16, clip: false })
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 60 / 16, availWidth: 60 }), { size: 16, clip: false })
  assert.equal(KAOMOJI_FONT.max, 16)
})

test('S20-5 (c): 8dp で収まらないときは 8dp と「末尾を省略」', () => {
  // 40 / 5.01 = 7.98… → 8 未満
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 5.01, availWidth: 40 }), { size: 8, clip: true })
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 15, availWidth: 47 }), { size: 8, clip: true })
  assert.equal(KAOMOJI_FONT.min, 8)
})

test('S20-5: 高さが足りないときも 8dp より小さくしない（幅が収まるなら省略しない）', () => {
  // 幅なら 16、高さ（1dp あたり 1.2dp・使える高さ 12dp）なら 10
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 1, availWidth: 60, heightPerDp: 1.2, availHeight: 12 }), { size: 10, clip: false })
  // 高さでは 8 未満 → 8 に止める。幅は 8dp で収まるので省略しない
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 1, availWidth: 60, heightPerDp: 2.4, availHeight: 12 }), { size: 8, clip: false })
})

test('S20-5: 幅が測れていない・使える幅が無いときは 8dp・省略で出す（はみ出さない）', () => {
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 0, availWidth: 60 }), { size: 8, clip: true })
  assert.deepEqual(fitKaomojiFont({ widthPerDp: 5, availWidth: 0 }), { size: 8, clip: true })
  assert.deepEqual(fitKaomojiFont({ widthPerDp: Number.NaN, availWidth: 60 }), { size: 8, clip: true })
})

test('S20-5: 412dp 幅のマスで使える幅（モックアップと同じ計算: (412-32-1)/7 - 1 - 4 - 2）', () => {
  const avail = cellAvailWidth((412 - 32 - 1) / 7)
  assert.ok(Math.abs(avail - ((412 - 32 - 1) / 7 - 7)) < 1e-9)
})

// ---------- S20-6 月の左右スワイプ ----------

test('S20-6: 判定の値は 1 か所（GESTURE）: 幅の 4 分の 1・約 0.5dp/ms・30dp・8dp', () => {
  assert.deepEqual(GESTURE, { tapSlop: 8, distanceRatio: 0.25, flingVelocity: 0.5, flingMinDistance: 30 })
})

test('S20-6: 縦の動きが先なら切り替えない。約 8dp 未満はまだ決めない（タップ）', () => {
  assert.equal(lockMonthSwipe(0, 0), null)
  assert.equal(lockMonthSwipe(8, 0), null, '8dp ちょうどはタップの範囲')
  assert.equal(lockMonthSwipe(-8, 3), null)
  assert.equal(lockMonthSwipe(8.5, 0), 'horizontal')
  assert.equal(lockMonthSwipe(-9, 4), 'horizontal')
  assert.equal(lockMonthSwipe(3, 9), 'vertical')
  assert.equal(lockMonthSwipe(9, -10), 'vertical', '縦の方が大きい')
  assert.equal(lockMonthSwipe(9, 9), 'vertical', '同じなら縦（スクロールを妨げない）')
})

test('S20-6: 幅の 4 分の 1 を超えたら切り替え（左 = 次の月、右 = 前の月）。境界の前後', () => {
  const W = 400
  assert.equal(decideMonthSwipe({ dx: -100, vx: 0, width: W, cancelled: false }), 'stay', 'ちょうど 1/4 は超えていない')
  assert.equal(decideMonthSwipe({ dx: -100.5, vx: 0, width: W, cancelled: false }), 'next')
  assert.equal(decideMonthSwipe({ dx: 100.5, vx: 0, width: W, cancelled: false }), 'prev')
  assert.equal(decideMonthSwipe({ dx: 99, vx: 0, width: W, cancelled: false }), 'stay')
})

test('S20-6: 素早く払う = 速さ 0.5dp/ms 超 かつ 30dp 超。どちらかが足りなければ戻る', () => {
  const W = 400
  assert.equal(decideMonthSwipe({ dx: -31, vx: -0.51, width: W, cancelled: false }), 'next')
  assert.equal(decideMonthSwipe({ dx: 31, vx: 0.51, width: W, cancelled: false }), 'prev')
  assert.equal(decideMonthSwipe({ dx: -31, vx: -0.5, width: W, cancelled: false }), 'stay', '速さちょうど 0.5 は超えていない')
  assert.equal(decideMonthSwipe({ dx: -30, vx: -2, width: W, cancelled: false }), 'stay', '距離ちょうど 30 は超えていない')
  assert.equal(decideMonthSwipe({ dx: -29, vx: -2, width: W, cancelled: false }), 'stay')
})

test('S20-6: 操作が取り消されたら（システムに奪われた等）元の月に戻る', () => {
  assert.equal(decideMonthSwipe({ dx: -300, vx: -3, width: 400, cancelled: true }), 'stay')
})

// ---------- S20-7 シートの下スワイプ ----------

test('S20-7: 下へ 8dp を超え、横より大きいときだけシートを動かす。上・横は動かさない', () => {
  assert.equal(lockSheetDrag(0, 8), null)
  assert.equal(lockSheetDrag(0, 8.5), 'down')
  assert.equal(lockSheetDrag(5, 9), 'down')
  assert.equal(lockSheetDrag(10, 9), 'other')
  assert.equal(lockSheetDrag(0, -9), 'other')
})

test('S20-7: 高さの 4 分の 1 を超えたら閉じる。境界の前後', () => {
  const H = 400
  assert.equal(decideSheetDismiss({ dy: 100, vy: 0, height: H, cancelled: false }), 'stay')
  assert.equal(decideSheetDismiss({ dy: 100.5, vy: 0, height: H, cancelled: false }), 'close')
  assert.equal(decideSheetDismiss({ dy: 99, vy: 0, height: H, cancelled: false }), 'stay')
})

test('S20-7: 素早く下に払う = 速さ 0.5dp/ms 超 かつ 30dp 超', () => {
  const H = 400
  assert.equal(decideSheetDismiss({ dy: 31, vy: 0.51, height: H, cancelled: false }), 'close')
  assert.equal(decideSheetDismiss({ dy: 31, vy: 0.5, height: H, cancelled: false }), 'stay')
  assert.equal(decideSheetDismiss({ dy: 30, vy: 3, height: H, cancelled: false }), 'stay')
  assert.equal(decideSheetDismiss({ dy: 31, vy: -1, height: H, cancelled: false }), 'stay', '上向きの払いでは閉じない')
})

test('S20-7: 操作の取り消し → 閉じない', () => {
  assert.equal(decideSheetDismiss({ dy: 390, vy: 3, height: 400, cancelled: true }), 'stay')
})

test('S20-7: 削除の確認中・処理中・入力欄から始めた操作・開始時に中身が一番上でない → 閉じる動きにしない', () => {
  const ok = { confirming: false, busy: false, startedInInput: false, scrollAtTopAtStart: true }
  assert.equal(canStartSheetDrag(ok), true)
  assert.equal(canStartSheetDrag({ ...ok, confirming: true }), false)
  assert.equal(canStartSheetDrag({ ...ok, busy: true }), false)
  assert.equal(canStartSheetDrag({ ...ok, startedInInput: true }), false)
  assert.equal(canStartSheetDrag({ ...ok, scrollAtTopAtStart: false }), false)
})

// ---------- 紙吹雪 ----------

test('紙吹雪: 枚数どおり、左右の下から打ち上げ、決めた時間で消える', () => {
  let seed = 1
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const c = buildConfetti({ count: 90, durationMs: 3000, width: 400, height: 800, random })
  assert.equal(c.particles.length, 90)
  assert.equal(c.durationMs, 3000)
  assert.ok(c.fadeStartMs < 3000 && c.fadeStartMs >= 300)
  const left = c.particles.filter((p) => p.xs[0] < 200)
  const right = c.particles.filter((p) => p.xs[0] > 200)
  assert.equal(left.length, 45)
  assert.equal(right.length, 45)
  for (const p of c.particles) {
    assert.equal(p.times[0], 0)
    assert.ok(p.times[p.times.length - 1] <= 3000)
    assert.equal(p.times.length, p.xs.length)
    assert.equal(p.times.length, p.ys.length)
    assert.ok(p.ys[0] > 400, '画面の下側から出る')
    assert.ok(Math.min(...p.ys) < p.ys[0], 'いったん上がる')
    for (let i = 1; i < p.times.length; i++) assert.ok(p.times[i] > p.times[i - 1])
  }
  assert.equal(buildConfetti({ count: 0, durationMs: 0, width: 400, height: 800, random }).particles.length, 0)
})

// ---------- S20-4 シェアの内容 ----------

test('S20-4: 保存しましたシートの「SNS にシェア」はホームと同じ内容（問い・顔文字・一言・連続記録）', () => {
  const entry = { date: '2026-11-13', questionId: 'q1', level: 5 as KaomojiLevel, comment: '朝に歩いた' }
  const q = { label: '運動', kaomojiSet: DEFAULT_KAOMOJI_SET }
  const opts = todayShareOptions({ entry, question: q, language: 'ja', streak: 3 })
  assert.deepEqual(opts, { entry, kaomojiSet: DEFAULT_KAOMOJI_SET, question: '運動', language: 'ja', streak: 3 })
  const text = buildShareText(opts)
  assert.match(text, /今日、運動できた？ → \(＾▽＾\)\/（最高）/)
  assert.match(text, /「朝に歩いた」/)
  assert.match(text, /🔥 3日連続記録中！/)
  assert.match(buildShareText({ ...opts, language: 'en' }), /🔥 3 day streak!/)
})
