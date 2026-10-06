// お問い合わせ・一言の編集・カレンダーの日タップ・広告の枠の高さ（Sprint 19a 追補 A4・19b の [自動]）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContactBody,
  buildMailtoUrl,
  openContactMail,
  CONTACT_EMAIL,
  CONTACT_SUBJECT,
} from '../contact'
import { checkCommentEdit, dayTapAction, popupMode, commentLength } from '../dayEditor'
import { adSlotHeight, nextAdSlotState, shouldRenderAd, AD_SLOT_HEIGHT, type AdSlotState } from '../adSlot'
import { pickRecoveryQuestionId } from '../entries'

const TODAY = '2026-10-07'

// ── お問い合わせ ─────────────────────────────────────

const parseMailto = (url: string) => {
  const [addr, query] = url.replace(/^mailto:/, '').split('?')
  const params = new URLSearchParams(query)
  return { addr, subject: params.get('subject'), body: params.get('body') }
}

for (const language of ['ja', 'en'] as const) {
  test(`お問い合わせ（${language}）: 宛先・件名（日本語で固定）・本文にアプリと OS のバージョンだけが入る`, () => {
    const m = parseMailto(buildMailtoUrl(language, '1.2.0', 'Android 14'))
    assert.equal(m.addr, 'keis.one.work@gmail.com')
    assert.equal(m.subject, '【アプリのお問い合わせ】kaomoji-diary について')
    assert.ok(m.body?.includes('1.2.0'))
    assert.ok(m.body?.includes('Android 14'))
    assert.equal(m.body, buildContactBody(language, '1.2.0', 'Android 14'))
  })
}

test('お問い合わせの本文のひな形（日本語）と、端末の機種名・記録などの情報が入らないこと', () => {
  assert.equal(
    buildContactBody('ja', '1.2.0', 'Android 14'),
    ['お問い合わせ内容をご記入ください。', '', '', '', '----------', 'アプリのバージョン: 1.2.0', 'OSのバージョン: Android 14'].join('\r\n'),
  )
  const en = buildContactBody('en', '1.2.0', 'Android 14')
  assert.ok(en.startsWith('Please write your inquiry below.'))
  for (const body of [buildContactBody('ja', '1.2.0', 'Android 14'), en]) {
    // 本文の行は、ひな形の文・空行・区切り線・バージョン2行だけ
    const infoLines = body.split('\r\n').filter((l) => l.includes(':'))
    assert.equal(infoLines.length, 2)
    assert.doesNotMatch(body, /model|機種|Pixel|Galaxy/i)
  }
  assert.equal(CONTACT_EMAIL, 'keis.one.work@gmail.com')
  assert.equal(CONTACT_SUBJECT, '【アプリのお問い合わせ】kaomoji-diary について')
})

test('メールアプリを開く処理が失敗すると「お問い合わせ先」画面に切り替える判定、成功すれば切り替えない', async () => {
  const opened: string[] = []
  assert.equal(await openContactMail(async (u) => void opened.push(u), 'mailto:x'), 'opened')
  assert.deepEqual(opened, ['mailto:x'])
  assert.equal(
    await openContactMail(async () => {
      throw new Error('No Activity found to handle Intent')
    }, 'mailto:x'),
    'fallback',
  )
})

// ── カレンダー・一言 ──────────────────────────────────

test('日タップ: 今日・過去日（何年前でも）は開く、未来の日は何もしない', () => {
  assert.equal(dayTapAction(TODAY, TODAY), 'open')
  assert.equal(dayTapAction('2020-01-15', TODAY), 'open')
  assert.equal(dayTapAction('2026-10-08', TODAY), 'none')
  assert.equal(dayTapAction('2027-01-01', TODAY), 'none')
})

test('ポップアップの主ボタン: 記録が無い日は「記録する」、ある日は「保存」', () => {
  assert.equal(popupMode(false), 'record')
  assert.equal(popupMode(true), 'save')
})

test('一言: 変更していなければ長くても保存できる。変更したら100文字まで（絵文字は1文字）', () => {
  const long = 'x'.repeat(150)
  assert.deepEqual(checkCommentEdit(long, long), { ok: true, tooLong: false, length: 150 })
  assert.equal(checkCommentEdit('', 'a'.repeat(100)).ok, true)
  assert.deepEqual(checkCommentEdit('', 'a'.repeat(101)), { ok: false, tooLong: true, length: 101 })
  assert.equal(checkCommentEdit(long, long.slice(0, 100)).ok, true, '100文字まで削れば保存できる')
  assert.equal(commentLength('😄'.repeat(100)), 100)
  assert.equal(checkCommentEdit('', '😄'.repeat(100)).ok, true)
  assert.equal(checkCommentEdit('', '改行\nを含む').ok, true, '改行は現行どおり入力できる')
})

test('問いの作り直しで引き継ぐ問いID: 日付が最も新しい記録、同じ日は辞書順で先、記録が無ければ null', () => {
  assert.equal(pickRecoveryQuestionId([]), null)
  assert.equal(
    pickRecoveryQuestionId([
      { date: '2026-10-03', questionId: 'q2', level: 3, comment: '' },
      { date: '2026-10-03', questionId: 'q1', level: 3, comment: '' },
      { date: '2026-10-01', questionId: 'q0', level: 3, comment: '' },
    ]),
    'q1',
  )
})

// ── 広告の枠（A4-3） ─────────────────────────────────

test('A4-3 広告の読み込み失敗（通信エラー・no-fill）の前後で、広告の枠の高さが変わらない', () => {
  let state: AdSlotState = 'loading'
  const heights = [adSlotHeight(state)]
  state = nextAdSlotState(state, 'failedToLoad')
  heights.push(adSlotHeight(state))
  assert.equal(shouldRenderAd(state), false, '失敗したら広告部品を外す')
  state = nextAdSlotState('loading', 'loaded')
  heights.push(adSlotHeight(state))
  assert.deepEqual(heights, [AD_SLOT_HEIGHT, AD_SLOT_HEIGHT, AD_SLOT_HEIGHT])
  assert.equal(AD_SLOT_HEIGHT, 50, '320×50 バナーと同じ高さ')
})
