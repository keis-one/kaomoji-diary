/**
 * お問い合わせ（F80）のメールの組み立てと、メールアプリを開けないときの判定（純粋関数）。
 * 件名は表示言語に関係なく日本語で固定（オーナー確定 U7）。
 * 本文に入れる端末情報はアプリのバージョンと OS のバージョンだけ（端末の機種名・記録・問いは入れない）。
 */
import type { Language } from '@/types'

export const CONTACT_EMAIL = 'keis.one.work@gmail.com'
export const CONTACT_SUBJECT = '【アプリのお問い合わせ】kaomoji-diary について'
export const DEVELOPER_NAME = 'Keis Apps'

/** 本文のひな形。英語表示のときは英語（未確定事項 R3 の推奨案） */
export const buildContactBody = (language: Language, appVersion: string, osVersion: string): string => {
  const lines =
    language === 'ja'
      ? ['お問い合わせ内容をご記入ください。', '', '', '', '----------', `アプリのバージョン: ${appVersion}`, `OSのバージョン: ${osVersion}`]
      : ['Please write your inquiry below.', '', '', '', '----------', `App version: ${appVersion}`, `OS version: ${osVersion}`]
  return lines.join('\r\n')
}

export const buildMailtoUrl = (language: Language, appVersion: string, osVersion: string): string =>
  `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECT)}&body=${encodeURIComponent(
    buildContactBody(language, appVersion, osVersion),
  )}`

/**
 * メールアプリを開く。開けなかった（メールアプリが無い・無効等で openUrl が失敗した）ときは
 * 'fallback' を返し、呼び出し側は「お問い合わせ先」画面に切り替える。
 */
export const openContactMail = async (
  openUrl: (url: string) => Promise<unknown>,
  url: string,
): Promise<'opened' | 'fallback'> => {
  try {
    await openUrl(url)
    return 'opened'
  } catch {
    return 'fallback'
  }
}
