/**
 * 読み込み（F53）の判定と反映（純粋関数）。製品仕様「読み込みの判定（順番どおりに行う）」。
 *
 * 1. ファイル全体: 大きさ → 文字コード（UTF-8）→ CSV として解析できるか → ヘッダ。だめなら全体を失敗
 * 2. 記録ごとの妥当性: 不正な記録は読み込まず「読み込めない記録」に数える（空行は無視）
 * 3. 重複: 2 を通った記録のうち同じ date・question_no は、ファイルの最も後ろの記録を採用
 * 4. 無料版は 3 の後に残った記録のうち question_no = 1 のものを読み込む
 *
 * ここで作った結果（ImportAnalysis）を確認画面に出し、実行にもそのまま使う（ファイルを読み直さない）。
 */
import type { DiaryEntry, KaomojiLevel } from '@/types'
import { CSV_HEADER_FIELDS, CSV_HEADER_LINE, CSV_MAX_BYTES } from './format'
import { parseCsv } from './rfc4180'
import { BOM_CHAR, decodeUtf8Strict } from './utf8'

export type ImportFileError = 'tooLarge' | 'notUtf8' | 'empty' | 'unparsable' | 'header'

export type InvalidRecordReason =
  | 'columnCount'
  | 'dateFormat'
  | 'dateNotExist'
  | 'dateFuture'
  | 'questionNo'
  | 'level'

export interface InvalidRecord {
  /** その記録が始まるファイルの行（ヘッダが1行目） */
  line: number
  reason: InvalidRecordReason
}

export interface ImportRecord {
  date: string
  level: KaomojiLevel
  comment: string
}

export interface ImportAnalysis {
  /** ファイルの記録（レコード）の数。ヘッダと空行を除く */
  totalRecords: number
  invalidRecords: InvalidRecord[]
  /** 判定 3 で採用しなかった記録の数 */
  duplicateCount: number
  /** 判定 1〜3 を通った記録の question_no の種類の数 */
  questionCount: number
  /** question_no = 1 の代表の文言（ファイルで最初に現れた記録の question）。question_no = 1 が無ければ null */
  firstQuestionLabel: string | null
  /** 実際に読み込む記録（無料版: question_no = 1）。日付の古い順 */
  records: ImportRecord[]
  /** 読み込む記録の最も古い日〜最も新しい日 */
  range: { from: string; to: string } | null
  /** 読み込めない理由（「読み込む」を押せない） */
  blocker: null | 'noRecords' | 'noFirstQuestion'
}

export type ImportAnalysisResult =
  | { ok: true; analysis: ImportAnalysis }
  | { ok: false; error: ImportFileError }

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const QUESTION_NO_RE = /^[1-9][0-9]*$/
const LEVEL_RE = /^[1-5]$/

const isRealDate = (y: number, m: number, d: number): boolean => {
  if (m < 1 || m > 12 || d < 1) return false
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d <= dim
}

/** 記録1件の妥当性。正しければ null、不正なら理由（today は YYYY-MM-DD） */
export const validateRecordFields = (fields: string[], today: string): InvalidRecordReason | null => {
  if (fields.length !== CSV_HEADER_FIELDS.length) return 'columnCount'
  const [date, questionNo, , level] = fields
  const m = DATE_RE.exec(date)
  if (!m) return 'dateFormat'
  if (!isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) return 'dateNotExist'
  if (date > today) return 'dateFuture'
  if (!QUESTION_NO_RE.test(questionNo)) return 'questionNo'
  if (!LEVEL_RE.test(level)) return 'level'
  return null
}

/** ファイルの1行目（BOM を除き、最初の CRLF / LF / CR の手前まで） */
const firstPhysicalLine = (text: string): string => {
  const m = /\r\n|\n|\r/.exec(text)
  return m ? text.slice(0, m.index) : text
}

/**
 * 選んだファイルのバイト列を判定し、確認画面に出す内容を作る。記録・設定は変更しない。
 * today は読み込む時点の端末の今日（YYYY-MM-DD）。これより後の日付は不正。
 */
