import { useEffect } from 'react'
import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useDiaryStore } from '@/store'
import { useHydration } from '@/hooks/useHydration'

export default function Index() {
  const hydrated = useHydration()
  const isOnboardingDone = useDiaryStore((s) => s.isOnboardingDone)
  const questions = useDiaryStore((s) => s.settings.questions)
  const resetAll = useDiaryStore((s) => s.resetAll)

  const needsMigrationReset = hydrated && isOnboardingDone && (questions?.length ?? 0) === 0

  useEffect(() => {
    if (needsMigrationReset) resetAll()
  }, [needsMigrationReset])

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#66bb6a" />
      </View>
    )
  }

  if (!isOnboardingDone || needsMigrationReset) {
    return <Redirect href="/onboarding" />
  }
  return <Redirect href="/(tabs)/" />
}
