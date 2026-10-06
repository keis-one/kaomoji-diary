// Sprint 19a 追補・19b の、ソースを読んで確かめる回帰テスト（画面の構成・呼び出し元の制限）。
// 実機の表示確認の代わりにはならないが、取り違え・再混入を検出する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STRINGS } from '@/i18n/strings'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PAID_FUTURE_DIR = path.join(ROOT, 'src', 'paid-future')
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')
const read = (r: string) => readFileSync(path.join(ROOT, r), 'utf8')
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || p === PAID_FUTURE_DIR) return []
      return listSourceFiles(p)
    }
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
const APP_FILES = [...listSourceFiles(path.join(ROOT, 'app')), ...listSourceFiles(path.join(ROOT, 'src'))]

const filesCalling = (fn: string) =>
  APP_FILES.filter((f) => new RegExp(`\\b${fn}\\s*\\(`).test(stripComments(readFileSync(f, 'utf8'))))
    .map(rel)
    .filter((f) => f !== 'src/store/createDiaryStore.ts') // 定義そのもの
    .sort()

test('A3-5 全記録を削除する処理の呼び出し元は、全データリセットの確定と読み込みの確定だけ', () => {
  assert.deepEqual(filesCalling('resetAllData'), ['app/(tabs)/settings.tsx'])
  assert.deepEqual(filesCalling('importEntries'), ['src/screens/settings/ImportScreen.tsx'])
  // 旧実装の「起動時に全削除」の経路・全通知の一括解除が残っていない
  assert.deepEqual(filesCalling('resetAll'), [])
  assert.deepEqual(filesCalling('cancelAllReminders'), [])
  assert.deepEqual(filesCalling('cancelAllScheduledNotificationsAsync'), [])
  const index = stripComments(read('app/index.tsx'))
  assert.doesNotMatch(index, /resetAllData|importEntries|useEffect/)
})

test('設定画面で resetAllData を呼ぶのは「リセットする」の確定の処理だけ', () => {
  const code = stripComments(read('app/(tabs)/settings.tsx'))
  const calls = code.match(/resetAllData\s*\(/g) ?? []
  assert.equal(calls.length, 1)
  assert.match(code, /const handleReset = async \(\) => \{[\s\S]*?await resetAllData\(\)/)
  assert.match(code, /label: s\.resetOk, onPress: handleReset, kind: 'danger'/)
})

test('通知の解除は、失敗したら解除待ちに入れる共通の処理（cancelNotificationOrQueue）を通す', () => {
  // 通知APIの解除を直接呼ぶのはストアの組み立て（src/store/index.ts）だけ
  const direct = APP_FILES.filter((f) => /\bcancelReminder\b/.test(stripComments(readFileSync(f, 'utf8'))))
    .map(rel)
    .filter((f) => !f.startsWith('src/utils/notifications'))
    .sort()
  assert.deepEqual(direct, ['src/hooks/useReminder.ts', 'src/store/index.ts'])
  const reminder = stripComments(read('src/hooks/useReminder.ts'))
  assert.match(reminder, /const cancelReminder = useDiaryStore\(\(s\) => s\.cancelNotificationOrQueue\)/)
  assert.doesNotMatch(reminder, /from '@\/utils\/notifications'[\s\S]*cancelReminder[\s\S]*\} from/)
})

test('A4 広告は高さ固定の 320×50（BANNER）で、枠の高さは読み込みの状態に関係なく adSlotHeight', () => {
  const code = stripComments(read('src/components/AdBanner.native.tsx'))
  assert.match(code, /size=\{BannerAdSize\.BANNER\}/)
  assert.doesNotMatch(code, /ANCHORED_ADAPTIVE|INLINE_ADAPTIVE|onSizeChange/)
  assert.match(code, /height: adSlotHeight\(slot\)/)
  assert.doesNotMatch(code, /borderTopWidth/, '枠の中に線を描くと広告の下端が切れる')
})

test('設定画面のセクションの順番: 記録の設定 → 顔文字 → アプリ設定 → データ → アプリについて。データは3行', () => {
  const code = stripComments(read('app/(tabs)/settings.tsx'))
  const order = ['s.sectionRecord', 's.sectionKaomoji', 's.sectionApp', 's.sectionData', 's.sectionAbout'].map((k) =>
    code.indexOf(`title={${k}}`),
  )
  assert.ok(order.every((i) => i > 0), 'すべてのセクションがある')
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  const dataStart = order[3]
  const dataSection = code.slice(dataStart, order[4])
  const rows = [...dataSection.matchAll(/label=\{s\.(row\w+)\}/g)].map((m) => m[1])
  assert.deepEqual(rows, ['rowExport', 'rowImport', 'rowReset'])
  const appSection = code.slice(order[2], order[3])
  const appItems = ['s.reminder', 's.language', 's.theme'].map((k) => appSection.indexOf(k))
  assert.ok(appItems.every((i) => i > 0))
  assert.deepEqual([...appItems].sort((a, b) => a - b), appItems)
  const about = code.slice(order[4])
  assert.ok(about.indexOf('s.developer') < about.indexOf('s.version') && about.indexOf('s.version') < about.indexOf('s.contact'))
})

test('日本語・英語の文言がそろっている（設定のセクション名・データの行）', () => {
  assert.equal(STRINGS.ja.sectionRecord, '記録の設定')
  assert.equal(STRINGS.ja.rowExport, 'データを書き出す')
  assert.equal(STRINGS.ja.rowImport, 'データを読み込む')
  assert.equal(STRINGS.ja.rowReset, '全データリセット')
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.ja).sort())
  for (const [k, v] of Object.entries(STRINGS.en)) {
    if (typeof v === 'string') assert.ok(v.length > 0, `en.${k} が空`)
  }
})

