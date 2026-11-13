import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * 端末の「動きを減らす」設定（Android の「アニメーションを削除」・iOS の「視差効果を減らす」）。
 * オンのときは紙吹雪・揺れ・跳ね・震えを出さず、短いフェードだけにする（製品仕様 S20-9）。
 */
export const useReduceMotion = (): boolean => {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v)
      })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduced
}
