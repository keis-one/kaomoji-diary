/**
 * Sprint 19a 追補・19b で追加した画面・ダイアログ・トーストの文言（日本語・英語）。
 * 英語は Generator の案（オーナー確認待ち）。お問い合わせの件名は src/domain/contact.ts で日本語に固定。
 * 文言に数値が入るものは関数にしている。
 */
import type { Language } from '@/types'
import type { InvalidRecordReason, ImportFileError } from '@/domain/csv/importer'

const ja = {
  // 共通
  cancel: 'キャンセル',
  back: '戻る',
  loadFailedTitle: 'データを読み込めませんでした',
  loadFailedBody: '保存されている記録を読み込めませんでした。記録を守るため、この画面で止まっています。アプリを再起動するか、もう一度お試しください。',
  retry: 'もう一度試す',

  // トースト
  toastRecorded: '記録しました',
  toastSaved: '保存しました',
  toastDeleted: '記録を削除しました',
  toastExported: 'CSVファイルを作成しました',
  toastImported: (n: number) => `${n} 件の記録を読み込みました`,
  toastCopied: 'コピーしました',

  // 問いの入力し直し（A3）
  recoverMessage: '問いの設定を読み込めませんでした。記録は残っています。もう一度、問いを入力してください。',
  recoverStart: 'はじめる',
  recoverSaveFailed: '保存できませんでした。もう一度お試しください',

  // オンボーディング
  onboardingSaveFailed: '保存できませんでした。もう一度お試しください',

  // ホーム
  homeSaveFailed: '保存できませんでした。もう一度お試しください',

  // ポップアップ
  popupRecord: '記録する',
  popupSave: '保存',
  popupDelete: 'この日の記録を削除',
  popupSaveFailed: '保存できませんでした。もう一度お試しください',
  popupDeleteFailed: '削除できませんでした。もう一度お試しください',
  commentTooLong: (n: number) => `一言は100文字までです（いま ${n} 文字）`,
  deleteConfirmTitle: 'この日の記録を削除しますか？',
  deleteConfirmBody: (dateLabel: string) => `${dateLabel}の記録（顔文字・一言）を削除します。元に戻せません。`,
  deleteConfirmOk: '削除する',

  // 設定
  settingsTitle: '設定',
  sectionRecord: '記録の設定',
  todaysQuestion: '今日の問い',
  sectionKaomoji: '顔文字',
  sectionApp: 'アプリ設定',
  reminder: 'リマインダー',
  language: '言語',
  theme: 'テーマ',
  sectionData: 'データ',
  rowExport: 'データを書き出す',
  rowImport: 'データを読み込む',
  rowReset: '全データリセット',
  sectionAbout: 'アプリについて',
  developer: 'デベロッパー',
  version: 'バージョン',
  contact: 'お問い合わせ',

  // 書き出し
  exportTitle: 'データを書き出す',
  records: '記録',
  countUnit: (n: number) => `${n} 件`,
  period: '期間',
  fileName: 'ファイル名',
  hiddenIncluded: (n: number) => `※ 画面に表示されていない以前の問いの記録 ${n} 件も含みます`,
  previewHeading: '先頭の例',
  included: '含まれるもの',
  includedBody: '日付・問い・5段階・一言',
  excluded: '含まれないもの',
  excludedBody: 'カスタム顔文字・リマインダー・テーマ・言語',
  exportButton: 'CSVを書き出す',
  exporting: '書き出しています…',
  exportNoRecords: '書き出す記録がありません',
  exportFailed: '書き出せませんでした。もう一度お試しください（記録は変更されていません）',
  exportTooLarge: 'このファイルは 10 MB を超えるため、このアプリでは読み込めません',
  shareDialogTitle: 'CSVファイルを保存・共有',

  // 読み込み
  importTitle: 'データを読み込む',
  importIntro: 'このアプリ（または有料版）で書き出した CSV ファイルから記録を読み込みます。',
  importNote1: '・読み込む前に、内容を確認する画面が出ます',
  importNote2: '・ファイルは変更されません',
  importPick: 'CSVファイルを選ぶ',
  importChecking: 'ファイルを確認しています…',
  importFileFailed: '読み込めませんでした（記録は変更されていません）',
  importFileError: {
    tooLarge: 'ファイルが大きすぎます（上限 10 MB）',
    notUtf8: '文字コードが UTF-8 ではありません',
    empty: 'ファイルが空です',
    unparsable: 'CSV として読み取れません（閉じていない " などがあります）',
    header: '1行目が、このアプリで書き出した形式と違います',
    readFailed: 'ファイルを開けませんでした',
  } as Record<ImportFileError | 'readFailed', string>,
  confirmTitle: '読み込む内容の確認',
  recordCount: '記録件数',
  importCount: '読み込む件数',
  multiQuestion: (n: number, label: string) =>
    `このファイルには問いが ${n} 個あります。1つめの問い「${label}」の記録だけを読み込みます。残りの問いの記録は読み込みません（ファイルは変更されません）。カスタム顔文字は標準の顔文字に戻ります。`,
  labelMismatch: (fileLabel: string, current: string) =>
    `ファイルの問い「${fileLabel}」と、いまの問い「${current}」が違います。記録はいまの問い「${current}」の記録として読み込みます（問いの文言は変わりません）。`,
  noLabel: '（文言なし）',
  invalidRecords: '読み込めない記録',
  invalidLine: (line: number, reason: string) => `${line}行目: ${reason}`,
  invalidReason: {
    columnCount: '値の数が5つではありません',
    dateFormat: '日付の形式が違います（YYYY-MM-DD）',
    dateNotExist: '実在しない日付です',
    dateFuture: '未来の日付です',
    questionNo: 'question_no が1以上の整数ではありません',
    level: 'level が 1〜5 ではありません',
  } as Record<InvalidRecordReason, string>,
  duplicates: '重複している記録',
  duplicatesNote: '（同じ日・同じ問いの記録が重なっていたため、後ろの記録を使います）',
  noFirstQuestion: '1つめの問いの記録がないため読み込めません（記録は変更されていません）',
  noRecords: '読み込める記録がありません（記録は変更されていません）',
  modeHeading: '読み込み方法',
  modeAdd: 'いまの記録に追加',
  modeAddNote: (k: number) => `同じ日の記録はファイルの内容で上書き（${k} 件）`,
  modeReplace: 'すべて置き換える',
  modeReplaceNote: 'いまの記録を全部消して、ファイルの記録にします',
  importButton: '読み込む',
  addConfirmTitle: '記録を読み込みますか？',
  addConfirmBody: (n: number, k: number) => `${n} 件の記録を読み込みます。同じ日の記録はファイルの内容で上書きされます（${k} 件）。`,
  replaceConfirmTitle: '記録を置き換えますか？',
  replaceConfirmBody: (m: number, n: number) =>
    `いまの記録 ${m} 件をすべて削除し、ファイルの ${n} 件に置き換えます。この操作は取り消せません。`,
  replaceConfirmHidden: (x: number) => `（画面に表示されていない以前の問いの記録 ${x} 件を含む）`,
  replaceConfirmOk: '置き換える',
  importing: '読み込んでいます…',

  // 全データリセット
  resetTitle: '全データリセット',
  resetLead: '次のデータを削除します。元に戻せません。',
  resetRecords: (n: number) => `・記録 ${n} 件`,
  resetQuestion: (label: string) => `・問い「${label}」`,
  resetReminder: '・リマインダー設定（予約済みの通知も解除）',
  resetLangTheme: '・言語・テーマ（初期状態に戻る）',
  resetExportFirst: '先にCSVに書き出す',
  resetOk: 'リセットする',
  resetting: 'リセットしています…',
  resetFailed: 'リセットできませんでした。もう一度お試しください（データは変更されていません）',

  // お問い合わせ先
  contactTitle: 'お問い合わせ先',
  contactNoMailApp: 'メールアプリが見つかりませんでした。下のアドレスにメールでお問い合わせください。',
  contactCopy: 'アドレスをコピー',
  contactSubjectExample: '件名の例:',
  appVersionLine: (v: string) => `アプリのバージョン: ${v}`,
  osVersionLine: (v: string) => `OSのバージョン: ${v}`,
}

