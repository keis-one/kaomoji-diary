import { useState, useEffect } from 'react'
import { useDiaryStore } from '@/store'

export const useHydration = (): boolean => {
  const [hydrated, setHydrated] = useState(() => useDiaryStore.persist.hasHydrated())

  useEffect(() => {
    if (useDiaryStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    const unsub = useDiaryStore.persist.onFinishHydration(() => setHydrated(true))
    // AsyncStorage が応答しない場合のフォールバック（最大1秒待って進む）
    const timer = setTimeout(() => setHydrated(true), 1000)
    return () => {
      if (typeof unsub === 'function') unsub()
      clearTimeout(timer)
    }
  }, [])

  return hydrated
}
