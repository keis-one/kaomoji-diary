import { useDiaryStore } from '@/store'

/**
 * 保存データの読み込みが終わったか。
 * 以前は「1秒で読み込みが終わらなければ先に進む」逃げ道があったが、読み込み前に進むと
 * オンボーディング等で保存データを上書きするおそれがあるため、読み込みが終わるまで待つ。
 */
export const useHydration = (): { hydrated: boolean; hydrationError: boolean } => {
  const hydrated = useDiaryStore((s) => s.hydrated)
  const hydrationError = useDiaryStore((s) => s.hydrationError)
  return { hydrated, hydrationError }
}
