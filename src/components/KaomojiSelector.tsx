import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { KaomojiLevel, KaomojiSet, Language } from '@/types'
import { KAOMOJI_LEVELS, LEVEL_LABELS } from '@/constants/kaomoji'
import { useTheme } from '@/hooks/useTheme'
import type { AppColors } from '@/constants/colors'

interface Props {
  kaomojiSet: KaomojiSet
  selected: KaomojiLevel | null
  onSelect: (level: KaomojiLevel) => void
  language?: Language
}

export const KaomojiSelector: React.FC<Props> = ({
  kaomojiSet,
  selected,
  onSelect,
  language = 'ja',
}) => {
  const labels = LEVEL_LABELS[language]
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <View style={styles.row}>
      {KAOMOJI_LEVELS.map((level) => {
        const isSelected = selected === level
        return (
          <Pressable
            key={level}
            onPress={() => onSelect(level)}
            style={[styles.item, isSelected && styles.itemSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={styles.kaomoji} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{kaomojiSet[level]}</Text>
            <Text style={[styles.levelNum, isSelected && styles.levelNumSelected]}>
              {level}
            </Text>
            <Text style={styles.label}>{labels[level]}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'stretch',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.card,
    gap: 4,
  },
  itemSelected: { borderColor: c.accent, backgroundColor: c.accentLight },
  kaomoji: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: c.text },
  levelNum: { fontSize: 20, fontWeight: 'bold', color: c.textMuted },
  levelNumSelected: { color: c.accentDark },
  label: { fontSize: 10, color: c.textMuted, textAlign: 'center' },
})
