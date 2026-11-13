/**
 * 紙吹雪（保存しましたシートの演出。レベル 5: 約 3 秒・多め／4: 約 1 秒・少なめ）。
 * 画面の左右の下からクラッカーのように打ち上げて降らせ、決めた時間で消える。触れない（下のボタンを押せる）。
 * 軌跡は src/domain/confetti.ts で前もって計算し、1 本の時間の値の補間でなぞる（ネイティブ側で動かす）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native'
import { buildConfetti } from '@/domain/confetti'

const LIGHT = ['#2f8f5b', '#f2b233', '#e8607a', '#4a90d9', '#9b6dd6']
const DARK = ['#5cc58d', '#f2c46a', '#ff8fa3', '#7fb6f0', '#c3a2f0']

interface Props {
  /** 0 のときは出さない */
  durationMs: number
  count: number
  isDark: boolean
}

export const Confetti: React.FC<Props> = ({ durationMs, count, isDark }) => {
  const { width, height } = useWindowDimensions()
  const [done, setDone] = useState(false)
  const t = useRef(new Animated.Value(0)).current
  const plan = useMemo(
    () => buildConfetti({ count, durationMs, width, height }),
    // 画面の大きさが変わっても、降っている途中で作り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, durationMs],
  )

  useEffect(() => {
    if (durationMs <= 0 || count <= 0) return
    t.setValue(0)
    const a = Animated.timing(t, { toValue: durationMs, duration: durationMs, easing: Easing.linear, useNativeDriver: true })
    a.start(({ finished }) => {
      if (finished) setDone(true)
    })
    return () => a.stop()
  }, [t, durationMs, count])

  if (done || durationMs <= 0 || count <= 0) return null
  const colors = isDark ? DARK : LIGHT
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {plan.particles.map((p, i) => {
        const start = Math.min(p.delayMs, plan.fadeStartMs - 2)
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                width: p.w,
                height: p.h,
                marginLeft: -p.w / 2,
                marginTop: -p.h / 2,
                backgroundColor: colors[p.colorIndex % colors.length],
                opacity: t.interpolate({
                  inputRange: [0, start, start + 1, plan.fadeStartMs, plan.durationMs],
                  outputRange: [0, 0, 1, 1, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { translateX: t.interpolate({ inputRange: p.times, outputRange: p.xs, extrapolate: 'clamp' }) },
                  { translateY: t.interpolate({ inputRange: p.times, outputRange: p.ys, extrapolate: 'clamp' }) },
                  {
                    rotate: t.interpolate({
                      inputRange: p.times,
                      outputRange: p.rotations.map((r) => `${r}deg`),
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0, borderRadius: 1 },
})
