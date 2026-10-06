/**
 * RFC 4180 の CSV の解析・値の書き出し（純粋関数）。製品仕様「データ形式（CSV）— F54」。
 *
 * 用語: 「記録（レコード）」は値の並び1件分。値の中に改行があるとファイルの複数の行にまたがる。
 * 「ファイルの行（物理行）」は改行で区切った行（1から数える）。
 */

export interface CsvRecord {
  /** 値（引用は外し、"" は " に戻した後のもの） */
  fields: string[]
  /** この記録が始まるファイルの行の番号（1始まり） */
  line: number
  /** 引用の外の空行（値が何も無い行）。読み込みでは無視する */
  empty: boolean
}

export type CsvParseFailure = 'unclosedQuote' | 'strayCarriageReturn' | 'textAfterQuote' | 'quoteInUnquotedField'

export type CsvParseResult =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; reason: CsvParseFailure; line: number }

const QUOTE = 34 // "
const COMMA = 44 // ,
const CR = 13
const LF = 10

/**
 * CSV の文字列を記録の並びにする（BOM は呼び出し側で取り除いておく）。
 *
 * - 記録の区切りは CRLF・LF の両方を受け付ける。最後の記録の後の区切りは有っても無くてもよい
 * - 値の先頭が " のときは引用された値。引用の中の CR・LF・カンマは値の一部としてそのまま残し、"" は " に戻す
 * - 解析できないもの（閉じていない引用・閉じた引用の直後の余計な文字・引用の外の単独の CR・
 *   引用で始まらない値の途中にある "〔RFC 4180 §2 は認めていない〕）は失敗にする
 */
export const parseCsv = (text: string): CsvParseResult => {
  const records: CsvRecord[] = []
  const len = text.length
  let i = 0
  let line = 1

  while (i < len) {
    const startLine = line
    const fields: string[] = []
    let sawAnything = false
    let recordDone = false

    while (!recordDone) {
      let value: string
      if (i < len && text.charCodeAt(i) === QUOTE) {
        // ── 引用された値 ──
        sawAnything = true
        i++
        const parts: string[] = []
        let segStart = i
        let closed = false
        while (i < len) {
          const c = text.charCodeAt(i)
          if (c === QUOTE) {
            if (i + 1 < len && text.charCodeAt(i + 1) === QUOTE) {
              parts.push(text.slice(segStart, i + 1)) // "" → "
              i += 2
              segStart = i
              continue
            }
            parts.push(text.slice(segStart, i))
            i++
            closed = true
            break
          }
          if (c === LF) line++
          else if (c === CR && !(i + 1 < len && text.charCodeAt(i + 1) === LF)) line++ // 単独の CR も行の区切りとして数える
          i++
        }
        if (!closed) return { ok: false, reason: 'unclosedQuote', line: startLine }
        value = parts.join('')
        if (i < len) {
          const n = text.charCodeAt(i)
          if (n !== COMMA && n !== CR && n !== LF) return { ok: false, reason: 'textAfterQuote', line }
        }
      } else {
        // ── 引用されていない値: 次の , ・改行・終わりまで ──
        let j = i
        while (j < len) {
          const c = text.charCodeAt(j)
          if (c === COMMA || c === CR || c === LF) break
          if (c === QUOTE) return { ok: false, reason: 'quoteInUnquotedField', line }
          j++
        }
        value = text.slice(i, j)
        if (j > i) sawAnything = true
        i = j
      }

      fields.push(value)

      // ── 値の後ろ: , なら次の値、改行・終わりなら記録の終わり ──
      if (i >= len) {
        recordDone = true
        continue
      }
      const sep = text.charCodeAt(i)
      if (sep === COMMA) {
        sawAnything = true
        i++
        if (i >= len) {
          fields.push('') // 最後が , で終わる → 空の値が1つ続く
          recordDone = true
        }
        continue
      }
      if (sep === CR) {
        if (i + 1 < len && text.charCodeAt(i + 1) === LF) {
          i += 2
          line++
          recordDone = true
          continue
        }
        return { ok: false, reason: 'strayCarriageReturn', line }
      }
      // LF
      i++
      line++
      recordDone = true
    }

    records.push({ fields, line: startLine, empty: !sawAnything })
  }

  return { ok: true, records }
}

/** 値を CSV に書くときの形。カンマ・改行（CR/LF）・" を含むときだけ " で囲み、中の " は2つ重ねる */
export const formatCsvField = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

export const formatCsvRecord = (fields: readonly string[]): string => fields.map(formatCsvField).join(',')
