// ─── テスト用の解決フック ────────────────────────────────────────────────────
// Node の ESM は拡張子を要求するが、TypeScript（moduleResolution: bundler）は
// 拡張子なしの相対 import を許す。テストから src/ を直接読むために .ts を補う。
//
// tsconfig の paths エイリアス `@/* → ./src/*` も同じ理由で解決する。
// **テスト専用。** アプリのビルドには関与しない。

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const SRC = pathToFileURL(resolvePath(process.cwd(), 'src') + '/').href;
const HAS_EXT = /\.(ts|mts|tsx|js|mjs|cjs|json)$/;

export async function resolve(specifier, context, next) {
  // `@/lib/...` → <cwd>/src/lib/...
  if (specifier.startsWith('@/')) {
    const url = SRC + specifier.slice(2);
    if (!HAS_EXT.test(url)) {
      for (const ext of ['.ts', '.tsx', '/index.ts']) {
        try { return await next(url + ext, context); } catch { /* 次の候補へ */ }
      }
    }
    return next(url, context);
  }

  if (specifier.startsWith('.') && !HAS_EXT.test(specifier)) {
    try { return await next(`${specifier}.ts`, context); } catch { /* 下へ */ }
  }
  return next(specifier, context);
}
