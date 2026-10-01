#!/usr/bin/env node
// ─── externalId に埋まった会社 ID を正しいものへ揃える ──────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-fix-external-ids.mjs            数えるだけ（書かない）
//   … 同上 --apply                                  書き換える（冪等）
//
// ═══════════════════════════════════════════════════════════════════════════
//  なぜ要るか（2026-10-01）
//
//  移行スクリプトが `edits:<会社ID>:<key>` の <会社ID> に、いまの Notion ページ
//  ID とは**別のページ ID** を埋めてしまっていた（`notionCompanyId` 列の方は
//  正しい）。そのため:
//
//    ・db-view が key を取り出せず `d0` のような連番に落ちる
//    ・画面から保存すると `edits:<正しいID>:d0` という**別のレコードが増える**
//      （元のレコードは接頭辞が違うので消されず、重複になる）
//
//  組織図（testPerson）でも同じことが起きて 21 行の重複を作った。
//  ここで externalId を `edits:<notionCompanyId>:<key>` に揃えて根を断つ。
//
//  ⚠ ぶら下がり（`:na` / `:log:`）の externalId も同時に書き換える。
//     先に親だけ直すと、次の保存で子が作り直される。
// ═══════════════════════════════════════════════════════════════════════════
//
// 顧客名は出さない。出すのは件数と externalId の形だけ。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const apply = process.argv.includes('--apply');
const { listRecords, updateRecord } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS } = await import('../src/lib/ptai/twenty-test/schema.ts');

/** `<接頭辞>:<会社ID>:<残り>` の会社 ID が notionCompanyId と違うものを直す */
const PREFIXES = ['edits', 'aplans', 'orgs', 'recent', 'minutes'];

const TARGETS = [
  TEST_OBJECTS.opportunity,
  TEST_OBJECTS.action,
  TEST_OBJECTS.activity,
  TEST_OBJECTS.person,
  TEST_OBJECTS.accountPlan,
  TEST_OBJECTS.comment,
];

let checked = 0, broken = 0, fixed = 0, failed = 0;

for (const obj of TARGETS) {
  const rows = await listRecords(obj.plural, obj.singular, { pageSize: 200, maxRecords: 5000 });
  let objBroken = 0;
  for (const r of rows) {
    checked++;
    const ext = String(r.externalId ?? '');
    const cid = String(r.notionCompanyId ?? '');
    if (!ext || !cid) continue;

    const m = ext.match(/^([a-z]+):([^:]+):(.*)$/);
    if (!m) continue;
    const [, prefix, embedded, rest] = m;
    if (!PREFIXES.includes(prefix)) continue;
    if (embedded === cid) continue;          // 既に正しい

    broken++; objBroken++;
    if (!apply) continue;
    try {
      await updateRecord(obj.plural, obj.singular, String(r.id), {
        externalId: `${prefix}:${cid}:${rest}`,
      });
      fixed++;
    } catch {
      failed++;
    }
  }
  if (objBroken) console.log(`  ${obj.singular.padEnd(18)} ずれ ${objBroken} 件 / 全 ${rows.length} 件`);
}

console.log(`\n調べた ${checked} 件 / 会社 ID がずれている ${broken} 件`);
if (apply) console.log(`書き換え ${fixed} 件 / 失敗 ${failed} 件`);
else console.log('書き換えるには --apply');
