// CSV（F54）の書き出し・読み込みの純粋関数のテスト（Sprint 19b の [自動]）。「今日」は 2026-10-07 に固定する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeUtf8, decodeUtf8Strict, utf8ByteLength } from '../utf8'
import { parseCsv, formatCsvField } from '../rfc4180'
import {
  assignQuestionNumbers,
  buildExportCsv,
  buildExportRows,
  exceedsImportLimit,
  exportFileName,
  summarizeExport,
  CSV_HEADER_LINE,
  CSV_MAX_BYTES,
  type ExportSource,
} from '../format'
import { analyzeImportFile, applyImport, countOverwrites, hasQuestionLabelMismatch } from '../importer'
import type { DiaryEntry, Question } from '@/types'

const TODAY = '2026-10-07'
const BOM = [0xef, 0xbb, 0xbf]

const question = (id: string, label: string): Question => ({
  id,
  label,
  kaomojiSet: { 1: '', 2: '', 3: '', 4: '', 5: '' },
  reminderEnabled: false,
  reminderTime: '21:00',
})
const e = (date: string, questionId: string, level: 1 | 2 | 3 | 4 | 5 = 3, comment = ''): DiaryEntry => ({
  date,
  questionId,
  level,
  comment,
})
const src = (entries: DiaryEntry[], label = '禁煙', retired: ExportSource['retiredQuestions'] = []): ExportSource => ({
  entries,
  settings: { questions: [question('q1', label)], activeQuestionId: 'q1' },
  retiredQuestions: retired,
})
const bytesOf = (text: string, withBom = true): Uint8Array => {
  const body = encodeUtf8(text)
  if (!withBom) return body
  const out = new Uint8Array(body.length + 3)
  out.set(BOM, 0)
  out.set(body, 3)
  return out
}
const analyze = (text: string, withBom = true) => {
  const r = analyzeImportFile(bytesOf(text, withBom), TODAY)
  assert.ok(r.ok, `解析に失敗: ${!r.ok ? r.error : ''}`)
  return r.analysis
}
const H = CSV_HEADER_LINE + '\r\n'

// ── UTF-8 ────────────────────────────────────────────

test('UTF-8: 日本語・絵文字・改行を往復できる。バイト数の計算が実際のエンコード結果と一致する', () => {
  const s = '禁煙できた😄\r\n"あと少し"é'
  const b = encodeUtf8(s)
  assert.equal(b.length, utf8ByteLength(s))
  assert.equal(decodeUtf8Strict(b), s)
})

test('UTF-8: Shift_JIS のバイト列（「禁煙」= 8B D6 89 8C）は読めない（null）', () => {
  assert.equal(decodeUtf8Strict(new Uint8Array([0x8b, 0xd6, 0x89, 0x8c])), null)
})

test('UTF-8: 途中で切れた文字・冗長な表現・サロゲートの符号化は読めない', () => {
  assert.equal(decodeUtf8Strict(new Uint8Array([0xe7, 0xa6])), null)
  assert.equal(decodeUtf8Strict(new Uint8Array([0xc0, 0xaf])), null)
  assert.equal(decodeUtf8Strict(new Uint8Array([0xed, 0xa0, 0x80])), null)
  assert.equal(decodeUtf8Strict(new Uint8Array([0xf4, 0x90, 0x80, 0x80])), null)
  // 続きのバイト（0x80〜0xBF）・使われない先頭バイトが単独で現れる
  for (const b of [0x80, 0xbf, 0xc0, 0xc1, 0xf5, 0xff]) assert.equal(decodeUtf8Strict(new Uint8Array([0x61, b, 0x62])), null, b.toString(16))
})

// ── 書き出し ────────────────────────────────────────

