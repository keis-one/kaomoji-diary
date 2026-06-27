import { Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'

const TabIcon = ({ label }: { label: string }) => (
  <Text style={{ fontSize: 20 }}>{label}</Text>
)

export default function TabLayout() {
  const language = useDiaryStore((s) => s.settings.language)
  const isPremium = useDiaryStore((s) => s.settings.isPremium)
  const { colors } = useTheme()
  const isJa = language === 'ja'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.tabBar,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isJa ? 'ホーム' : 'Home',
          tabBarIcon: () => <TabIcon label="🏠" />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: isJa ? 'カレンダー' : 'Calendar',
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />
      <Tabs.Screen
        name="graph"
        options={{
          title: isJa ? 'グラフ' : 'Graph',
          tabBarIcon: () => <TabIcon label={isPremium ? '📊' : '🔒'} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: isJa ? '設定' : 'Settings',
          tabBarIcon: () => <TabIcon label="⚙️" />,
        }}
      />
    </Tabs>
  )
}
