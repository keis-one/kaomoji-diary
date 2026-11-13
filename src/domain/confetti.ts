/**
 * 紙吹雪の軌跡（純粋関数）。画面の左右の下からクラッカーのように打ち上げて降らせ、決めた時間で消える。
 * 動きはモックアップ（kaomoji-diary_mockup-v2.html）の計算（60fps のコマごとの重力・空気抵抗）と同じで、
 * それを sampleMs ごとに記録し、画面側は Animated の補間（ネイティブ側で動く）でなぞる。
 */

export interface ConfettiParticle {
  /** 開始からの時刻（ms）。先頭は 0 */
  times: number[]
  xs: number[]
  ys: number[]
  /** 回転（度） */
  rotations: number[]
  w: number
  h: number
  colorIndex: number
  /** この時刻までは出さない（打ち上げのばらつき） */
  delayMs: number
}

export interface ConfettiPlan {
  particles: ConfettiParticle[]
  durationMs: number
  /** この時刻から消え始め、durationMs で消える */
  fadeStartMs: number
}

const FRAME_MS = 1000 / 60

export const buildConfetti = (a: {
  count: number
  durationMs: number
  width: number
  height: number
  random?: () => number
  sampleMs?: number
  colorCount?: number
}): ConfettiPlan => {
  const random = a.random ?? Math.random
  const sampleMs = a.sampleMs ?? 100
  const colorCount = a.colorCount ?? 5
  const { width: W, height: H, durationMs } = a
  const particles: ConfettiParticle[] = []
  for (let i = 0; i < a.count; i++) {
    const left = i % 2 === 0
    let x = left ? W * 0.08 : W * 0.92
    let y = H * 0.62
    let vx = (left ? 1 : -1) * (1.5 + random() * 4.5)
    let vy = -(6 + random() * 7)
    let rot = random() * 360
    const vrot = (random() - 0.5) * 0.4 * (180 / Math.PI)
    const delay = random() * 180
    const w = 5 + random() * 5
    const h = 8 + random() * 6
    const times = [0]
    const xs = [x]
    const ys = [y]
    const rotations = [rot]
    let nextSample = Math.max(sampleMs, Math.ceil(delay / sampleMs) * sampleMs)
    for (let t = delay; t <= durationMs; t += FRAME_MS) {
      vy = Math.min(vy + 0.22, 3.2)
      vx *= 0.985
      x += vx
      y += vy
      rot += vrot
      if (t >= nextSample) {
        times.push(nextSample)
        xs.push(x)
        ys.push(y)
        rotations.push(rot)
        nextSample += sampleMs
      }
    }
    if (times.length === 1) {
      times.push(Math.max(1, durationMs))
      xs.push(x)
      ys.push(y)
      rotations.push(rot)
    }
    particles.push({ times, xs, ys, rotations, w, h, colorIndex: i % colorCount, delayMs: delay })
  }
  return { particles, durationMs, fadeStartMs: Math.max(300, durationMs - 600) }
}