test('書き出し: 先頭が BOM、1行目がヘッダ、区切りは CRLF（最後の記録の後にも CRLF）、日付の古い順・同じ日は question_no の小さい順', () => {
  const csv = buildExportCsv(
    src([e('2026-10-02', 'q1', 3), e('2026-10-01', 'q2', 2), e('2026-10-01', 'q1', 5)], '禁煙', [
      { id: 'q2', label: '運動', order: 2 },
    ]),
  )
  const b = encodeUtf8(csv)
  assert.deepEqual([...b.slice(0, 3)], BOM)
  assert.equal(
    csv.slice(1),
    'date,question_no,question,level,comment\r\n' +
      '2026-10-01,1,禁煙,5,\r\n' +
      '2026-10-01,2,運動,2,\r\n' +
      '2026-10-02,1,禁煙,3,\r\n',
  )
})

test('書き出し: 値の中の , 改行 " は " で囲み、" は2つ重ねる。LF・CRLF は変換しない', () => {
  assert.equal(formatCsvField('a,b'), '"a,b"')
  assert.equal(formatCsvField('1行目\n2行目'), '"1行目\n2行目"')
  assert.equal(formatCsvField('1行目\r\n2行目'), '"1行目\r\n2行目"')
  assert.equal(formatCsvField('"あと少し"と思えた'), '"""あと少し""と思えた"')
  assert.equal(formatCsvField('ふつう'), 'ふつう')
})

const TRICKY = ['a,b', '1行目\n2行目', '1行目\r\n2行目', '1行目\n\n3行目', '"あと少し"と思えた', '', 'x\ry']

test('往復（引用）: カンマ・改行・" を含む一言と問いの文言が、読み込むと元の文字列と完全に一致する', () => {
  const entries = TRICKY.map((c, i) => e(`2026-09-${String(10 + i).padStart(2, '0')}`, 'q1', 4, c))
  const csv = buildExportCsv(src(entries, '禁煙,"たばこ"\n'))
  const a = analyze(csv.slice(1)) // BOM は bytesOf で付け直す
  assert.equal(a.totalRecords, TRICKY.length, '引用の中の空行で記録が分かれない')
  assert.deepEqual(a.records.map((r) => r.comment), TRICKY)
  assert.equal(a.firstQuestionLabel, '禁煙,"たばこ"\n')
  assert.equal(a.invalidRecords.length, 0)
})

test('question_no の割り当て: いまの問い 1、外した問いは元の並び順、文言の分からない問いは最大の既知番号の次から（最古の日付→問いIDの辞書順）', () => {
  const s: ExportSource = {
    entries: [
      e('2026-09-10', 'q1'),
      e('2026-09-11', 'q2'),
      e('2026-09-01', 'qy'),
      e('2026-09-05', 'qy'),
      e('2026-09-01', 'qx'),
      e('2026-08-01', 'qz'),
    ],
    settings: { questions: [question('q1', '禁煙')], activeQuestionId: 'q1' },
    retiredQuestions: [
      { id: 'q2', label: '運動', order: 2 },
      { id: 'q4', label: '読書', order: 4 },
    ],
  }
  const m = assignQuestionNumbers(s)
  assert.deepEqual(m.get('q1'), { no: 1, label: '禁煙' })
  assert.deepEqual(m.get('q2'), { no: 2, label: '運動' })
  assert.deepEqual(m.get('qz'), { no: 5, label: '' })
  assert.deepEqual(m.get('qx'), { no: 6, label: '' })
  assert.deepEqual(m.get('qy'), { no: 7, label: '' })
})

test('いまの問いの記録が0件でも番号 1 は予約され、ほかの問いは 1 にならない', () => {
  const m = assignQuestionNumbers({
    entries: [e('2026-09-01', 'qx')],
    settings: { questions: [question('q1', '禁煙')], activeQuestionId: 'q1' },
    retiredQuestions: [],
  })
  assert.equal(m.get('qx')?.no, 2)
})

