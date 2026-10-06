/**
 * 6-2. データを読み込む（F53・F54。UI仕様 6-2）。
 *
 * 流れ: 読み込み画面 →「CSVファイルを選ぶ」→ ファイルを確かめる（記録は変えない）→ 確認画面 → 読み込み方法 →
 *       「読み込む」→ 確認ダイアログ1回 → 実行（「読み込んでいます…」を全面に出し、終わるまで操作を受け付けない）→
 *       トースト → 設定画面へ戻る
 *
 * - 実行には確認画面を作ったときの内容（analysis）をそのまま使い、ファイルを読み直さない
 * - 確認中・確認画面で戻る操作・タブ移動をしたら、確認内容は捨てる（この画面が外れる）
 * - 読み込みは全部反映するか、何も反映しないか（ストアの importEntries が1回の書き込みで行う）
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useDiaryStore } from '@/store'
import { useTheme } from '@/hooks/useTheme'
import { t } from '@/i18n/strings'
import {
  analyzeImportFile,
  countOverwrites,
  hasQuestionLabelMismatch,
  type ImportAnalysis,
  type ImportFileError,
  type ImportMode,
} from '@/domain/csv/importer'
import { CSV_MAX_BYTES } from '@/domain/csv/format'
import { todayIso } from '@/utils/date'
import { pickCsvFile } from '@/utils/csvFile'
import { showToast } from '@/components/Toast'
import { BusyOverlay, ConfirmDialog, SubScreenHeader, useHardwareBack } from '@/components/Dialogs'
import { makeStyles } from './ExportScreen'

type Step =
  | { kind: 'select'; error: ImportFileError | 'readFailed' | null }
  | { kind: 'checking' }
  | { kind: 'confirm'; fileName: string; analysis: ImportAnalysis }

const formatDate = (iso: string) => iso.replace(/-/g, '/')

export const ImportScreen: React.FC<{ onBack: () => void; onDone: () => void }> = ({ onBack, onDone }) => {
  const settings = useDiaryStore((s) => s.settings)
  const entries = useDiaryStore((s) => s.entries)
  const importEntries = useDiaryStore((s) => s.importEntries)
  const { colors } = useTheme()
  const s = t(settings.language)
  const styles = makeStyles(colors)
  const currentQuestion = settings.questions.find((q) => q.id === settings.activeQuestionId)
  const currentLabel = currentQuestion?.label ?? ''

  const [step, setStep] = useState<Step>({ kind: 'select', error: null })
  const [mode, setMode] = useState<ImportMode>('add')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executeFailed, setExecuteFailed] = useState(false)

  // 確認中に戻る・タブ移動したら中止する。token が変わったら、途中の結果は捨てる
  const tokenRef = useRef(0)
  useEffect(() => {
    tokenRef.current++
    return () => {
      tokenRef.current++
    }
  }, [])

  const handleBack = useCallback(() => {
    if (executing) return true // 実行中は戻れない
    if (step.kind === 'select') {
      onBack()
    } else {
      tokenRef.current++ // 確認中の処理・確認内容を捨てる
      setStep({ kind: 'select', error: null })
      setExecuteFailed(false)
    }
    return true
  }, [executing, step.kind, onBack])
  useHardwareBack(handleBack)

  const handlePick = async () => {
    const token = ++tokenRef.current
    let picked
    try {
      picked = await pickCsvFile()
    } catch {
      setStep({ kind: 'select', error: 'readFailed' })
      return
    }
    if (!picked || token !== tokenRef.current) return // ファイル選択をキャンセル → 何も変えない
    setStep({ kind: 'checking' })
    setExecuteFailed(false)
    try {
      await new Promise((r) => setTimeout(r, 0)) // 「ファイルを確認しています…」を先に表示する
      if (picked.size !== undefined && picked.size > CSV_MAX_BYTES) {
        if (token === tokenRef.current) setStep({ kind: 'select', error: 'tooLarge' })
        return
      }
      const bytes = await picked.read()
      if (token !== tokenRef.current) return
      const result = analyzeImportFile(bytes, todayIso())
      if (token !== tokenRef.current) return
      if (!result.ok) {
        setStep({ kind: 'select', error: result.error })
        return
      }
      setMode('add')
      setStep({ kind: 'confirm', fileName: picked.name, analysis: result.analysis })
    } catch {
      if (token === tokenRef.current) setStep({ kind: 'select', error: 'readFailed' })
    }
  }

  const execute = async () => {
    if (step.kind !== 'confirm' || executing) return
    setDialogOpen(false)
    setExecuting(true)
    setExecuteFailed(false)
    try {
      await importEntries(step.analysis.records, mode)
      showToast(s.toastImported(step.analysis.records.length))
      setExecuting(false)
      onDone()
    } catch {
      setExecuting(false)
      setExecuteFailed(true)
    }
  }

  const title = step.kind === 'confirm' ? s.confirmTitle : s.importTitle

  return (
    <View style={styles.flex}>
      <SubScreenHeader title={title} onBack={handleBack} colors={colors} backLabel={s.back} />

      {step.kind !== 'confirm' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.value}>{s.importIntro}</Text>
            <Text style={styles.note}>{s.importNote1}</Text>
            <Text style={styles.note}>{s.importNote2}</Text>
          </View>
          {step.kind === 'select' && step.error && (
            <View style={styles.card}>
              <Text style={styles.error}>{s.importFileFailed}</Text>
              <Text style={styles.note}>{s.importFileError[step.error]}</Text>
            </View>
          )}
          {step.kind === 'checking' && <Text style={styles.progress}>{s.importChecking}</Text>}
          <Pressable
            style={[styles.primaryBtn, step.kind === 'checking' && styles.btnDisabled]}
            onPress={handlePick}
            disabled={step.kind === 'checking'}
          >
            <Text style={styles.primaryBtnText}>{s.importPick}</Text>
          </Pressable>
        </ScrollView>
      )}

      {step.kind === 'confirm' && (
        <ConfirmView
          step={step}
          mode={mode}
          setMode={setMode}
          currentLabel={currentLabel}
          overwrites={countOverwrites(step.analysis.records, entries, settings.activeQuestionId)}
          executeFailed={executeFailed}
          onImport={() => setDialogOpen(true)}
          s={s}
          styles={styles}
        />
      )}

      {step.kind === 'confirm' && (
        <ConfirmDialog
          visible={dialogOpen}
          colors={colors}
          onCancel={() => setDialogOpen(false)}
          title={mode === 'add' ? s.addConfirmTitle : s.replaceConfirmTitle}
          lines={
            mode === 'add'
              ? [s.addConfirmBody(step.analysis.records.length, countOverwrites(step.analysis.records, entries, settings.activeQuestionId))]
              : [
                  s.replaceConfirmBody(entries.length, step.analysis.records.length),
                  ...(hiddenCount(entries, settings.activeQuestionId) > 0
                    ? [s.replaceConfirmHidden(hiddenCount(entries, settings.activeQuestionId))]
                    : []),
                ]
          }
          buttons={[
            { label: s.cancel, onPress: () => setDialogOpen(false) },
            mode === 'add'
              ? { label: s.importButton, onPress: execute, kind: 'primary' }
              : { label: s.replaceConfirmOk, onPress: execute, kind: 'danger' },
          ]}
        />
      )}

      <BusyOverlay visible={executing} message={s.importing} />
    </View>
  )
}

const hiddenCount = (entries: { questionId: string }[], activeId: string) =>
  entries.filter((e) => e.questionId !== activeId).length

const ConfirmView: React.FC<{
  step: Extract<Step, { kind: 'confirm' }>
  mode: ImportMode
  setMode: (m: ImportMode) => void
  currentLabel: string
  overwrites: number
  executeFailed: boolean
  onImport: () => void
  s: ReturnType<typeof t>
  styles: ReturnType<typeof makeStyles>
}> = ({ step, mode, setMode, currentLabel, overwrites, executeFailed, onImport, s, styles }) => {
  const a = step.analysis
  const representative = a.firstQuestionLabel === null ? '' : a.firstQuestionLabel || s.noLabel
  const blockerText = a.blocker === 'noRecords' ? s.noRecords : a.blocker === 'noFirstQuestion' ? s.noFirstQuestion : null
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>{s.fileName}</Text>
        <Text style={styles.value}>{step.fileName}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>{s.recordCount}</Text>
          <Text style={styles.value}>{s.countUnit(a.totalRecords)}</Text>
        </View>
        {a.range && (
          <View style={styles.row}>
            <Text style={styles.label}>{s.period}</Text>
            <Text style={styles.value}>{`${formatDate(a.range.from)}〜${formatDate(a.range.to)}`}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>{s.importCount}</Text>
          <Text style={styles.value}>{s.countUnit(a.records.length)}</Text>
        </View>
      </View>

      {a.questionCount >= 2 && a.firstQuestionLabel !== null && (
        <View style={styles.card}>
          <Text style={styles.value}>{s.multiQuestion(a.questionCount, representative)}</Text>
        </View>
      )}
      {a.blocker === null && hasQuestionLabelMismatch(a, currentLabel) && (
        <View style={styles.card}>
          <Text style={styles.value}>{s.labelMismatch(representative, currentLabel)}</Text>
        </View>
      )}

      {a.invalidRecords.length > 0 && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{s.invalidRecords}</Text>
            <Text style={styles.value}>{s.countUnit(a.invalidRecords.length)}</Text>
          </View>
          {a.invalidRecords.slice(0, 3).map((r) => (
            <Text key={r.line} style={styles.note}>
              {s.invalidLine(r.line, s.invalidReason[r.reason])}
            </Text>
          ))}
        </View>
      )}
      {a.duplicateCount > 0 && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>{s.duplicates}</Text>
            <Text style={styles.value}>{s.countUnit(a.duplicateCount)}</Text>
          </View>
          <Text style={styles.note}>{s.duplicatesNote}</Text>
        </View>
      )}

      {blockerText ? (
        <Text style={styles.error}>{blockerText}</Text>
      ) : (
        <>
          <Text style={styles.heading}>{s.modeHeading}</Text>
          <View style={styles.card}>
            <RadioRow selected={mode === 'add'} label={s.modeAdd} note={s.modeAddNote(overwrites)} onPress={() => setMode('add')} styles={styles} />
            <RadioRow selected={mode === 'replace'} label={s.modeReplace} note={s.modeReplaceNote} onPress={() => setMode('replace')} styles={styles} />
          </View>
        </>
      )}

      {executeFailed && <Text style={styles.error}>{s.importFileFailed}</Text>}

      <Pressable style={[styles.primaryBtn, blockerText !== null && styles.btnDisabled]} onPress={onImport} disabled={blockerText !== null}>
        <Text style={styles.primaryBtnText}>{s.importButton}</Text>
      </Pressable>
    </ScrollView>
  )
}

const RadioRow: React.FC<{
  selected: boolean
  label: string
  note: string
  onPress: () => void
  styles: ReturnType<typeof makeStyles>
}> = ({ selected, label, note, onPress, styles }) => (
  <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={{ paddingVertical: 6 }}>
    <Text style={styles.value}>{`${selected ? '◉' : '○'} ${label}`}</Text>
    <Text style={[styles.note, { marginLeft: 22, marginTop: 2 }]}>{note}</Text>
  </Pressable>
)
