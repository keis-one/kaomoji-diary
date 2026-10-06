/**
 * 6-1. データを書き出す（F51・F54。UI仕様 6-1）。
 * 保存されている全記録（画面に出ない記録を含む）を CSV にし、Android の共有画面に渡す。記録・設定は変更しない。
 * 作っている間に戻る操作・タブ移動をしたら中止する（共有画面を開かず、トーストも出さない）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { t } from '@/i18n/strings'
import { buildExportCsv, exceedsImportLimit, exportFileName, summarizeExport } from '@/domain/csv/format'
import { todayIso } from '@/utils/date'
import { writeCsvFile, shareCsvFile } from '@/utils/csvFile'
import { showToast } from '@/components/Toast'
import { SubScreenHeader, useHardwareBack } from '@/components/Dialogs'
import type { AppColors } from '@/constants/colors'

const formatDate = (iso: string) => iso.replace(/-/g, '/')

export const ExportScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const entries = useDiaryStore((s) => s.entries)
  const settings = useDiaryStore((s) => s.settings)
  const retiredQuestions = useDiaryStore((s) => s.retiredQuestions)
  const { colors } = useTheme()
  const s = t(settings.language)
  const styles = makeStyles(colors)

  const source = useMemo(() => ({ entries, settings, retiredQuestions }), [entries, settings, retiredQuestions])
  const summary = useMemo(() => summarizeExport(source), [source])
  const tooLarge = useMemo(() => exceedsImportLimit(buildExportCsv(source)), [source])
  const fileName = exportFileName(todayIso())

  const [exporting, setExporting] = useState(false)
  const [failed, setFailed] = useState(false)
  // 画面を離れたら（戻る・タブ移動でこの画面が外れたら）書き出しを中止する
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const handleBack = useCallback(() => {
    aliveRef.current = false
    onBack()
    return true
  }, [onBack])
  useHardwareBack(handleBack)

  const handleExport = async () => {
    if (exporting || !summary.canExport) return
    setExporting(true)
    setFailed(false)
    try {
      await new Promise((r) => setTimeout(r, 0)) // 「書き出しています…」を先に表示する
      const csv = buildExportCsv(source)
      if (!aliveRef.current) return
      const uri = await writeCsvFile(fileName, csv)
      if (!aliveRef.current) return
      await shareCsvFile(uri, s.shareDialogTitle)
      if (!aliveRef.current) return
      // 共有した／キャンセルしたを区別できないため、共有画面が閉じたあとに「作成しました」を出す
      showToast(exceedsImportLimit(csv) ? `${s.toastExported}\n${s.exportTooLarge}` : s.toastExported)
    } catch {
      if (aliveRef.current) setFailed(true)
    } finally {
      if (aliveRef.current) setExporting(false)
    }
  }

  return (
    <View style={styles.flex}>
      <SubScreenHeader title={s.exportTitle} onBack={handleBack} colors={colors} backLabel={s.back} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Row label={s.records} value={s.countUnit(summary.count)} styles={styles} />
          {summary.range && (
            <Row label={s.period} value={`${formatDate(summary.range.from)}〜${formatDate(summary.range.to)}`} styles={styles} />
          )}
          <Text style={styles.label}>{s.fileName}</Text>
          <Text style={styles.value}>{fileName}</Text>
          {summary.hiddenCount > 0 && <Text style={styles.note}>{s.hiddenIncluded(summary.hiddenCount)}</Text>}
          {tooLarge && <Text style={styles.warn}>{s.exportTooLarge}</Text>}
        </View>

        {summary.canExport ? (
          <>
            <Text style={styles.heading}>{s.previewHeading}</Text>
            <View style={styles.preview}>
              {summary.previewLines.map((line, i) => (
                <Text key={i} style={styles.mono}>
                  {line}
                </Text>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.empty}>{s.exportNoRecords}</Text>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>{s.included}</Text>
          <Text style={styles.value}>{s.includedBody}</Text>
          <Text style={styles.label}>{s.excluded}</Text>
          <Text style={styles.value}>{s.excludedBody}</Text>
        </View>

        {failed && <Text style={styles.error}>{s.exportFailed}</Text>}
        {exporting && <Text style={styles.progress}>{s.exporting}</Text>}

        <Pressable
          style={[styles.primaryBtn, (!summary.canExport || exporting) && styles.btnDisabled]}
          onPress={handleExport}
          disabled={!summary.canExport || exporting}
        >
          <Text style={styles.primaryBtnText}>{s.exportButton}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const Row: React.FC<{ label: string; value: string; styles: ReturnType<typeof makeStyles> }> = ({ label, value, styles }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
)

export const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    card: { backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 6, borderWidth: 1, borderColor: c.border },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    value: { fontSize: 14, color: c.text },
    note: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
    warn: { fontSize: 13, color: c.danger, marginTop: 4 },
    heading: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
    preview: { backgroundColor: c.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.border, gap: 2 },
    mono: { fontFamily: 'monospace', fontSize: 12, color: c.text },
    empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', paddingVertical: 12 },
    error: { fontSize: 14, color: c.danger },
    progress: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
    primaryBtn: { paddingVertical: 15, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center' },
    primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    btnDisabled: { backgroundColor: c.border },
  })
