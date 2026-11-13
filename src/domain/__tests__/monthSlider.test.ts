// E20-01（Sprint 20 の Codex 評価）: 月のスライドの動きの間は、次のスワイプ・‹ › を受け付けない。
// 戻り（stay）の動きの間も同じ。完了・システムの取り消し・月の変更の完了で、また操作できる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMonthSlider } from '@/domain/monthSlider'

const setup = () => {
  const anims: Array<{ target: string; done: (finished: boolean) => void }> = []
  const log: string[] = []
  const slider = createMonthSlider({
    animateTo: (target, done) => {
      anims.push({ target, done })
      log.push(`animate:${target}`)
    },
    commitMonth: (dir) => log.push(`commit:${dir}`),
    onMonthChangeStart: () => log.push('cancelPending'),
  })
  return { anims, log, slider }
}

test('E20-01: 戻り（stay）の動きの間は ‹ › もスワイプも受け付けず、完了したらまた操作できる', () => {
  const { anims, log, slider } = setup()
  slider.finishSwipe('stay')
  assert.equal(slider.isBusy(), true, '戻りの間は操作を止める')
  assert.equal(slider.change(1), false, '戻りの間の › は受け付けない')
  assert.deepEqual(log, ['animate:center'])
  anims[0].done(true)
  assert.equal(slider.isBusy(), false)
  assert.equal(slider.change(1), true)
})

test('E20-01: 戻りの動きがシステムに取り消されても、また操作できる', () => {
  const { anims, slider } = setup()
  slider.finishSwipe('stay')
  anims[0].done(false)
  assert.equal(slider.isBusy(), false)
})

test('E20-01: 月を変える動きの間は受け付けず、月の変更が画面に出たらまた操作できる', () => {
  const { anims, log, slider } = setup()
  assert.equal(slider.change(-1), true)
  assert.equal(slider.isBusy(), true)
  assert.equal(slider.change(1), false)
  slider.finishSwipe('next')
  assert.deepEqual(log, ['cancelPending', 'animate:prev'], '動きの間のスワイプの確定も受け付けない')
  anims[0].done(true)
  assert.deepEqual(log, ['cancelPending', 'animate:prev', 'commit:-1'])
  assert.equal(slider.isBusy(), true, '新しい月が描かれるまでは止めたまま')
  slider.monthShown()
  assert.equal(slider.isBusy(), false)
})

test('E20-01: 月を変える動きが取り消されたら月は変えず、また操作できる', () => {
  const { anims, log, slider } = setup()
  slider.finishSwipe('next')
  anims[0].done(false)
  assert.deepEqual(log, ['cancelPending', 'animate:next'])
  assert.equal(slider.isBusy(), false)
})
