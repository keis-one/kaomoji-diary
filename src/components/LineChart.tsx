import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg'
import type { ChartPoint } from '@/types'
import { useTheme } from '@/hooks/useTheme'

interface Props {
  points: ChartPoint[]
  width: number
  height?: number
  language?: string
}

const PAD = { top: 16, right: 16, bottom: 28, left: 28 }
const MAX_LEVEL = 5

// X 軸に表示するラベルのインデックスを決める
const getLabelIndices = (count: number): Set<number> => {
  if (count <= 7) return new Set(Array.from({ length: count }, (_, i) => i))
  if (count <= 30) {
    // 約5日ごと（0, 4, 9, 14, 19, 24, 29 など）
    const step = Math.floor(count / 6)
    const indices = new Set<number>()
    for (let i = 0; i < count; i += step) indices.add(i)
    indices.add(count - 1)
    return indices
  }
  return new Set([0, Math.floor((count - 1) / 2), count - 1])
}

export const LineChart: React.FC<Props> = ({ points, width, height = 200, language = 'ja' }) => {
  const { colors, isDark } = useTheme()

  const emptyText = language === 'ja' ? 'データなし' : 'No data'
  const hasAnyEntry = points.some((p) => p.hasEntry)

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyText}</Text>
      </View>
    )
  }

  const chartW = width - PAD.left - PAD.right
  const chartH = height - PAD.top - PAD.bottom

  // Y軸: 0（未記録）〜 5（最高）
  const yScale = chartH / MAX_LEVEL
  const xStep = points.length > 1 ? chartW / (points.length - 1) : 0

  const toX = (i: number) => PAD.left + i * xStep
  const toY = (level: number) => PAD.top + (MAX_LEVEL - level) * yScale

  const polylinePoints = points.map((p, i) => `${toX(i)},${toY(p.level)}`).join(' ')

  const levelLines = [1, 2, 3, 4, 5]
  const labelIndices = getLabelIndices(points.length)

  const gridColor = isDark ? '#2a2a2a' : '#ececec'
  const gridLabelColor = isDark ? '#555' : '#bbb'
  const lineColor = colors.accent
  const dotFill = colors.card
  const emptyDotColor = isDark ? '#444' : '#ddd'

  return (
    <Svg width={width} height={height}>
      {/* 横グリッド線 + レベルラベル（1〜5） */}
      {levelLines.map((level) => {
        const y = toY(level)
        return (
          <React.Fragment key={level}>
            <Line x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
              stroke={gridColor} strokeWidth={1} />
            <SvgText x={PAD.left - 4} y={y + 4} fontSize={10}
              fill={gridLabelColor} textAnchor="end">
              {level}
            </SvgText>
          </React.Fragment>
        )
      })}

      {/* Y=0 の基準線（未記録ライン） */}
      <Line x1={PAD.left} y1={toY(0)} x2={width - PAD.right} y2={toY(0)}
        stroke={gridColor} strokeWidth={1} strokeDasharray="3,3" />

      {/* 折れ線（全ポイントを接続） */}
      {points.length > 1 && hasAnyEntry && (
        <Polyline points={polylinePoints} fill="none"
          stroke={lineColor} strokeWidth={2.5}
          strokeLinejoin="round" strokeLinecap="round"
          opacity={0.8}
        />
      )}

      {/* データポイント */}
      {points.map((p, i) => (
        p.hasEntry ? (
          <Circle key={`dot-${i}`} cx={toX(i)} cy={toY(p.level)}
            r={5} fill={dotFill} stroke={lineColor} strokeWidth={2} />
        ) : (
          <Circle key={`dot-${i}`} cx={toX(i)} cy={toY(0)}
            r={3} fill={emptyDotColor} stroke={emptyDotColor} strokeWidth={1} />
        )
      ))}

      {/* X 軸日付ラベル */}
      {points.map((p, i) => {
        if (!labelIndices.has(i)) return null
        return (
          <SvgText key={`label-${i}`} x={toX(i)} y={height - 4}
            fontSize={9} fill={gridLabelColor} textAnchor="middle">
            {p.date.slice(5)}
          </SvgText>
        )
      })}
    </Svg>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },
})