export type Strings = typeof ja

const en: Strings = {
  cancel: 'Cancel',
  back: 'Back',
  loadFailedTitle: 'Could not load your data',
  loadFailedBody: 'Your saved records could not be loaded. The app has stopped here to protect them. Please restart the app or try again.',
  retry: 'Try again',

  toastRecorded: 'Saved',
  toastSaved: 'Updated',
  toastDeleted: 'Record deleted',
  toastExported: 'CSV file created',
  toastImported: (n) => `Imported ${n} ${n === 1 ? 'record' : 'records'}`,
  toastCopied: 'Copied',

  recoverMessage: "We couldn't load your question settings. Your records are safe. Please enter your question again.",
  recoverStart: 'Start',
  recoverSaveFailed: "Couldn't save. Please try again.",

  onboardingSaveFailed: "Couldn't save. Please try again.",

  homeSaveFailed: "Couldn't save. Please try again.",

  popupRecord: 'Save',
  popupSave: 'Update',
  popupDelete: "Delete this day's record",
  popupSaveFailed: "Couldn't save. Please try again.",
  popupDeleteFailed: "Couldn't delete. Please try again.",
  commentTooLong: (n) => `Notes can be up to 100 characters (currently ${n})`,
  deleteConfirmTitle: "Delete this day's record?",
  deleteConfirmBody: (dateLabel) => `The record for ${dateLabel} (kaomoji and note) will be deleted. This cannot be undone.`,
  deleteConfirmOk: 'Delete',

  settingsTitle: 'Settings',
  sectionRecord: 'Question',
  todaysQuestion: "Today's question",
  sectionKaomoji: 'Kaomoji',
  sectionApp: 'App settings',
  reminder: 'Reminder',
  language: 'Language',
  theme: 'Theme',
  sectionData: 'Data',
  rowExport: 'Export data',
  rowImport: 'Import data',
  rowReset: 'Reset all data',
  sectionAbout: 'About',
  developer: 'Developer',
  version: 'Version',
  contact: 'Contact us',

  exportTitle: 'Export data',
  records: 'Records',
  countUnit: (n) => `${n}`,
  period: 'Period',
  fileName: 'File name',
  hiddenIncluded: (n) => `* Includes ${n} ${n === 1 ? 'record' : 'records'} from earlier questions not shown in the app`,
  previewHeading: 'Preview',
  included: 'Included',
  includedBody: 'Date, question, level (1–5), note',
  excluded: 'Not included',
  excludedBody: 'Custom kaomoji, reminder, theme, language',
  exportButton: 'Export CSV',
  exporting: 'Exporting…',
  exportNoRecords: 'There are no records to export',
  exportFailed: "Couldn't export. Please try again. (Your records have not been changed.)",
  exportTooLarge: 'This file is larger than 10 MB, so it cannot be imported into this app',
  shareDialogTitle: 'Save or share the CSV file',

  importTitle: 'Import data',
  importIntro: 'Import records from a CSV file exported from this app (or the paid version).',
  importNote1: '• You can review the contents before importing',
  importNote2: '• The file will not be changed',
  importPick: 'Choose a CSV file',
  importChecking: 'Checking the file…',
  importFileFailed: "Couldn't import. (Your records have not been changed.)",
  importFileError: {
    tooLarge: 'The file is too large (limit: 10 MB)',
    notUtf8: 'The file is not UTF-8 encoded',
    empty: 'The file is empty',
    unparsable: 'The file cannot be read as CSV (e.g. an unclosed ")',
    header: 'The first line does not match the format exported by this app',
    readFailed: "Couldn't open the file",
  },
  confirmTitle: 'Review import',
  recordCount: 'Records in file',
  importCount: 'Records to import',
  multiQuestion: (n, label) =>
    `This file contains ${n} questions. Only records for the first question "${label}" will be imported. Records for the other questions will not be imported (the file will not be changed). Custom kaomoji will be replaced with the standard set.`,
  labelMismatch: (fileLabel, current) =>
    `The question in the file ("${fileLabel}") is different from your current question ("${current}"). The records will be imported as records for "${current}" (your question will not change).`,
  noLabel: '(no text)',
  invalidRecords: 'Records that cannot be imported',
  invalidLine: (line, reason) => `Line ${line}: ${reason}`,
  invalidReason: {
    columnCount: 'There are not exactly 5 values',
    dateFormat: 'The date format is invalid (YYYY-MM-DD)',
    dateNotExist: 'The date does not exist',
    dateFuture: 'The date is in the future',
    questionNo: 'question_no is not a positive integer',
    level: 'level is not between 1 and 5',
  },
  duplicates: 'Duplicate records',
  duplicatesNote: '(Some records had the same day and question; the later one will be used)',
  noFirstQuestion: "Can't import: there are no records for the first question. (Your records have not been changed.)",
  noRecords: 'There are no records that can be imported. (Your records have not been changed.)',
  modeHeading: 'Import method',
  modeAdd: 'Add to current records',
  modeAddNote: (k) => `Records on the same day will be overwritten by the file (${k})`,
  modeReplace: 'Replace all records',
  modeReplaceNote: 'Delete all current records and use the records in the file',
  importButton: 'Import',
  addConfirmTitle: 'Import records?',
  addConfirmBody: (n, k) => `${n} records will be imported. Records on the same day will be overwritten by the file (${k}).`,
  replaceConfirmTitle: 'Replace records?',
  replaceConfirmBody: (m, n) =>
    `All ${m} current records will be deleted and replaced with the ${n} records in the file. This cannot be undone.`,
  replaceConfirmHidden: (x) => `(Including ${x} records from earlier questions not shown in the app)`,
  replaceConfirmOk: 'Replace',
  importing: 'Importing…',

  resetTitle: 'Reset all data',
  resetLead: 'The following data will be deleted. This cannot be undone.',
  resetRecords: (n) => `• ${n} ${n === 1 ? 'record' : 'records'}`,
  resetQuestion: (label) => `• Question: "${label}"`,
  resetReminder: '• Reminder settings (scheduled notifications will be cancelled)',
  resetLangTheme: '• Language and theme (back to default)',
  resetExportFirst: 'Export to CSV first',
  resetOk: 'Reset',
  resetting: 'Resetting…',
  resetFailed: "Couldn't reset. Please try again. (Your data has not been changed.)",

  contactTitle: 'Contact',
  contactNoMailApp: 'No email app was found. Please contact us by email at the address below.',
  contactCopy: 'Copy address',
  contactSubjectExample: 'Example subject:',
  appVersionLine: (v) => `App version: ${v}`,
  osVersionLine: (v) => `OS version: ${v}`,
}

export const STRINGS: Record<Language, Strings> = { ja, en }

export const t = (language: Language): Strings => STRINGS[language] ?? ja
