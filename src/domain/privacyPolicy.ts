/**
 * プライバシーポリシー（設定の「アプリについて」の行。製品仕様 U9・Sprint 19c）の URL と、ブラウザを開く処理（純粋関数）。
 *
 * URL はこのファイルの PRIVACY_POLICY_URL の 1 か所だけで持つ（他のファイルに URL を書かない。テストで確認している）。
 * 公開サイトのドメインが変わったときは、この定数を書き換え、version を上げてストアに出し直す
 * （公開済みのアプリは古い URL を開き続けるため、古いドメインからの転送か、しばらく古い URL のページを残すこと）。
 * Play Console の「プライバシーポリシー」の URL 欄も同じ URL に直す。
 */

/** 暫定値: keis-portfolio（Azure Static Web Apps の既定のドメイン）に作るアプリ別のページ。日英は同じページに載せる */
export const PRIVACY_POLICY_URL = 'https://gray-glacier-029e9c800.7.azurestaticapps.net/privacy/kaomoji-diary.html'

/**
 * 端末のブラウザでプライバシーポリシーを開く。開けなかった（ブラウザが無い・無効等で openUrl が失敗した）ときは
 * 'fallback' を返し、呼び出し側は URL を表示する画面に切り替える（お問い合わせと同じ方針）。
 */
export const openPrivacyPolicy = async (
  openUrl: (url: string) => Promise<unknown>,
  url: string = PRIVACY_POLICY_URL,
): Promise<'opened' | 'fallback'> => {
  try {
    await openUrl(url)
    return 'opened'
  } catch {
    return 'fallback'
  }
}
