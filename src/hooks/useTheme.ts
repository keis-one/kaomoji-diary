import { useColorScheme } from 'react-native'
import { useDiaryStore } from '@/store'
import { LIGHT_COLORS, DARK_COLORS, type AppColors } from '@/constants/colors'

export interface ThemeResult {
  colors: AppColors
  isDark: boolean
}

export const useTheme = (): ThemeResult => {
  const theme = useDiaryStore((s) => s.settings.theme)
  const systemScheme = useColorScheme()

  const effectiveTheme = theme ?? 'system'
  const isDark =
    effectiveTheme === 'dark' || (effectiveTheme === 'system' && systemScheme === 'dark')

  return {
    colors: isDark ? DARK_COLORS : LIGHT_COLORS,
    isDark,
  }
}
