/**
 * UTF-8 のエンコード・厳密なデコード（純粋関数）。
 *
 * 読み込み（F53）では「UTF-8 として読めないファイル（Shift_JIS 等）は全体を失敗にする」必要がある。
 * 端末の文字コード変換に任せると不正なバイトが置換文字（U+FFFD）に化けて区別できないため、
 * ここで自前に検証しながらデコードする。React Native（Hermes）の TextDecoder の有無にも依存しない。
 */

export const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf] as const
export const BOM_CHAR = '﻿'

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff

/** 文字列を UTF-8 にしたときのバイト数。対になっていないサロゲートは U+FFFD（3バイト）として数える */
export const utf8ByteLength = (s: string): number => {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x80) n += 1
    else if (c < 0x800) n += 2
    else if (isHighSurrogate(c) && i + 1 < s.length && isLowSurrogate(s.charCodeAt(i + 1))) {
      n += 4
      i++
    } else n += 3
  }
  return n
}

/** 文字列を UTF-8 のバイト列にする（BOM は付けない。必要なら文字列の先頭に BOM_CHAR を置く） */
export const encodeUtf8 = (s: string): Uint8Array => {
  const out = new Uint8Array(utf8ByteLength(s))
  let p = 0
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i)
    if (isHighSurrogate(c) && i + 1 < s.length && isLowSurrogate(s.charCodeAt(i + 1))) {
      c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(i + 1) - 0xdc00)
      i++
    } else if (isHighSurrogate(c) || isLowSurrogate(c)) {
      c = 0xfffd
    }
    if (c < 0x80) {
      out[p++] = c
    } else if (c < 0x800) {
      out[p++] = 0xc0 | (c >> 6)
      out[p++] = 0x80 | (c & 0x3f)
    } else if (c < 0x10000) {
      out[p++] = 0xe0 | (c >> 12)
      out[p++] = 0x80 | ((c >> 6) & 0x3f)
      out[p++] = 0x80 | (c & 0x3f)
    } else {
      out[p++] = 0xf0 | (c >> 18)
      out[p++] = 0x80 | ((c >> 12) & 0x3f)
      out[p++] = 0x80 | ((c >> 6) & 0x3f)
      out[p++] = 0x80 | (c & 0x3f)
    }
  }
  return out
}

/**
 * UTF-8 として厳密にデコードする。不正なバイト列（途中で切れた文字・冗長な表現・
 * サロゲートの符号化・U+10FFFF 超）が1か所でもあれば null を返す。BOM はそのまま U+FEFF として残す。
 */
export const decodeUtf8Strict = (bytes: Uint8Array): string | null => {
  const chunks: string[] = []
  const units: number[] = []
  const flush = () => {
    chunks.push(String.fromCharCode.apply(null, units))
    units.length = 0
  }
  const len = bytes.length
  let i = 0
  while (i < len) {
    const b0 = bytes[i]
    let cp: number
    if (b0 < 0x80) {
      cp = b0
      i += 1
    } else if (b0 >= 0xc2 && b0 <= 0xdf) {
      if (i + 1 >= len) return null
      const b1 = bytes[i + 1]
      if ((b1 & 0xc0) !== 0x80) return null
      cp = ((b0 & 0x1f) << 6) | (b1 & 0x3f)
      i += 2
    } else if (b0 >= 0xe0 && b0 <= 0xef) {
      if (i + 2 >= len) return null
      const b1 = bytes[i + 1]
      const b2 = bytes[i + 2]
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80) return null
      if (b0 === 0xe0 && b1 < 0xa0) return null // 冗長な表現
      if (b0 === 0xed && b1 >= 0xa0) return null // サロゲートの符号化
      cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)
      i += 3
    } else if (b0 >= 0xf0 && b0 <= 0xf4) {
      if (i + 3 >= len) return null
      const b1 = bytes[i + 1]
      const b2 = bytes[i + 2]
      const b3 = bytes[i + 3]
      if ((b1 & 0xc0) !== 0x80 || (b2 & 0xc0) !== 0x80 || (b3 & 0xc0) !== 0x80) return null
      if (b0 === 0xf0 && b1 < 0x90) return null // 冗長な表現
      if (b0 === 0xf4 && b1 >= 0x90) return null // U+10FFFF 超
      cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      i += 4
    } else {
      return null // 0x80〜0xC1・0xF5〜0xFF は先頭バイトになれない
    }
    if (cp >= 0x10000) {
      const v = cp - 0x10000
      units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff))
    } else {
      units.push(cp)
    }
    if (units.length >= 8192) flush()
  }
  flush()
  return chunks.join('')
}
