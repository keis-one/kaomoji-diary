/**
 * 一言の編集ルールとカレンダーの日タップの判定（純粋関数）。
 * 製品仕様 Sprint 19b「一言の保持と編集」（オーナー確定 U6）・「カレンダーの今日・過去日」（U8）。
 */

export const COMMENT_MAX_LENGTH = 100

/** 一言の文字数（絵文字などのサロゲートペアは1文字として数える） */
export const commentLength = (s: string): number => Array.from(s).length

export interface CommentCheck {
  /** 保存してよいか */
  ok: boolean
  /** 変更後の一言が上限を超えている（「一言は100文字までです（いま N 文字）」を出す） */
  tooLong: boolean
  length: number
}

/**
 * 一言を変更していなければ（読み込みで入った長い一言・改行を含む一言も）全文そのまま保存してよい。
 * 変更したときだけ 100 文字の上限を当てはめる。
 */
export const checkCommentEdit = (original: string, edited: string): CommentCheck => {
  const length = commentLength(edited)
  if (edited === original) return { ok: true, tooLong: false, length }
  const tooLong = length > COMMENT_MAX_LENGTH
  return { ok: !tooLong, tooLong, length }
}

/** カレンダーの日をタップしたとき: 今日と過去日は入力・編集ポップアップを開く。未来の日は何もしない */
export const dayTapAction = (date: string, today: string): 'open' | 'none' => (date <= today ? 'open' : 'none')

/** ポップアップの主ボタン: 記録が無い日は「記録する」、ある日は「保存」 */
export const popupMode = (hasEntry: boolean): 'record' | 'save' => (hasEntry ? 'save' : 'record')
