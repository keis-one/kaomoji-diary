import React, { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useStats } from '@/hooks/useStats'
import { useSettings } from '@/hooks/useSettings'
import { useTheme } from '@/hooks/useTheme'
import { QuestionTabs } from '@/components/QuestionTabs'
import { LineChart } from '@/components/LineChart'
import type { GraphPeriod } from '@/types'
import { GRAPH_PERIODS } from '@/constants/app'

export default function GraphScreen() {
  const { settings, setActiveQuestion, canAddQuestion } = useSettings()
  const [period, setPeriod] = useState<GraphPeriod>('week')
  const { stats, chartPoints } = useStats(period)
  const { width } = useWindowDimensions()
  const { colors } = useTheme()
  const isJa = settings.language === 'ja'

  const PERIOD_LABELS: Record<GraphPeriod, string> = isJa
    ? { week: '1週間', month: '1ヶ月', all: '全期間' }
    : { week: '7 days', month: '30 days', all: 'All' }

  if (!settings.isPremium) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.gateContainer}>
          <Text style={styles.gateEmoji}>👑</Text>
          <Text style={styles.gateTitle}>
            {isJa ? 'グラフはプレミアム機能' : 'Graph is a Premium Feature'}
          </Text>
          <Text style={styles.gateSubtitle}>
            {isJa
              ? '習慣の推移をグラフで確認できます。\nプレミアムにアップグレードすると使えます。'
              : 'Track your habit trends with a graph.\nUpgrade to Premium to unlock.'}
          </Text>
          <Pressable style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>
              {isJa ? 'プレミアムに登録（準備中）' : 'Upgrade (Coming Soon)'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  const chartWidth = width - 32

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <QuestionTabs
        questions={settings.questions}
        activeQuestionId={settings.activeQuestionId}
        onSelect={setActiveQuestion}
        canAdd={canAddQuestion}
        isPremium={settings.isPremium}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.periodRow}>
          {GRAPH_PERIODS.map((p) => (
            <Pressable
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>{isJa ? '連続記録日' : 'Streak'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.averageLevel.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{isJa ? '平均レベル' : 'Avg Level'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.maxLevel}</Text>
            <Text style={styles.statLabel}>{isJa ? '最高スコア' : 'Best'}</Text>
          </View>
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {isJa ? 'レベル推移' : 'Level Trend'}
          </Text>
          <LineChart
            points={chartPoints}
            width={chartWidth}
            height={220}
            language={settings.language}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  gateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  gateEmoji: { fontSize: 56 },
  gateTitle: { fontSize: 22, fontWeight: '700', color: '#333', textAlign: 'center' },
  gateSubtitle: { fontSize: 15, color: '#777', textAlign: 'center', lineHeight: 22 },
  upgradeBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: '#f0c040',
    borderRadius: 14,
    marginTop: 8,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#5d4037' },
  content: { padding: 16, gap: 16 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  periodBtnActive: { borderColor: '#66bb6a', backgroundColor: '#e8f5e9' },
  periodText: { fontSize: 13, color: '#777' },
  periodTextActive: { color: '#2e7d32', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statValue: { fontSize: 28, fontWeight: '700', color: '#388e3c' },
  statLabel: { fontSize: 11, color: '#999' },
  chartCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
    backgroundColor: '#fafafa',
    gap: 8,
  },
  chartTitle: { fontSize: 15, fontWeight: '600', color: '#555' },
})
