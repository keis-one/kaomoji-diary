// Sprint 20 の、ソースを読んで確かめる回帰テスト（文言・画面のつながり・取り違えの再混入）。
// 実機の動きの確認（S20-R1〜R11）の代わりにはならない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STRINGS } from '@/i18n/strings'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (r: string) => readFileSync(path.join(ROOT, r), 'utf8')
const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const code = (r: string) => stripComments(read(r))

test('S20-1: ホームのボタンは記録の有無にかかわらず「保存する」／Save。「記録する」「編集する」／Edit の切り替えは無い', () => {
  assert.equal(STRINGS.ja.homeSave, '保存する')
  assert.equal(STRINGS.en.homeSave, 'Save')
  assert.equal('homeRecord' in STRINGS.ja, false)
  assert.equal('homeEdit' in STRINGS.ja, false)
  const home = code('app/(tabs)/index.tsx')
  assert.match(home, /\{s\.homeSave\}/)
  assert.doesNotMatch(home, /homeEdit|homeRecord|homeButtonMode|'編集する'|'記録する'|'Edit'/)
  // 顔文字が未選択・保存の処理中は押せない
  assert.match(home, /const canSave = !!level && commentCheck\.ok && !saving/)
  assert.match(home, /disabled=\{!canSave\}/)
})

