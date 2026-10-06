// `node --import ./scripts/test-register.mjs --test ...` で読み込む。解決フックを登録する。
import { register } from 'node:module'

register('./test-resolve-hooks.mjs', import.meta.url)
