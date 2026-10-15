// Sprint 19c（ストア申請の準備）の回帰テスト: version 2.0.0・versionCode の EAS remote 管理・
// 設定「アプリについて」のプライバシーポリシーの行（製品仕様 U9）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STRINGS } from '@/i18n/strings'
import { PRIVACY_POLICY_URL, openPrivacyPolicy } from '@/domain/privacyPolicy'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (r: string) => readFileSync(path.join(ROOT, r), 'utf8')
const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/')
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : listSourceFiles(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })

// ── version・versionCode ─────────────────────────────

test('app.json の version は 2.0.0（MAJOR = ストア申請）で、android.versionCode を固定で持たない（EAS の remote 管理）', () => {
  const appJson = JSON.parse(read('app.json'))
  assert.equal(appJson.expo.version, '2.0.0')
  assert.equal(appJson.expo.android?.versionCode, undefined)
  assert.equal(appJson.expo.ios?.buildNumber, undefined)
})

test('eas.json: versionCode は EAS の remote 管理、production だけ自動で加算する', () => {
  const eas = JSON.parse(read('eas.json'))
  assert.equal(eas.cli.appVersionSource, 'remote')
  assert.equal(eas.build.production.autoIncrement, true)
  // ストアに出す production は AAB のまま。preview（APK）は自動加算しない（ストアに出さない）
  assert.equal(eas.build.production.android.buildType, 'app-bundle')
  assert.equal(eas.build.preview.autoIncrement, undefined)
  assert.equal(eas.build.preview.android?.autoIncrement, undefined)
})

// ── プライバシーポリシー ─────────────────────────────

test('プライバシーポリシーの URL は https で、ソースの中で定数の 1 か所にだけ書く', () => {
  assert.match(PRIVACY_POLICY_URL, /^https:\/\/[^\s]+\.html$/)
  const files = [...listSourceFiles(path.join(ROOT, 'app')), ...listSourceFiles(path.join(ROOT, 'src'))]
  const host = new URL(PRIVACY_POLICY_URL).host
  const having = files.filter((f) => readFileSync(f, 'utf8').includes(host)).map(rel)
  assert.deepEqual(having, ['src/domain/privacyPolicy.ts'])
})

test('プライバシーポリシーを開く: 既定で定数の URL を開き、失敗したら URL を表示する画面への切り替え（fallback）', async () => {
  const opened: string[] = []
  assert.equal(await openPrivacyPolicy(async (u) => void opened.push(u)), 'opened')
  assert.deepEqual(opened, [PRIVACY_POLICY_URL])
  assert.equal(
    await openPrivacyPolicy(async () => {
      throw new Error('No Activity found to handle Intent')
    }),
    'fallback',
  )
})

test('設定「アプリについて」の並び: デベロッパー → バージョン → お問い合わせ → プライバシーポリシー', () => {
  const code = stripComments(read('app/(tabs)/settings.tsx'))
  const about = code.slice(code.indexOf('title={s.sectionAbout}'))
  const idx = ['s.developer', 's.version', 'label={s.contact}', 'label={s.privacyPolicy}'].map((k) => about.indexOf(k))
  assert.ok(idx.every((i) => i > 0), `すべての行がある: ${idx}`)
  assert.deepEqual([...idx].sort((a, b) => a - b), idx)
  assert.match(about, /<RowButton label=\{s\.privacyPolicy\} onPress=\{handlePrivacyPolicy\}/)
  // タップでブラウザを開き、開けなかったら URL の画面（設定タブの中）へ
  assert.match(code, /const handlePrivacyPolicy = async \(\) => \{[\s\S]*?openPrivacyPolicy\(\(u\) => Linking\.openURL\(u\)\)[\s\S]*?if \(result === 'fallback'\) onOpen\('privacy'\)/)
  assert.match(code, /view === 'privacy' && <PrivacyPolicyScreen onBack=\{backToMain\} \/>/)
})

test('URL の画面は定数の URL を表示し、コピーする', () => {
  const code = stripComments(read('src/screens/settings/PrivacyPolicyScreen.tsx'))
  assert.match(code, /\{PRIVACY_POLICY_URL\}/)
  assert.match(code, /copyToClipboard\(PRIVACY_POLICY_URL\)/)
  assert.match(code, /useHardwareBack\(handleBack\)/)
})

test('プライバシーポリシーの文言（日英）', () => {
  assert.equal(STRINGS.ja.privacyPolicy, 'プライバシーポリシー')
  assert.equal(STRINGS.en.privacyPolicy, 'Privacy Policy')
  assert.equal(STRINGS.ja.privacyCopy, 'URLをコピー')
  assert.equal(STRINGS.en.privacyCopy, 'Copy URL')
  assert.ok(STRINGS.ja.privacyNoBrowser.includes('ブラウザ'))
  assert.ok(STRINGS.en.privacyNoBrowser.toLowerCase().includes('browser'))
})
