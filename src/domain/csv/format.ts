/**
 * CSV（F54）の共通の定義と、書き出し（F51）の組み立て（純粋関数）。
 * 製品仕様「データ形式（CSV）— F54」「書き出すときの question_no と question」。
 */
import type { DiaryEntry, RetiredQuestion, UserSettings } from '@/types'
import { formatCsvRecord } from './rfc4180'
import { BOM_CHAR, utf8ByteLength } from './utf8'

export const CSV_HEADER_FIELDS = ['date', 'question_no', 'question', 'level', 'comment'] as const
export const CSV_HEADER_LINE = CSV_HEADER_FIELDS.join(',')
export const CSV_RECORD_SEPARATOR = '\r\n'
/** 読み込みの上限（BOM を含むファイル全体のバイト数）。ちょうどは可、1バイトでも超えると不可（U5） */
export const CSV_MAX_BYTES = 10_485_760

export interface ExportSource {
  entries: DiaryEntry[]
  settings: Pick<UserSettings, 'questions' | 'activeQuestionId'>
  retiredQuestions: RetiredQuestion[]
}

export interface QuestionNumber {
  no: number
  label: string
}

/**
 * 問いID → question_no・question の割り当て。
 *
 * 1. いまの問い: 番号 1 を予約（記録0件でも）。文言はいまの文言。外した問いの一覧に同じIDがあってもいまの問いを優先
 * 2. 外した問い（いまの問いと同じIDを除く）: 元の並び順・その文言
 * 3. 文言の分からない問いID: 1 と 2 の番号すべて（記録の有無に関係なく）の最大値の次から連番。
 *    振る順は、その問いIDの最も古い記録の日付の昇順、同じ日は問いIDの辞書順。文言は空
 */
export const assignQuestionNumbers = (src: ExportSource): Map<string, QuestionNumber> => {
  const map = new Map<string, QuestionNumber>()
  const currentId = src.settings.activeQuestionId
  const current = src.settings.questions.find((q) => q.id === currentId)
  if (currentId) map.set(currentId, { no: 1, label: current?.label ?? '' })

  let maxKnown = 1
  for (const r of src.retiredQuestions) {
    if (r.id === currentId) continue
    map.set(r.id, { no: r.order, label: r.label })
    if (r.order > maxKnown) maxKnown = r.order
  }

  const oldestByUnknownId = new Map<string, string>()
  for (const e of src.entries) {
    if (map.has(e.questionId)) continue
    const prev = oldestByUnknownId.get(e.questionId)
    if (prev === undefined || e.date < prev) oldestByUnknownId.set(e.questionId, e.date)
  }
  const unknownIds = [...oldestByUnknownId.entries()].sort(([idA, dA], [idB, dB]) =>
    dA !== dB ? (dA < dB ? -1 : 1) : idA < idB ? -1 : idA > idB ? 1 : 0,
  )
  let next = maxKnown + 1
  for (const [id] of unknownIds) map.set(id, { no: next++, label: '' })
  return map
}

export interface ExportRow {
  date: string
  questionNo: number
  question: string
  level: number
  comment: string
}

/** 書き出す記録の並び（日付の古い順、同じ日は question_no の小さい順） */
export const buildExportRows = (src: ExportSource): ExportRow[] => {
  const numbers = assignQuestionNumbers(src)
  return src.entries
    .map((e) => {
      const n = numbers.get(e.questionId) as QuestionNumber
      return { date: e.date, questionNo: n.no, question: n.label, level: e.level, comment: e.comment ?? '' }
    })
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.questionNo - b.questionNo))
}

export const formatExportRow = (r: ExportRow): string =>
  formatCsvRecord([r.date, String(r.questionNo), r.question, String(r.level), r.comment])

/** 書き出すファイルの中身（BOM 付き・記録の区切りは CRLF・最後の記録の後にも CRLF） */
export const buildExportCsv = (src: ExportSource): string => {
  const lines = [CSV_HEADER_LINE, ...buildExportRows(src).map(formatExportRow)]
  return BOM_CHAR + lines.join(CSV_RECORD_SEPARATOR) + CSV_RECORD_SEPARATOR
}

/** ファイル名 `kaomoji-diary_YYYY-MM-DD.csv`（today は書き出す日の端末の日付 YYYY-MM-DD） */
export const exportFileName = (today: string): string => `kaomoji-diary_${today}.csv`

export interface ExportSummary {
  /** 記録（レコード）の件数 */
  count: number
  /** 最も古い日〜最も新しい日（0件なら null） */
  range: { from: string; to: string } | null
  /** 画面に出ない記録（いまの問い以外の記録）の件数 */
  hiddenCount: number
  /** 先頭の例: ヘッダと先頭3件の記録の CSV 表記 */
  previewLines: string[]
  /** 書き出す記録が無いときは押せない */
  canExport: boolean
}

export const summarizeExport = (src: ExportSource): ExportSummary => {
  const rows = buildExportRows(src)
  return {
    count: rows.length,
    range: rows.length > 0 ? { from: rows[0].date, to: rows[rows.length - 1].date } : null,
    hiddenCount: src.entries.filter((e) => e.questionId !== src.settings.activeQuestionId).length,
    previewLines: [CSV_HEADER_LINE, ...rows.slice(0, 3).map(formatExportRow)],
    canExport: rows.length > 0,
  }
}

/** 書き出すファイルが読み込みの上限を超えるか（未確定事項 R1 の推奨案: 警告を出して書き出しは許可） */
export const exceedsImportLimit = (csv: string): boolean => utf8ByteLength(csv) > CSV_MAX_BYTES
