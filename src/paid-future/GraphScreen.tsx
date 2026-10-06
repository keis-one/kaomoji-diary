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
import { LineChart } from './LineChart'
import type { GraphPeriod } from '@/types'
import { GRAPH_PERIODS } from '@/constants/app'

/**
 * グラフ画面（F21/F22）— 有料版アプリの将来仕様。無料版アプリからは参照しない。
 *
 * 無料版・有料版を別アプリにするオーナー決定（2026-10-06）により、無料版のタブから外した
 * （Sprint 19a）。expo-router は app/ 配下を自動でルートにするため、app/ の外に移している。
 * 有料版アプリで使うときは、仕様（kaomoji-diary_paid-app-future.md）に合わせて
 * app/ 配下のルートから読み込む。複数問いのタブ（./QuestionTabs.tsx）の
 * 組み込みもそのときに行う。
 *
 * 旧 preview 版のプレミアム判定（ゲート画面）は、有料版アプリにはプラン切り替えが無いため削除した。
 * 旧実装は apps/kaomoji-diary の git 履歴（コミット 73347ff 時点の app/(tabs)/graph.tsx）にある。
 */
export default function GraphScreen() {
  const { settings } = useSettings()
  const [period, setPeriod] = useState<GraphPeriod>('week')
  const { stats, chartPoints } = useStats(period)
  const { width } = useWindowDimensions()
  const { colors } = useTheme()
  const isJa = settings.language === 'ja'

  const PERIOD_LABELS: Record<GraphPeriod, string> = isJa
    ? { week: '1週間', month: '1ヶ月', all: '全期間' }
    : { week: '7 days', month: '30 days', all: 'All' }

  const chartWidth = width - 32

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
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