test('広告・タブバー: 書き出し・読み込み・お問い合わせ先は設定タブの中に出し、問いの入力し直し・オンボーディングはタブの外', () => {
  const settings = stripComments(read('app/(tabs)/settings.tsx'))
  for (const c of ['<ExportScreen', '<ImportScreen', '<ContactScreen']) assert.ok(settings.includes(c), c)
  assert.ok(existsSync(path.join(ROOT, 'app', 'recover-question.tsx')))
  assert.ok(existsSync(path.join(ROOT, 'app', 'onboarding.tsx')))
  const layout = stripComments(read('app/(tabs)/_layout.tsx'))
  assert.match(layout, /<ToastHost \/>\s*<AdBanner \/>\s*<BottomTabBar/)
})

test('カレンダー: 未来の日は押せず、今日も過去日と同じポップアップを開く（ホームへ移らない）', () => {
  const code = stripComments(read('app/(tabs)/calendar.tsx'))
  assert.match(code, /disabled=\{isFuture\}/)
  assert.doesNotMatch(code, /router|navigate|href/)
})

test('一言の入力欄に maxLength を付けない（長い一言を切り詰めない。U6）', () => {
  for (const f of ['app/(tabs)/index.tsx', 'src/components/DayPopup.tsx']) {
    const code = stripComments(read(f))
    const commentInput = code.slice(code.indexOf('value={comment}') - 300, code.indexOf('value={comment}') + 300)
    assert.doesNotMatch(commentInput, /maxLength/, f)
  }
})

test('app.json の version は 1.2.0（Sprint 19 の 19a 追補・19b 完了で MINOR を上げる）', () => {
  const appJson = JSON.parse(read('app.json'))
  assert.equal(appJson.expo.version, '1.2.0')
})

test('カレンダーのセルは絵文字（DEFAULT_EMOJI_SET）、ポップアップは顔文字', () => {
  const code = stripComments(read('app/(tabs)/calendar.tsx'))
  assert.match(code, /const emojiSet = DEFAULT_EMOJI_SET/)
  assert.match(code, /\{emojiSet\[entry\.level\]\}/)
})
