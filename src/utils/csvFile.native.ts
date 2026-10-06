/**
 * CSV ファイルの書き出し（Android の共有画面）と読み込み（Android のファイル選択画面）。
 *
 * 書き出し: アプリのキャッシュ領域にファイルを作り、expo-sharing で共有画面を開く。保存先はアプリで決めない。
 * 共有画面の結果について: expo-sharing の shareAsync は Promise<void> で、Android では共有画面
 * （Intent.createChooser を startActivityForResult で開く）から戻ったときに結果に関係なく解決する
 * （node_modules/expo-sharing/android/.../SharingModule.kt の OnActivityResult）。そのため「共有した」と
 * 「キャンセルした」をアプリは区別できない。
 */
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { encodeUtf8 } from '@/domain/csv/utf8'

export const canDistinguishShareResult = false

/** CSV（文字列。BOM を含む）をファイルにする。作ったファイルの URI を返す */
export const writeCsvFile = async (fileName: string, csv: string): Promise<string> => {
  const file = new File(Paths.cache, fileName)
  if (file.exists) file.delete()
  file.create()
  file.write(encodeUtf8(csv)) // バイト列で書き、BOM・CRLF をそのまま残す
  return file.uri
}

/** 共有画面を開き、閉じるまで待つ */
export const shareCsvFile = async (uri: string, dialogTitle: string): Promise<void> => {
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle, UTI: 'public.comma-separated-values-text' })
}

export interface PickedFile {
  name: string
  /** 端末が知らせたファイルの大きさ（バイト）。分からなければ undefined */
  size: number | undefined
  read: () => Promise<Uint8Array>
}

/** ファイル選択画面を開く。キャンセルしたら null */
export const pickCsvFile = async (): Promise<PickedFile | null> => {
  // CSV の MIME タイプは端末・ファイルアプリでまちまち（text/csv・text/comma-separated-values・
  // application/octet-stream 等）なため、種類では絞らず、中身で判定する
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false })
  if (result.canceled || !result.assets || result.assets.length === 0) return null
  const asset = result.assets[0]
  return {
    name: asset.name,
    size: typeof asset.size === 'number' ? asset.size : undefined,
    read: () => new File(asset.uri).bytes(),
  }
}