test('いまの問いIDが外した問いの一覧にもあるときは question_no = 1・いまの文言で書き出す', () => {
  const rows = buildExportRows({
    entries: [e('2026-09-01', 'q1')],
    settings: { questions: [question('q1', '禁煙')], activeQuestionId: 'q1' },
    retiredQuestions: [{ id: 'q1', label: '古い文言', order: 3 }],
  })
  assert.equal(rows[0].questionNo, 1)
  assert.equal(rows[0].question, '禁煙')
})

test('同じデータを2回書き出すと同じ内容。いまの問いの記録を1件加えてもほかの問いの番号は変わらない', () => {
  const base = src([e('2026-09-01', 'qx'), e('2026-08-01', 'qy'), e('2026-09-02', 'q1')], '禁煙', [
    { id: 'q2', label: '運動', order: 2 },
  ])
  assert.equal(buildExportCsv(base), buildExportCsv(base))
  const before = assignQuestionNumbers(base)
  const after = assignQuestionNumbers({ ...base, entries: [...base.entries, e('2026-10-01', 'q1')] })
  for (const id of ['q2', 'qx', 'qy']) assert.deepEqual(after.get(id), before.get(id))
})

test('記録0件のとき書き出しの操作が無効になる判定。件数・期間・先頭の例・画面に出ない記録の件数', () => {
  const empty = summarizeExport(src([]))
  assert.equal(empty.canExport, false)
  assert.equal(empty.count, 0)
  assert.equal(empty.range, null)

  const s = summarizeExport(
    src([e('2026-06-25', 'q1', 5), e('2026-06-26', 'q1', 3, '1行目\n2行目'), e('2026-06-27', 'q2'), e('2026-10-07', 'q1')]),
  )
  assert.equal(s.canExport, true)
  assert.equal(s.count, 4, '改行を含む記録も1件')
  assert.deepEqual(s.range, { from: '2026-06-25', to: '2026-10-07' })
  assert.equal(s.hiddenCount, 1)
  assert.equal(s.previewLines.length, 4, 'ヘッダ＋先頭3件')
  assert.equal(s.previewLines[2], '2026-06-26,1,禁煙,3,"1行目\n2行目"')
})

test('ファイル名は kaomoji-diary_YYYY-MM-DD.csv（書き出す日の端末の日付）', () => {
  assert.equal(exportFileName('2026-10-07'), 'kaomoji-diary_2026-10-07.csv')
})

test('R1: 書き出す CSV が 10,485,760 バイトを超えるかの判定（BOM 込み）', () => {
  const filler = (n: number) => 'a'.repeat(n)
  assert.equal(exceedsImportLimit('﻿' + filler(CSV_MAX_BYTES - 3)), false)
  assert.equal(exceedsImportLimit('﻿' + filler(CSV_MAX_BYTES - 2)), true)
})

// ── 読み込み: ファイル全体 ───────────────────────────

test('BOM あり・なし、CRLF・LF の CSV を同じ内容として読み込める（最後の区切りは有っても無くてもよい）', () => {
  const body = ['2026-10-01,1,禁煙,5,a', '2026-10-02,1,禁煙,3,"b\nc"']
  const variants = [
    { text: H + body.join('\r\n') + '\r\n', bom: true },
    { text: H + body.join('\r\n'), bom: false },
    { text: CSV_HEADER_LINE + '\n' + body.join('\n') + '\n', bom: true },
    { text: CSV_HEADER_LINE + '\n' + body.join('\n'), bom: false },
  ]
  const results = variants.map((v) => analyze(v.text, v.bom).records)
  for (const r of results) assert.deepEqual(r, results[0])
  assert.equal(results[0].length, 2)
  assert.equal(results[0][1].comment, 'b\nc')
})

