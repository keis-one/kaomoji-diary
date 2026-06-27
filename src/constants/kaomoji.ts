import type { KaomojiSet, EmojiSet, KaomojiLevel, Language } from '@/types'

export const DEFAULT_KAOMOJI_SET: KaomojiSet = {
  1: '(´；ω；`)',
  2: '(´・ω・`)',
  3: '(・ω・)',
  4: '(＾ω＾)',
  5: '(＾▽＾)/',
}

export const DEFAULT_EMOJI_SET: EmojiSet = {
  1: '😭',
  2: '😔',
  3: '😐',
  4: '🙂',
  5: '😄',
}

export const LEVEL_LABELS: Record<Language, Record<KaomojiLevel, string>> = {
  ja: { 1: '最悪', 2: 'イマイチ', 3: 'まあまあ', 4: '良い', 5: '最高' },
  en: { 1: 'Terrible', 2: 'Bad', 3: 'Okay', 4: 'Good', 5: 'Great' },
}

export const KAOMOJI_LEVELS: KaomojiLevel[] = [1, 2, 3, 4, 5]

export const PRESET_KAOMOJI_SETS: KaomojiSet[] = [
  DEFAULT_KAOMOJI_SET,
  { 1: '(╥_╥)', 2: '(；ω；)', 3: '(•ω•)', 4: '(*´▽`*)', 5: '(ﾉ´∀｀*)ﾉ' },
  { 1: 'orz', 2: '(・_・)', 3: '(._.)φ', 4: '(^o^)', 5: '\\(^o^)/' },
]