test('S20-2: ホームの保存は saveTodayFromHome を通し、トーストを出さない。失敗のときはエラーの文', () => {
  const home = code('app/(tabs)/index.tsx')
  assert.match(home, /saveTodayFromHome\(/)
  assert.match(home, /savedFlow\.start/)
  assert.match(home, /navigate\('\/calendar'\)/)
  assert.doesNotMatch(home, /showToast/)
  assert.match(home, /setSaveFailed\(true\)/)
})

test('S20-2: カレンダーは表示時に流れの表示月へ合わせ、離れる・日付のタップ・月の切り替えで流れを取り消す', () => {
  const cal = code('app/(tabs)/calendar.tsx')
  assert.match(cal, /useFocusEffect\(/)
  assert.match(cal, /savedFlow\.calendarShown\(\)/)
  assert.match(cal, /return \(\) => savedFlow\.cancel\(\)/, 'カレンダーから離れたら取り消す')
  const openDay = cal.slice(cal.indexOf('const openDay'), cal.indexOf('const openDay') + 400)
  assert.match(openDay, /savedFlow\.cancel\(\)/, '日付のタップで取り消す')
  const change = cal.slice(cal.indexOf('const changeMonth'), cal.indexOf('const changeMonth') + 600)
  assert.match(change, /savedFlow\.cancel\(\)/, '月の切り替えで取り消す')
  assert.match(cal, /decideMonthSwipe\(/)
  assert.match(cal, /lockMonthSwipe\(/)
})

test('S20-3: 編集シートで保存したらスタンプ（shouldStampAfterDayAction）。保存しましたシートは開かない', () => {
  const cal = code('app/(tabs)/calendar.tsx')
  const submit = cal.slice(cal.indexOf('const handleSubmit'), cal.indexOf('const handleDelete'))
  assert.match(submit, /shouldStampAfterDayAction\(/)
  assert.doesNotMatch(submit, /setSavedSheet|openSheet/)
  const del = cal.slice(cal.indexOf('const handleDelete'), cal.indexOf('const handleDelete') + 300)
  assert.doesNotMatch(del, /stamp/i)
})

test('S20-4: 保存しましたシートの文言（日本語・英語）。「♪」は付けない', () => {
  assert.equal(STRINGS.ja.savedTitle, '保存しました')
  assert.equal(STRINGS.en.savedTitle, 'Saved')
  assert.equal(STRINGS.ja.close, '閉じる')
  assert.equal(STRINGS.en.close, 'Close')
  assert.equal(STRINGS.ja.shareButton, '📤 SNS にシェア')
  assert.equal(STRINGS.en.shareButton, '📤 Share')
  assert.equal(STRINGS.ja.streakLabel(2), '🔥 2日連続記録中！')
  assert.equal(STRINGS.en.streakLabel(2), '🔥 2 day streak!')
  const sheet = code('src/components/SavedSheet.tsx')
  assert.doesNotMatch(sheet + JSON.stringify(STRINGS), /♪/)
  for (const k of ['s.savedTitle', 's.close', 's.shareButton', 's.streakLabel', 'formatPopupDate', 'shouldShowStreak']) {
    assert.ok(sheet.includes(k), k)
  }
  // 一言は表示だけ（入力欄にしない）。空なら出さない
  assert.doesNotMatch(sheet, /TextInput/)
  assert.match(sheet, /entry\.comment \? /)
  // 一言を切り詰めない
  const memo = sheet.slice(sheet.indexOf('styles.memo'), sheet.indexOf('styles.memo') + 200)
  assert.doesNotMatch(memo, /numberOfLines/)
})

test('S20-4 / S20-8: ホームと保存しましたシートのシェアは同じ処理（useShareToday）。ホームのシェアは今日の記録がある日だけ', () => {
  const home = code('app/(tabs)/index.tsx')
  const cal = code('app/(tabs)/calendar.tsx')
  assert.match(home, /useShareToday\(\)/)
  assert.match(cal, /useShareToday\(\)/)
  assert.match(home, /\{todayEntry && \(\s*<Pressable style=\{styles\.shareBtn\}/)
  assert.match(code('src/hooks/useShareToday.ts'), /todayShareOptions\(/)
})

test('S20-5: カレンダーのマスは顔文字（絵文字のセットを使わない）。大きさは fitKaomojiFont で決める', () => {
  const files = ['app/(tabs)/calendar.tsx', 'src/components/MonthGrid.tsx']
  for (const f of files) assert.doesNotMatch(code(f), /DEFAULT_EMOJI_SET|emojiSet/, f)
  const grid = code('src/components/MonthGrid.tsx')
  assert.match(grid, /fitKaomojiFont\(/)
  assert.match(grid, /kaomojiSet\[entry\.level\]/)
  assert.doesNotMatch(grid, /adjustsFontSizeToFit/)
  assert.match(grid, /ellipsizeMode="tail"/)
  assert.match(grid, /numberOfLines=\{1\}/)
})

test('S20-7: 編集シート・保存しましたシートは共通の BottomSheet。キーボードの扱いを残し、下スワイプで閉じたらキーボードも閉じる', () => {
  assert.match(code('src/components/DayPopup.tsx'), /<BottomSheet/)
  assert.match(code('src/components/SavedSheet.tsx'), /<BottomSheet/)
  const bs = code('src/components/BottomSheet.tsx')
  assert.match(bs, /Keyboard\.addListener\('keyboardDidShow'/)
  assert.match(bs, /paddingBottom: keyboardOffset/)
  assert.match(bs, /Keyboard\.dismiss\(\)/)
  assert.match(bs, /canStartSheetDrag\(/)
  assert.match(bs, /decideSheetDismiss\(/)
  assert.match(bs, /onRequestClose=/)
  // 入力欄の中から始めた操作は閉じる動きにしない
  assert.match(code('src/components/DayPopup.tsx'), /onTouchStart=\{markInputTouch\}/)
  // 編集シートの下スワイプは「キャンセル」と同じ（保存しない）
  assert.match(code('src/components/DayPopup.tsx'), /onDragDismiss=\{onClose\}/)
})

test('S20-9: 動きを減らす設定は端末の設定（AccessibilityInfo）から読む', () => {
  const hook = code('src/hooks/useReduceMotion.ts')
  assert.match(hook, /AccessibilityInfo\.isReduceMotionEnabled\(\)/)
  assert.match(hook, /'reduceMotionChanged'/)
  for (const f of ['app/(tabs)/calendar.tsx']) assert.match(code(f), /useReduceMotion\(\)/)
})

test('新しいライブラリを入れていない（ジェスチャー・アニメーションは React Native 標準の PanResponder・Animated）', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const name of ['react-native-reanimated', 'react-native-gesture-handler', 'lottie-react-native']) {
    assert.equal(name in (pkg.dependencies ?? {}), false, name)
  }
})
