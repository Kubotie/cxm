// 上の解決フックを登録する。`node --import ./scripts/ts-ext-register.mjs` で使う。
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./ts-ext-loader.mjs', pathToFileURL('./scripts/'));
