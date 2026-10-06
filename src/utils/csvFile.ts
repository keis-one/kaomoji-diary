/**
 * Web 版の CSV ファイルの書き出し・読み込み（Web は確認用。公開対象は Android）。
 * 書き出しはブラウザのダウンロード、読み込みはブラウザのファイル選択を使う。
 */
import * as DocumentPicker from 'expo-document-picker'
import { encodeUtf8 } from '@/domain/csv/utf8'

export const canDistinguishShareResult = false

export const writeCsvFile = async (fileName: string, csv: string): Promise<string> => {
  const blob = new Blob([encodeUtf8(csv) as BlobPart], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  return `${url}#${encodeURIComponent(fileName)}`
}

export const shareCsvFile = async (uri: string, _dialogTitle: string): Promise<void> => {
  const [url, name] = uri.split('#')
  const a = document.createElement('a')
  a.href = url
  a.download = decodeURIComponent(name ?? 'kaomoji-diary.csv')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface PickedFile {
  name: string
  size: number | undefined
  read: () => Promise<Uint8Array>
}

export const pickCsvFile = async (): Promise<PickedFile | null> => {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false })
  if (result.canceled || !result.assets || result.assets.length === 0) return null
  const asset = result.assets[0]
  const file = asset.file
  return {
    name: asset.name,
    size: typeof asset.size === 'number' ? asset.size : undefined,
    read: async () => {
      if (file) return new Uint8Array(await file.arrayBuffer())
      const res = await fetch(asset.uri)
      return new Uint8Array(await res.arrayBuffer())
    },
  }
}
