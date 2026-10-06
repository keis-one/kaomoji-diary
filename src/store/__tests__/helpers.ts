// ストアのテスト用の模擬（保存先と通知API）。実際のストア（createDiaryStore）と組み合わせて使う。
import { DEFAULT_KAOMOJI_SET } from '@/constants/kaomoji'
import type { DiaryEntry, Question } from '@/types'
import { createDiaryStore, STORAGE_KEY, type DiaryStore } from '../createDiaryStore'

/** メモリ上の保存先。failWrites / failReads で失敗を起こせる */
export class MemoryStorage {
  data = new Map<string, string>()
  failWrites = false
  failReads = false
  writeCount = 0
  async getItem(key: string): Promise<string | null> {
    if (this.failReads) throw new Error('read failed')
    return this.data.get(key) ?? null
  }
  async setItem(key: string, value: string): Promise<void> {
    if (this.failWrites) throw new Error('write failed')
    this.writeCount++
    this.data.set(key, value)
  }
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    if (this.failReads) throw new Error('read failed')
    return keys.map((k) => [k, this.data.get(k) ?? null])
  }
  /** まとめて書く。失敗するときは1件も書かない（Android の AsyncStorage と同じ） */
  async multiSet(pairs: [string, string][]): Promise<void> {
    if (this.failWrites) throw new Error('write failed')
    this.writeCount++
    for (const [k, v] of pairs) this.data.set(k, v)
  }
  /** 保存データの state 部分（分けて保存していればつなげて読む） */
  stored(): any {
    let raw = this.data.get(STORAGE_KEY)
    if (raw?.startsWith('{"__chunked":')) {
      const n = JSON.parse(raw).__chunked
      raw = Array.from({ length: n }, (_, i) => this.data.get(`${STORAGE_KEY}__chunk_${i}`)).join('')
    }
    return raw ? JSON.parse(raw).state : null
  }
  putState(state: unknown): void {
    this.data.set(STORAGE_KEY, JSON.stringify({ state, version: 0 }))
  }
}

/** 予約済みの通知を持つ通知APIの模擬。failCancel に入れた ID は解除に失敗する */
export class MockNotifier {
  scheduled = new Set<string>()
  failCancel = new Set<string>()
  failAllCancels = false
  failList = false
  cancelCalls: string[] = []
  async cancel(id: string): Promise<void> {
    this.cancelCalls.push(id)
    if (this.failAllCancels || this.failCancel.has(id)) throw new Error(`cancel failed: ${id}`)
    this.scheduled.delete(id)
  }
  async listScheduledIds(): Promise<string[]> {
    if (this.failList) throw new Error('list failed')
    return [...this.scheduled]
  }
  schedule(id: string): void {
    this.scheduled.add(id)
  }
  callsFor(id: string): number {
    return this.cancelCalls.filter((c) => c === id).length
  }
}

let questionSeq = 0
export const testQuestionFactory = (label: string): Question => ({
  id: `q_new_${++questionSeq}`,
  label,
  kaomojiSet: { ...DEFAULT_KAOMOJI_SET },
  reminderEnabled: false,
  reminderTime: '21:00',
})

/** 保存データから読み込んだストア（アプリの起動に当たる） */
export const boot = async (storage: MemoryStorage, notifier: MockNotifier, chunkChars?: number): Promise<DiaryStore> => {
  const store = createDiaryStore({ storage, notifier, createQuestion: testQuestionFactory, chunkChars })
  await store.getState().hydrate()
  return store
}

export const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  label: `label-${id}`,
  kaomojiSet: { ...DEFAULT_KAOMOJI_SET },
  reminderEnabled: false,
  reminderTime: '21:00',
  ...extra,
})

export const entry = (date: string, questionId: string, level: 1 | 2 | 3 | 4 | 5 = 3, comment = ''): DiaryEntry => ({
  date,
  questionId,
  level,
  comment,
})

/** 通常の無料版の保存データ（問い q1 1つ） */
export const freeState = (entries: DiaryEntry[], extra: Record<string, unknown> = {}) => ({
  entries,
  settings: { questions: [q('q1', { label: '禁煙' })], activeQuestionId: 'q1', language: 'ja', theme: 'system' },
  isOnboardingDone: true,
  ...extra,
})

export const sortEntries = (es: DiaryEntry[]) =>
  [...es].sort((a, b) => (a.date + a.questionId < b.date + b.questionId ? -1 : 1))
