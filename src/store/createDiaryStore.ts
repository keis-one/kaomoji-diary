/**
 * 記録・設定のストア本体（React Native に依存しない。保存先と通知は外から渡す）。
 *
 * Sprint 19b で zustand の persist ミドルウェアをやめ、保存を自前で行う形にした。理由:
 * persist は保存の失敗を呼び出し側に返さないため、仕様の「保存に失敗したらメモリも保存データも
 * 操作前のまま・失敗を表示する」「読み込み・全データリセットは全部反映か何も反映しないか」を満たせない。
 *
 * 保存の方式:
 * - 状態は1つのキーに JSON でまとめて保存する（1回の書き込みで全体が置き換わる）
 * - 書き込みは1本の列に並べて順番に行う（同時に走って古い内容で上書きしない）
 * - commit（記録の保存・削除・読み込み・リセット・オンボーディング・問いの作り直し）:
 *   次の状態を作って先に保存し、成功したときだけメモリに反映する。失敗したら例外を投げ、何も変えない
 * - 設定の小さな変更（言語・テーマ・問いの文言・リマインダー）: すぐメモリに反映し、続けて保存する
 *   （入力欄の表示を待たせないため。保存に失敗しても次の保存で全体が書かれる）
 */
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DiaryEntry, KaomojiLevel, Language, Question, UserSettings } from '@/types'
import { createDefaultQuestion } from '@/constants/app'
import { removeEntry, upsertEntry, pickRecoveryQuestionId } from '@/domain/entries'
import { applyImport, type ImportMode, type ImportRecord } from '@/domain/csv/importer'
import {
  createInitialData,
  currentNotificationIds,
  normalizePersisted,
  PERSISTED_KEYS,
  pickPersisted,
  serializePersisted,
  unwrapStoredJson,
  type PersistedData,
} from './persisted'
import { readValueInfo, removeStaleChunks, writeValue, type KeyValueStorage } from './chunkedStorage'

export const STORAGE_KEY = 'diary_entries'
/** 保存データが JSON として読めなかったときに、元の文字列を退避するキー */
export const CORRUPT_BACKUP_KEY = 'diary_entries_unreadable_backup'

export type { KeyValueStorage } from './chunkedStorage'

export interface Notifier {
  /** 予約済みの通知を1つ解除する。対象が既に無い場合もエラーなく終わる（成功） */
  cancel: (id: string) => Promise<void>
  /** アプリが予約している通知の ID の一覧 */
  listScheduledIds: () => Promise<string[]>
}

export interface DiaryStoreDeps {
  storage: KeyValueStorage
  notifier: Notifier
  createQuestion?: (label: string) => Question
  /** 1つのキーに入れる文字数の上限（テストで小さくする） */
  chunkChars?: number
}