test('全体失敗: ヘッダの違い・閉じていない引用・UTF-8 でない・空のファイル・引用の外の単独 CR', () => {
  const fail = (b: Uint8Array) => {
    const r = analyzeImportFile(b, TODAY)
    assert.equal(r.ok, false)
    return r.ok ? null : r.error
  }
  assert.equal(fail(bytesOf('question_no,date,question,level,comment\r\n2026-10-01,1,a,3,\r\n')), 'header')
  assert.equal(fail(bytesOf(CSV_HEADER_LINE + ',extra\r\n')), 'header')
  assert.equal(fail(bytesOf(' ' + CSV_HEADER_LINE + '\r\n')), 'header')
  assert.equal(fail(bytesOf('Date,Question_no,question,level,comment\r\n')), 'header')
  assert.equal(fail(bytesOf(H + '2026-10-01,1,禁煙,3,"閉じていない\r\n')), 'unparsable')
  assert.equal(fail(bytesOf(H + '2026-10-01,1,禁煙,3,"a"b\r\n')), 'unparsable')
  assert.equal(fail(bytesOf(H + '2026-10-01,1,禁煙,3,a\rb\r\n')), 'unparsable')
  // Shift_JIS で保存したファイル（ヘッダは ASCII、記録に「禁煙」= 8B D6 89 8C）
  const sjis = new Uint8Array([...encodeUtf8(H + '2026-10-01,1,'), 0x8b, 0xd6, 0x89, 0x8c, ...encodeUtf8(',3,\r\n')])
  assert.equal(fail(sjis), 'notUtf8')
  assert.equal(fail(new Uint8Array([])), 'empty')
  assert.equal(fail(new Uint8Array(BOM)), 'empty')
})

test('大きさの上限: BOM を含めてちょうど 10,485,760 バイトは読める。10,485,761 バイトは全体を失敗', () => {
  const head = H + '2026-10-01,1,禁煙,5,'
  const make = (total: number) => {
    const b = new Uint8Array(total)
    b.set(BOM, 0)
    const h = encodeUtf8(head)
    b.set(h, 3)
    b.fill(0x61, 3 + h.length, total - 2) // 一言を 'a' で埋める
    b[total - 2] = 0x0d
    b[total - 1] = 0x0a
    return b
  }
  const exact = analyzeImportFile(make(CSV_MAX_BYTES), TODAY)
  assert.ok(exact.ok)
  if (exact.ok) {
    assert.equal(exact.analysis.records.length, 1)
    assert.equal(exact.analysis.records[0].comment.length, CSV_MAX_BYTES - 3 - encodeUtf8(head).length - 2)
  }
  const over = analyzeImportFile(make(CSV_MAX_BYTES + 1), TODAY)
  assert.deepEqual(over, { ok: false, error: 'tooLarge' })
})

// ── 読み込み: 記録ごと ───────────────────────────────

test('不正な記録のスキップ: 正しい3件だけ読み込み、読み込めない記録の件数が一致する', () => {
  const lines = [
    '2026-10-01,1,禁煙,5,ok1',
    '2026/10/02,1,禁煙,3,形式違い',
    '2026-02-30,1,禁煙,3,実在しない',
    '2026-10-08,1,禁煙,3,未来',
    '2026-10-02,1,禁煙,3,ok2',
    '2026-10-03,1,禁煙,0,',
    '2026-10-03,1,禁煙,6,',
    '2026-10-03,1,禁煙,3.5,',
    '2026-10-03,1,禁煙,,',
    '2026-10-03,1,禁煙, 3,',
    '2026-10-03,0,禁煙,3,',
    '2026-10-03,a,禁煙,3,',
    '2026-10-03,01,禁煙,3,',
    '2026-10-03,1,禁煙,3',
    '2026-10-03,1,禁煙,3,,',
    '2026-10-04,1,禁煙,4,ok3',
  ]
  const a = analyze(H + lines.join('\r\n') + '\r\n')
  assert.deepEqual(a.records.map((r) => r.comment), ['ok1', 'ok2', 'ok3'])
  assert.equal(a.invalidRecords.length, lines.length - 3)
  assert.equal(a.totalRecords, lines.length)
  const reasons = a.invalidRecords.map((x) => x.reason)
  assert.deepEqual(reasons.slice(0, 3), ['dateFormat', 'dateNotExist', 'dateFuture'])
  assert.ok(reasons.includes('level') && reasons.includes('questionNo') && reasons.includes('columnCount'))
  assert.equal(a.invalidRecords[0].line, 3)
})

