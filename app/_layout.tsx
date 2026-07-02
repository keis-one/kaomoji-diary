import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { router } from 'expo-router'
import { setupNotifications, addNotificationTapListener } from '@/utils/notifications'
import { initializeAds } from '@/utils/ads'
import { useTheme } from '@/hooks/useTheme'

export default function RootLayout() {
  const { isDark } = useTheme()

  useEffect(() => {
    setupNotifications()
    initializeAds()
    const remove = addNotificationTapListener(() => {
      router.replace('/(tabs)/')
    })
    return remove
  }, [])

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
