/**
 * ホームで保存した後の流れ（カレンダー → スタンプ → 保存しましたシート）のアプリ全体で 1 つの実体。
 * 手順と取り消しの規則は src/domain/savedFlow.ts。
 */
import { createSavedFlow } from '@/domain/savedFlow'

export const savedFlow = createSavedFlow({
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
})