export class StorageWriteError extends Error {
  constructor(cause: unknown) {
    super(`保存できませんでした: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'StorageWriteError'
  }
}

export interface DiaryState extends PersistedData {
  /** 保存データの読み込みが終わったか */
  hydrated: boolean
  /** 保存先から読み込めなかった（読み込みの例外）。記録を上書きしないよう、どの画面にも進まない */
  hydrationError: boolean

  hydrate: () => Promise<void>

  // ── 記録（保存に成功したときだけ反映。失敗は例外） ──
  saveEntry: (date: string, questionId: string, level: KaomojiLevel, comment: string) => Promise<void>
  deleteEntry: (date: string, questionId: string) => Promise<void>
  /** 読み込み（F53）。「すべて置き換える」は全記録を削除する2つの呼び出し元の1つ */
  importEntries: (records: ImportRecord[], mode: ImportMode) => Promise<void>
  /** 全データリセット（F52）。全記録を削除する2つの呼び出し元の1つ */
  resetAllData: () => Promise<void>

  // ── オンボーディング・問いの作り直し ──
  completeOnboarding: (
    label: string,
    language?: Language,
    reminderEnabled?: boolean,
    reminderTime?: string,
  ) => Promise<void>
  /** A3: 問いの設定が使えないときに問いを作り直す（記録の最も新しい問いIDを引き継ぐ。リマインダーは OFF） */
  recoverQuestion: (label: string) => Promise<void>

  // ── 設定（すぐ反映して保存） ──
  updateQuestion: (id: string, partial: Partial<Omit<Question, 'id' | 'kaomojiSet'>>) => void
  updateSettings: (partial: Partial<Omit<UserSettings, 'questions'>>) => void

  // ── 通知 ──
  /** 通知を解除する。失敗したら解除待ちの一覧に入れ、次回以降の起動で再試行する */
  cancelNotificationOrQueue: (id: string) => Promise<void>
  /** 解除待ちの通知の解除と、通知の整理（A1・A3）。起動のたびに呼ぶ */
  processNotificationMaintenance: () => Promise<void>
  /** 並んでいる書き込みがすべて終わるまで待つ */
  flushWrites: () => Promise<void>

  // ── 通知の予約（予約・整理・リセットの順番と世代をストアで管理する） ──
  /**
   * 通知の操作の世代。全データリセットのたびに 1 増える。
   * 操作を始めた時点の世代を覚えておき、終わった時点で変わっていたら（＝途中でリセットされたら）結果を捨てる。
   */
  getNotificationEpoch: () => number
  /**
   * 問いのリマインダーを予約する（ON・時刻変更・オンボーディング）。
   * 通知の整理（A3）と同じ列に並べて1つずつ行うので、予約した通知の ID がストアに入る前に
   * 整理で消されることはない。予約し終えた時点で、操作を始めた後にリセットされていた・問いが無くなった・
   * isLatest() が false（後から別の操作が入った）なら、予約した通知を解除して結果を捨てる。
   */
  scheduleQuestionReminder: (
    questionId: string,
    schedule: (q: Question) => Promise<string | undefined>,
    opts?: { epoch?: number; reminderTime?: string; isLatest?: () => boolean },
  ) => Promise<'scheduled' | 'discarded' | 'notScheduled'>
  /** 問いのリマインダーを OFF にする（通知の解除は失敗したら解除待ちへ） */
  disableQuestionReminder: (questionId: string, opts?: { epoch?: number; isLatest?: () => boolean }) => Promise<void>
}

export type DiaryStore = StoreApi<DiaryState>

export const createDiaryStore = (deps: DiaryStoreDeps): DiaryStore => {
  const { storage, notifier } = deps
  const makeQuestion = deps.createQuestion ?? createDefaultQuestion

  let writeChain: Promise<unknown> = Promise.resolve()
  // 通知の予約と整理を1つずつ行う列（保存の列とは別）
  let notificationChain: Promise<unknown> = Promise.resolve()
  const runNotificationTask = <T>(task: () => Promise<T>): Promise<T> => {
    const run = notificationChain.then(task, task)
    notificationChain = run.catch(() => undefined)
    return run
  }
  let notificationEpoch = 0
  /** 書き込みを1本の列に並べる */
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = writeChain.then(task, task)
    writeChain = run.catch(() => undefined)
    return run
  }

  const write = async (data: PersistedData): Promise<void> => {
    try {
      await writeValue(storage, STORAGE_KEY, serializePersisted(data), deps.chunkChars)
    } catch (e) {
      throw new StorageWriteError(e)
    }
  }

  return createStore<DiaryState>()((set, get) => {

    /**
     * 次の状態を作って先に保存し、成功したときだけメモリに反映する。
     * 保存中にほかの変更がメモリに入った場合は、その変更の上にもう一度 update を当てる。
     */
    const commit = (update: (s: PersistedData) => PersistedData, onCommitted?: () => void): Promise<void> => {
      if (!get().hydrated) return Promise.reject(new Error('保存データの読み込み前は保存しない'))
      return enqueue(async () => {
        const base = pickPersisted(get())
        const next = update(base)
        await write(next)
        const latest = pickPersisted(get())
        const sameBase = PERSISTED_KEYS.every((k) => latest[k] === base[k])
        set(sameBase ? next : update(latest))
        onCommitted?.() // メモリに反映したのと同じ同期処理の中で行う（間に別の処理が入らない）
      })
    }

    /** すぐメモリに反映し、続けて保存する（保存の失敗は次の保存で取り戻す） */
    const applyNow = (update: (s: PersistedData) => PersistedData): void => {
      if (!get().hydrated) return
      set(update(pickPersisted(get())))
      void enqueue(() => write(pickPersisted(get()))).catch(() => undefined)
    }

    return {
      ...createInitialData(),
      hydrated: false,
      hydrationError: false,

      hydrate: async () => {
        let raw: string | null
        try {
          const info = await readValueInfo(storage, STORAGE_KEY)
          raw = info.value
          // 前回、書き込みの後に消しそこねた本体があれば消す（有効な状態には影響しない）
          await removeStaleChunks(storage, STORAGE_KEY, info.chunkCount).catch(() => undefined)
        } catch {
          set({ hydrationError: true })
          return
        }
        let stored: unknown = null
        if (raw !== null) {
          try {
            stored = unwrapStoredJson(raw)
          } catch {
            // JSON として読めない保存データ。元の文字列を退避してから初期状態で始める
            await storage.setItem(CORRUPT_BACKUP_KEY, raw).catch(() => undefined)
            stored = null
          }
        }
        const data = stored === null ? createInitialData() : normalizePersisted(stored)
        set({ ...data, hydrated: true, hydrationError: false })

        // 読み込み時に整えた内容（解除待ちの通知ID・外した問い・整理待ちの印）を先に保存してから通知を処理する
        const storedData = isObjectLike(stored) ? (stored as Partial<PersistedData>) : null
        if (stored !== null && !PERSISTED_EQUAL(data, storedData)) {
          await enqueue(() => write(pickPersisted(get()))).catch(() => undefined)
        }
        await get().processNotificationMaintenance()
      },

      saveEntry: (date, questionId, level, comment) =>
        commit((s) => ({ ...s, entries: upsertEntry(s.entries, date, questionId, level, comment) })),

      deleteEntry: (date, questionId) =>
        commit((s) => ({ ...s, entries: removeEntry(s.entries, date, questionId) })),

      importEntries: (records, mode) => {
        const questionId = get().settings.activeQuestionId
        if (!questionId) return Promise.reject(new Error('いまの問いが無い'))
        return commit((s) => ({ ...s, entries: applyImport(s.entries, records, questionId, mode) }))
      },

      resetAllData: async () => {
        await commit((s) => ({
          ...createInitialData(),
          // リセット前の通知（いまの問いの通知と解除待ちの通知）を解除待ちに入れる。リセット後に作る通知は含まない
          pendingNotificationCancelIds: [...new Set([...s.pendingNotificationCancelIds, ...currentNotificationIds(s)])],
          notificationCleanupPending: s.notificationCleanupPending,
        }), () => {
          // リセット前に始まった通知の予約は、終わった時点で結果を捨てる（予約した通知は解除する）
          notificationEpoch++
        })
        // 保存に成功してから解除する。解除に失敗しても、リセットは取り消さない（次回以降の起動で再試行）
        await get().processNotificationMaintenance()
      },

      completeOnboarding: (label, language, reminderEnabled, reminderTime) => {
        const q = makeQuestion(label)
        if (reminderEnabled !== undefined) q.reminderEnabled = reminderEnabled
        if (reminderTime) q.reminderTime = reminderTime
        return commit((s) => ({
          ...s,
          isOnboardingDone: true,
          settings: { ...s.settings, ...(language ? { language } : {}), questions: [q], activeQuestionId: q.id },
          retiredQuestions: s.retiredQuestions.filter((r) => r.id !== q.id),
        }))
      },

      recoverQuestion: (label) =>
        commit((s) => {
          const inheritedId = pickRecoveryQuestionId(s.entries)
          const fresh = makeQuestion(label)
          const q: Question = {
            ...fresh,
            id: inheritedId ?? fresh.id,
            reminderEnabled: false,
            notificationId: undefined,
          }
          return {
            ...s,
            isOnboardingDone: true,
            settings: { ...s.settings, questions: [q], activeQuestionId: q.id },
            retiredQuestions: s.retiredQuestions.filter((r) => r.id !== q.id),
          }
        }),

      updateQuestion: (id, partial) =>
        applyNow((s) => ({
          ...s,
          settings: {
            ...s.settings,
            questions: s.settings.questions.map((q) => (q.id === id ? { ...q, ...partial } : q)),
          },
        })),

      updateSettings: (partial) => applyNow((s) => ({ ...s, settings: { ...s.settings, ...partial } })),

      cancelNotificationOrQueue: async (id) => {
        try {
          await notifier.cancel(id)
        } catch {
          applyNow((s) =>
            s.pendingNotificationCancelIds.includes(id)
              ? s
              : { ...s, pendingNotificationCancelIds: [...s.pendingNotificationCancelIds, id] },
          )
        }
      },

      flushWrites: () => enqueue(async () => undefined),

      getNotificationEpoch: () => notificationEpoch,

      scheduleQuestionReminder: (questionId, schedule, opts = {}) => {
        const epoch = opts.epoch ?? notificationEpoch
        return runNotificationTask(async () => {
          const isStale = () =>
            epoch !== notificationEpoch ||
            !get().settings.questions.some((q) => q.id === questionId) ||
            (opts.isLatest ? !opts.isLatest() : false)
          if (isStale()) return 'discarded' as const
          const question = get().settings.questions.find((q) => q.id === questionId) as Question
          if (question.notificationId) await get().cancelNotificationOrQueue(question.notificationId)
          const target: Question = opts.reminderTime ? { ...question, reminderTime: opts.reminderTime } : question
          const id = await schedule(target)
          if (isStale()) {
            if (id) await get().cancelNotificationOrQueue(id)
            // 古い ID は上で解除済み。問いが残っていれば ID を外しておく（ON のまま ID 無しにはしない）
            if (get().settings.questions.some((q) => q.id === questionId && q.notificationId === question.notificationId && question.notificationId)) {
              get().updateQuestion(questionId, { notificationId: undefined })
            }
            return 'discarded' as const
          }
          if (!id) {
            if (question.notificationId) get().updateQuestion(questionId, { notificationId: undefined })
            return 'notScheduled' as const
          }
          get().updateQuestion(questionId, {
            reminderEnabled: true,
            notificationId: id,
            ...(opts.reminderTime ? { reminderTime: opts.reminderTime } : {}),
          })
          return 'scheduled' as const
        })
      },

      disableQuestionReminder: (questionId, opts = {}) => {
        const epoch = opts.epoch ?? notificationEpoch
        return runNotificationTask(async () => {
          const question = get().settings.questions.find((q) => q.id === questionId)
          if (!question) return
          if (question.notificationId) await get().cancelNotificationOrQueue(question.notificationId)
          if (epoch !== notificationEpoch || (opts.isLatest && !opts.isLatest())) {
            // 後から別の操作（ON・リセット）が入った → 状態はその操作に任せる。解除した ID だけ外す
            const cur = get().settings.questions.find((q) => q.id === questionId)
            if (cur && cur.notificationId === question.notificationId && question.notificationId) {
              get().updateQuestion(questionId, { notificationId: undefined })
            }
            return
          }
          get().updateQuestion(questionId, { reminderEnabled: false, notificationId: undefined })
        })
      },

      processNotificationMaintenance: async () => {
        if (!get().hydrated) return
        const cancelled = new Set<string>()
        for (const id of [...get().pendingNotificationCancelIds]) {
          try {
            await notifier.cancel(id)
            cancelled.add(id)
          } catch {
            // 一覧に残し、次回以降の起動で再試行する
          }
        }

        let cleanupDone = false
        if (get().notificationCleanupPending) {
          // 通知の予約と同じ列で行う: 予約の途中（ID がまだストアに入っていない通知）を消さないように、
          // 予約が終わってから一覧を取り、終わるまで次の予約を始めない
          cleanupDone = await runNotificationTask(async () => {
            try {
              const scheduled = await notifier.listScheduledIds()
              for (const id of scheduled) {
                if (currentNotificationIds(get()).includes(id)) continue
                await notifier.cancel(id)
              }
              return true
            } catch {
              return false // 印を残し、次回以降の起動で再試行する
            }
          })
        }

        if (cancelled.size === 0 && !cleanupDone) return
        applyNow((s) => ({
          ...s,
          pendingNotificationCancelIds: s.pendingNotificationCancelIds.filter((id) => !cancelled.has(id)),
          notificationCleanupPending: cleanupDone ? false : s.notificationCleanupPending,
        }))
        // 解除の結果を保存し終えるまで待つ（テスト・起動直後の再読み込みで結果が揃うように）
        await enqueue(async () => undefined)
      },
    }
  })
}

const isObjectLike = (v: unknown): boolean => !!v && typeof v === 'object'

/** 保存する部分が同じか（JSON にしたときの比較。読み込み時に1回だけ使う） */
const PERSISTED_EQUAL = (a: Partial<PersistedData> | null, b: Partial<PersistedData> | null): boolean => {
  if (!a || !b) return a === b
  return serializePersisted(a as PersistedData) === serializePersisted(b as PersistedData)
}

/** 保存データから問いを作り直す必要があるか（A3）。画面の振り分けに使う */
export { needsQuestionRecovery } from './persisted'
export type { DiaryEntry }