export const analyzeImportFile = (bytes: Uint8Array, today: string): ImportAnalysisResult => {
  // 1. ファイル全体
  if (bytes.length > CSV_MAX_BYTES) return { ok: false, error: 'tooLarge' }
  const decoded = decodeUtf8Strict(bytes)
  if (decoded === null) return { ok: false, error: 'notUtf8' }
  const text = decoded.startsWith(BOM_CHAR) ? decoded.slice(1) : decoded
  if (text.length === 0) return { ok: false, error: 'empty' }
  const parsed = parseCsv(text)
  if (!parsed.ok) return { ok: false, error: 'unparsable' }
  if (firstPhysicalLine(text) !== CSV_HEADER_LINE) return { ok: false, error: 'header' }

  // 2. 記録ごとの妥当性（ヘッダ＝最初の記録は除く。空行は無視）
  const body = parsed.records.slice(1).filter((r) => !r.empty)
  const invalidRecords: InvalidRecord[] = []
  const valid: { fields: string[]; index: number }[] = []
  body.forEach((r, index) => {
    const reason = validateRecordFields(r.fields, today)
    if (reason) invalidRecords.push({ line: r.line, reason })
    else valid.push({ fields: r.fields, index })
  })

  // 3. 重複: 同じ date・question_no はファイルの最も後ろの記録を採用
  const lastByKey = new Map<string, { fields: string[]; index: number }>()
  for (const v of valid) lastByKey.set(`${v.fields[0]}|${v.fields[1]}`, v)
  const adopted = [...lastByKey.values()].sort((a, b) => a.index - b.index)
  const duplicateCount = valid.length - adopted.length

  const questionNos = new Set(adopted.map((a) => a.fields[1]))
  const firstQuestion = adopted.filter((a) => a.fields[1] === '1')
  const firstQuestionLabel = firstQuestion.length > 0 ? firstQuestion[0].fields[2] : null

  // 4. 無料版は question_no = 1 だけ
  const records: ImportRecord[] = firstQuestion
    .map((a) => ({ date: a.fields[0], level: Number(a.fields[3]) as KaomojiLevel, comment: a.fields[4] }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const blocker: ImportAnalysis['blocker'] =
    adopted.length === 0 ? 'noRecords' : firstQuestion.length === 0 ? 'noFirstQuestion' : null

  return {
    ok: true,
    analysis: {
      totalRecords: body.length,
      invalidRecords,
      duplicateCount,
      questionCount: questionNos.size,
      firstQuestionLabel,
      records,
      range: records.length > 0 ? { from: records[0].date, to: records[records.length - 1].date } : null,
      blocker,
    },
  }
}

export type ImportMode = 'add' | 'replace'

/** 「いまの記録に追加」で上書きする件数（読み込む記録のうち、いまの問いの記録と日付が重なる件数） */
export const countOverwrites = (records: ImportRecord[], entries: DiaryEntry[], questionId: string): number => {
  const dates = new Set(entries.filter((e) => e.questionId === questionId).map((e) => e.date))
  return records.filter((r) => dates.has(r.date)).length
}

/** ファイルの問いの文言といまの問いの文言が違うときのお知らせを出すか（U1） */
export const hasQuestionLabelMismatch = (analysis: ImportAnalysis, currentLabel: string): boolean =>
  analysis.firstQuestionLabel !== null && analysis.firstQuestionLabel !== currentLabel

/**
 * 読み込んだ後の記録の全体。
 * - add: ファイルの記録をいまの問いの記録として加える。同じ日のいまの記録はファイルの内容で上書き。
 *        ファイルに無い日のいまの記録・画面に出ない記録はそのまま
 * - replace: 保存されている記録を全部（画面に出ない記録も）ファイルの記録に入れ替える
 */
export const applyImport = (
  entries: DiaryEntry[],
  records: ImportRecord[],
  questionId: string,
  mode: ImportMode,
): DiaryEntry[] => {
  const incoming: DiaryEntry[] = records.map((r) => ({
    date: r.date,
    questionId,
    level: r.level,
    comment: r.comment,
  }))
  if (mode === 'replace') return incoming

  const byDate = new Map(incoming.map((e) => [e.date, e]))
  const result = entries.map((e) => {
    if (e.questionId !== questionId) return e
    const replacement = byDate.get(e.date)
    if (!replacement) return e
    byDate.delete(e.date)
    return replacement
  })
  return [...result, ...byDate.values()]
}