test('今日（2026-10-07）の日付は読み込める・うるう年の 2024-02-29 は実在する', () => {
  const a = analyze(H + '2026-10-07,1,禁煙,5,\r\n2024-02-29,1,禁煙,5,\r\n')
  assert.equal(a.records.length, 2)
})

test('行番号: 2件目の一言が2行にわたるとき、3件目の不正な記録の行番号は 5。記録件数は 3', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,5,a\r\n2026-10-02,1,禁煙,3,"1行目\r\n2行目"\r\n2026-10-03,1,禁煙,9,x\r\n')
  assert.equal(a.totalRecords, 3)
  assert.deepEqual(a.invalidRecords, [{ line: 5, reason: 'level' }])
})

test('判定の順番（重複）(a) 前が level 5・後ろが level 6 → 後ろは不正1件、前を採用、重複0件', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,5,\r\n2026-10-01,1,禁煙,6,\r\n')
  assert.equal(a.invalidRecords.length, 1)
  assert.equal(a.duplicateCount, 0)
  assert.deepEqual(a.records.map((r) => r.level), [5])
})

test('判定の順番（重複）(b) 正しい記録が3件重なる → 最も後ろを採用、重複2件、不正0件', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,1,first\r\n2026-10-01,1,禁煙,2,second\r\n2026-10-01,1,禁煙,3,last\r\n')
  assert.equal(a.duplicateCount, 2)
  assert.equal(a.invalidRecords.length, 0)
  assert.deepEqual(a.records, [{ date: '2026-10-01', level: 3, comment: 'last' }])
})

test('判定の順番（重複）(c) 同じ日で question_no が 1 と 2 → 重複0件。無料版は 1 だけ読み込み、2 は不正にも重複にも数えない', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,5,\r\n2026-10-01,2,運動,3,\r\n')
  assert.equal(a.duplicateCount, 0)
  assert.equal(a.invalidRecords.length, 0)
  assert.equal(a.records.length, 1)
  assert.equal(a.questionCount, 2)
})

test('空行は無視し件数に数えない。引用の中の空行は値の一部', () => {
  const a = analyze(H + '\r\n2026-10-01,1,禁煙,5,"a\r\n\r\nb"\r\n\r\n\n2026-10-02,1,禁煙,4,\r\n')
  assert.equal(a.totalRecords, 2)
  assert.equal(a.records[0].comment, 'a\r\n\r\nb')
  assert.equal(a.invalidRecords.length, 0)
})

test('問いが複数のファイル: question_no = 1 だけを読み込み、問いが2個の判定になる', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,5,\r\n2026-10-02,2,運動,3,\r\n2026-10-03,1,禁煙,4,\r\n')
  assert.equal(a.questionCount, 2)
  assert.deepEqual(a.records.map((r) => r.date), ['2026-10-01', '2026-10-03'])
  assert.equal(a.blocker, null)
})

test('代表の文言: 「禁煙」「たばこ」「禁煙」の順なら「禁煙」。いまの問いが「運動」ならお知らせを出す判定', () => {
  const a = analyze(H + '2026-10-01,1,禁煙,5,\r\n2026-10-02,1,たばこ,3,\r\n2026-10-03,1,禁煙,4,\r\n')
  assert.equal(a.firstQuestionLabel, '禁煙')
  assert.equal(hasQuestionLabelMismatch(a, '運動'), true)
  assert.equal(hasQuestionLabelMismatch(a, '禁煙'), false)
})

