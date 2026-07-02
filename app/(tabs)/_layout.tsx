import { Tabs } from 'expo-router'
import { Text, View } from 'react-native'
// SDK 56 では react-navigation は expo-router に取り込まれており、
// 独立した @react-navigation/bottom-tabs は解決できない。
// expo-router 自身が Tabs 内部で使っているのと同じ vendored 実装を参照する。
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import AdBanner from '@/components/AdBanner'

const TabIcon = ({ label }: { label: string }) => (
  <Text style={{ fontSize: 20 }}>{label}</Text>
)

// デフォルトのタブバーの直上にバナー広告を差し込むカスタムタブバー。
// これにより全画面共通で「タブバー上部」に広告が表示される。
const TabBarWithAd = (props: BottomTabBarProps) => (
  <View>
    <AdBanner />
    <BottomTabBar {...props} />
  </View>
)

export default function TabLayout() {
  const language = useDiaryStore((s) => s.settings.language)
  const isPremium = useDiaryStore((s) => s.settings.isPremium)
  const { colors } = useTheme()
  const isJa = language === 'ja'

  return (
    <Tabs
      tabBar={(props) => <TabBarWithAd {...props} />}
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
