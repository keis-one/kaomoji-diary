// Node 組み込みテストランナー用の解決フック。
// アプリのコードは Metro/TypeScript 前提の import（`@/xxx` エイリアス・拡張子なし）を使うため、
// Node で直接 .ts を読み込めるよう、これらを実ファイル（.ts / .tsx / index.ts）に解決する。
// 型の除去は Node 24 の組み込み機能（type stripping）に任せる。
// React Native に依存するモジュールは読み込めないため、テスト対象は純粋なロジックに限る。
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC_DIR = fileURLToPath(new URL('../src/', import.meta.url))
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', path.join(path.sep, 'index.ts')]

const findFile = (base) => {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const p = base + suffix
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  let base = null
  if (specifier.startsWith('@/')) {
    base = path.join(SRC_DIR, specifier.slice(2))
  } else if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL?.startsWith('file:')
  ) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
  }
  if (base) {
    const file = findFile(base)
    if (file) return nextResolve(pathToFileURL(file).href, context)
  }
  return nextResolve(specifier, context)
}
