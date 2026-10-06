// 無料版アプリの画面・ビルド設定に、プレミアム関連の表示・導線・開発用トグルが
// 残っていないことをソースから確認する回帰テスト（Sprint 19a）。
// 実機の表示確認の代わりにはならないが、消し忘れ・再混入を検出する。
// 実行: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PAID_FUTURE_DIR = path.join(ROOT, 'src', 'paid-future')

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || p === PAID_FUTURE_DIR) return []
      return listSourceFiles(p)
    }
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })

// 無料版アプリに含まれる画面・ロジック（有料版の将来仕様のコードとテストは除く）
const FREE_APP_FILES = [...listSourceFiles(path.join(ROOT, 'app')), ...listSourceFiles(path.join(ROOT, 'src'))]

// コメントを除いたコード（説明用のコメントに「プレミアム」等が出てくるのは許す）
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')

test('無料版のファイルが見つかる（テスト自体の前提確認）', () => {
  assert.ok(FREE_APP_FILES.some((f) => rel(f) === 'app/(tabs)/settings.tsx'))
  assert.ok(!FREE_APP_FILES.some((f) => rel(f).startsWith('src/paid-future/')))
})

test('タブの画面ファイルはホーム / カレンダー / 設定の3つだけ（グラフ画面なし）', () => {
  // expo-router は app/(tabs)/ 配下のファイルを自動でタブにするため、ファイルの有無で確認する
  const files = readdirSync(path.join(ROOT, 'app', '(tabs)')).sort()
  assert.deepEqual(files, ['_layout.tsx', 'calendar.tsx', 'index.tsx', 'settings.tsx'])
})

test('タブバーに登録する画面は index / calendar / settings の順の3つ', () => {
  const layout = readFileSync(path.join(ROOT, 'app', '(tabs)', '_layout.tsx'), 'utf8')
  const names = [...stripComments(layout).matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(names, ['index', 'calendar', 'settings'])
})

test('無料版の画面・ロジックにプレミアム・アップグレード・開発用トグルの表示が無い', () => {
  const FORBIDDEN = [
    'プレミアム',
    'premium',
    'アップグレード',
    'upgrade',
    '👑',
    '🔒',
    '[DEV]',
    'EXPO_PUBLIC_ENABLE_DEV_TOOLS',
  ]
  const hits: string[] = []
  for (const file of FREE_APP_FILES) {
    const code = stripComments(readFileSync(file, 'utf8')).toLowerCase()
    for (const word of FORBIDDEN) {
      if (code.includes(word.toLowerCase())) hits.push(`${rel(file)}: ${word}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('無料版のコードは有料版の将来仕様のコード（src/paid-future）を読み込まない', () => {
  const hits = FREE_APP_FILES.filter((f) => /paid-future/.test(stripComments(readFileSync(f, 'utf8')))).map(rel)
  assert.deepEqual(hits, [])
})

test('設定画面に問いの追加・削除・切り替え・顔文字カスタムの導線が無い', () => {
  const code = stripComments(readFileSync(path.join(ROOT, 'app', '(tabs)', 'settings.tsx'), 'utf8'))
  for (const word of ['addQuestion', 'removeQuestion', 'setActiveQuestion', 'KaomojiEditor', 'カスタム', 'Custom']) {
    assert.equal(code.includes(word), false, `settings.tsx に ${word} が残っている`)
  }
})

test('eas.json: ストア配布用（production）ビルドで開発用ツールを有効にする設定が無い', () => {
  const eas = JSON.parse(readFileSync(path.join(ROOT, 'eas.json'), 'utf8'))
  const production = eas.build?.production
  assert.ok(production, 'production プロファイルがある')
  assert.equal(production.developmentClient, undefined)
  assert.equal(production.env?.EXPO_PUBLIC_ENABLE_DEV_TOOLS, undefined)
  // 他のプロファイルを extends していない（継承で env が入らない）
  assert.equal(production.extends, undefined)
  assert.equal(production.android?.buildType, 'app-bundle')
})