test('1つめの問いが無い（question_no = 2 と 3 だけ）→ 読み込めない判定', () => {
  const a = analyze(H + '2026-10-01,2,運動,5,\r\n2026-10-02,3,勉強,3,\r\n')
  assert.equal(a.blocker, 'noFirstQuestion')
  assert.equal(a.records.length, 0)
})

test('判定 1〜3 を通った記録が0件 → 読み込める記録がありません', () => {
  assert.equal(analyze(H).blocker, 'noRecords')
  assert.equal(analyze(H + '2026-10-01,1,禁煙,9,\r\n').blocker, 'noRecords')
})

test('長い値: 150文字・改行を含む一言と30文字の問いは不正にせず切り詰めない（U6）', () => {
  const longComment = 'あ'.repeat(70) + '\n' + 'い'.repeat(79)
  const longQ = 'う'.repeat(30)
  const a = analyze(H + `2026-10-01,1,${longQ},5,"${longComment}"\r\n`)
  assert.equal(a.records[0].comment, longComment)
  assert.equal(a.firstQuestionLabel, longQ)
})

test('確認内容と実行内容: 確認画面を作った後に元のファイルのバイト列を書き換えても、確認内容は変わらない', () => {
  const b = bytesOf(H + '2026-10-01,1,禁煙,5,before\r\n')
  const r = analyzeImportFile(b, TODAY)
  assert.ok(r.ok)
  b.fill(0x7a) // 元のファイルの中身を書き換える
  if (r.ok) assert.deepEqual(r.analysis.records, [{ date: '2026-10-01', level: 5, comment: 'before' }])
})

// ── 反映 ────────────────────────────────────────────

test('「いまの記録に追加」: 10/1 はそのまま、10/2 は上書き、10/3 を追加。上書き件数 1。画面に出ない記録は残る', () => {
  const entries = [e('2026-10-01', 'q1', 1, 'keep'), e('2026-10-02', 'q1', 1, 'old'), e('2026-10-02', 'q2', 2, 'hidden')]
  const records = [
    { date: '2026-10-02', level: 5 as const, comment: 'new' },
    { date: '2026-10-03', level: 4 as const, comment: 'added' },
  ]
  assert.equal(countOverwrites(records, entries, 'q1'), 1)
  const out = applyImport(entries, records, 'q1', 'add')
  assert.deepEqual(out, [
    e('2026-10-01', 'q1', 1, 'keep'),
    e('2026-10-02', 'q1', 5, 'new'),
    e('2026-10-02', 'q2', 2, 'hidden'),
    e('2026-10-03', 'q1', 4, 'added'),
  ])
})

test('「いまの記録に追加」: 同じ日に画面に出ない記録が先に並んでいても、それは上書きしない', () => {
  const entries = [e('2026-10-02', 'q2', 2, 'hidden'), e('2026-10-02', 'q1', 1, 'old')]
  const out = applyImport(entries, [{ date: '2026-10-02', level: 5, comment: 'new' }], 'q1', 'add')
  assert.deepEqual(out, [e('2026-10-02', 'q2', 2, 'hidden'), e('2026-10-02', 'q1', 5, 'new')])
})

test('「すべて置き換える」: 画面に出ない記録を含めて全部消え、ファイルの記録（いまの問い）だけになる', () => {
  const out = applyImport([e('2026-10-01', 'q1'), e('2026-10-01', 'q2')], [{ date: '2026-09-01', level: 2, comment: 'x' }], 'q1', 'replace')
  assert.deepEqual(out, [e('2026-09-01', 'q1', 2, 'x')])
})

test('parseCsv: 空のテキストは記録0件、最後が , で終わる値は空の値が続く', () => {
  const r = parseCsv('a,\r\n')
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.records[0].fields, ['a', ''])
  const empty = parseCsv('')
  assert.ok(empty.ok && empty.records.length === 0)
})
