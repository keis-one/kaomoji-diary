/**
 * 大きな文字列を、保存先（AsyncStorage）の複数のキーに分けて「まとめて1回で」保存・読み込みする。
 *
 * Why: Android の AsyncStorage は 1 つの値が約 2 MB を超えると読み込みに失敗することがある
 * （SQLite の CursorWindow の上限）。読み込み（F53）で大きな CSV を取り込むと保存データが
 * これを超え得るため、一定の長さで分けて保存する。
 *
 * - 小さい値: 従来どおり 1 つのキーにそのまま保存する（旧バージョンの保存データと同じ形）
 * - 大きい値: 先頭のキーに目印（{"__chunked":N}）、`<key>__chunk_0` 〜 `<key>__chunk_{N-1}` に本体。
 *   目印と本体は multiSet で1回にまとめて書く（Android の実装は1つのトランザクションで書き込むため、
 *   途中まで書かれた状態は残らない）
 * - 不要になった本体（分割の数が減った・分割しなくなった・リセットした）は、新しい状態の書き込みに
 *   成功した後で消す。消す前にアプリが終了しても、目印が指さない本体は読まれないので有効な状態は
 *   変わらず、次の起動（readValueInfo の後の removeStaleChunks）で消す
 */

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  multiGet: (keys: string[]) => Promise<readonly (readonly [string, string | null])[]>
  multiSet: (pairs: [string, string][]) => Promise<void>
  getAllKeys: () => Promise<readonly string[]>
  multiRemove: (keys: string[]) => Promise<void>
}

/** 1つのキーに入れる文字数の上限（UTF-8 で最大 3 バイト／文字 → 約 0.9 MB） */
export const DEFAULT_CHUNK_CHARS = 300_000

const MANIFEST_PREFIX = '{"__chunked":'
const chunkPrefix = (key: string) => `${key}__chunk_`
export const chunkKey = (key: string, i: number) => `${chunkPrefix(key)}${i}`

/**
 * いまの目印が指していない本体（`<key>__chunk_<n>` で n が keepCount 以上）を消す。
 * 消せなくても有効な状態には影響しないので、失敗は呼び出し側で無視してよい。
 */
export const removeStaleChunks = async (storage: KeyValueStorage, key: string, keepCount: number): Promise<void> => {
  const prefix = chunkPrefix(key)
  const stale = (await storage.getAllKeys()).filter((k) => {
    if (!k.startsWith(prefix)) return false
    const n = Number(k.slice(prefix.length))
    return !Number.isInteger(n) || n >= keepCount
  })
  if (stale.length > 0) await storage.multiRemove(stale)
}

/** サロゲートペアの途中で切らないように分ける */
export const splitIntoChunks = (value: string, chunkChars: number): string[] => {
  const chunks: string[] = []
  let i = 0
  while (i < value.length) {
    let end = Math.min(i + chunkChars, value.length)
    if (end < value.length) {
      const c = value.charCodeAt(end - 1)
      if (c >= 0xd800 && c <= 0xdbff) end -= 1 // 上位サロゲートで終わる → 1文字手前で切る
      if (end === i) end = i + 2 // chunkChars が 1 のとき、ペアを丸ごと入れる（止まらないように）
    }
    chunks.push(value.slice(i, end))
    i = end
  }
  return chunks
}

export const writeValue = async (
  storage: KeyValueStorage,
  key: string,
  value: string,
  chunkChars: number = DEFAULT_CHUNK_CHARS,
): Promise<void> => {
  let keepCount = 0
  if (value.length <= chunkChars) {
    await storage.setItem(key, value)
  } else {
    const chunks = splitIntoChunks(value, chunkChars)
    const pairs: [string, string][] = [
      [key, `${MANIFEST_PREFIX}${chunks.length}}`],
      ...chunks.map((c, i): [string, string] => [chunkKey(key, i), c]),
    ]
    await storage.multiSet(pairs)
    keepCount = chunks.length
  }
  // 新しい状態の書き込みに成功してから、使わなくなった本体を消す（失敗しても次の起動で消す）
  await removeStaleChunks(storage, key, keepCount).catch(() => undefined)
}

/** 保存されている値（分けて保存していればつなげたもの）。無ければ null。本体が欠けていたら例外 */
export const readValue = async (storage: KeyValueStorage, key: string): Promise<string | null> =>
  (await readValueInfo(storage, key)).value

/** 値と、目印が指している本体の数（分けていなければ 0） */
export const readValueInfo = async (
  storage: KeyValueStorage,
  key: string,
): Promise<{ value: string | null; chunkCount: number }> => {
  const head = await storage.getItem(key)
  if (head === null || !head.startsWith(MANIFEST_PREFIX)) return { value: head, chunkCount: 0 }
  const count = (JSON.parse(head) as { __chunked: number }).__chunked
  const keys = Array.from({ length: count }, (_, i) => chunkKey(key, i))
  const rows = await storage.multiGet(keys)
  const byKey = new Map(rows.map(([k, v]) => [k, v]))
  const parts = keys.map((k) => byKey.get(k))
  if (parts.some((p) => typeof p !== 'string')) throw new Error('分けて保存したデータの一部が見つからない')
  return { value: (parts as string[]).join(''), chunkCount: count }
}
