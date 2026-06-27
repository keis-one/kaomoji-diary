import React from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import type { Question } from '@/types'

interface Props {
  questions: Question[]
  activeQuestionId: string
  onSelect: (id: string) => void
  onAdd?: () => void
  canAdd?: boolean
  isPremium?: boolean
}

export const QuestionTabs: React.FC<Props> = ({
  questions,
  activeQuestionId,
  onSelect,
  onAdd,
  canAdd = false,
  isPremium = false,
}) => {
  if (questions.length <= 1 && !isPremium) return null

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        style={styles.scroll}
      >
        {questions.map((q) => {
          const isActive = q.id === activeQuestionId
          return (
            <Pressable
              key={q.id}
              onPress={() => onSelect(q.id)}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={styles.tabLabel} numberOfLines={1}>
                {q.label || '…'}
              </Text>
            </Pressable>
          )
        })}

        {isPremium && canAdd && onAdd && (
          <Pressable onPress={onAdd} style={styles.addButton} accessibilityLabel="問いを追加">
            <Text style={styles.addButtonText}>＋</Text>
          </Pressable>
        )}

        {!isPremium && (
          <Pressable style={styles.premiumHint}>
            <Text style={styles.premiumHintText}>👑 複数</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    borderColor: '#66bb6a',
    backgroundColor: '#e8f5e9',
  },
  tabLabel: {
    fontSize: 13,
    color: '#555',
    maxWidth: 80,
  },
  addButton: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#66bb6a',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#66bb6a',
  },
  premiumHint: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0c040',
    backgroundColor: '#fffde7',
    opacity: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumHintText: {
    fontSize: 12,
    color: '#999',
  },
})
