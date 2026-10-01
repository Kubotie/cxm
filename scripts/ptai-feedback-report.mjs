#!/usr/bin/env node
// ─── フィードバックの定期報告用の読み取り ───────────────────────────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-feedback-report.mjs            未処理（NEW/TRIAGED/DEFERRED）
//   … --all                                        解決・取り下げも含めて全部
//   … --json                                       そのまま機械で読む形で出す
//
// ═══════════════════════════════════════════════════════════════════════════
//  これは **定期報告（平日 9〜21 時・3 時間おき）** のための入口。
//  画面の /api/ptai/feedback はログインが要るが、こちらは Twenty を直接読む
//  ので、Claude の定期実行からそのまま呼べる。読むだけで書かない。
//
//  判断を書くのは `scripts/ptai-feedback-decide.mjs` の方。
// ═══════════════════════════════════════════════════════════════════════════
//
// 顧客名は出さない。出すのは送信者が自分で書いた内容と、画面上の要素だけ。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const all  = process.argv.includes('--all');
const json = process.argv.includes('--json');

const { listRecords } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS, FEEDBACK_OPEN, FEEDBACK_KIND_JP, FEEDBACK_STATUS_JP } =
  await import('../src/lib/ptai/twenty-test/schema.ts');

const FB = TEST_OBJECTS.feedback;
const rows = await listRecords(FB.plural, FB.singular, { pageSize: 200, maxRecords: 1000 });

const items = rows
  .map(r => ({
    id:          String(r.id ?? ''),
    name:        String(r.name ?? ''),
    body:        String(r.body ?? ''),
    kind:        String(r.kind ?? ''),
    status:      String(r.status ?? 'NEW'),
    selector:    r.selector ?? null,
    elementText: r.elementText ?? null,
    screenPath:  r.screenPath ?? null,
    reporter:    r.reporter ?? null,
    decision:    r.decision ?? null,
    decidedBy:   r.decidedBy ?? null,
    decidedAt:   r.decidedAt ?? null,
    createdAt:   String(r.createdAt ?? ''),
  }))
  .filter(r => all || FEEDBACK_OPEN.has(r.status))
  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

// 「前回の報告以降に来たもの」を見分けるための印。
// 定期報告は 3 時間おきなので、それより新しいものを新規として扱う。
const since = Date.now() - 3 * 60 * 60 * 1000;
const isNew = r => r.status === 'NEW' && new Date(r.createdAt).getTime() >= since;

if (json) {
  console.log(JSON.stringify({
    total: items.length,
    fresh: items.filter(isNew).length,
    items: items.map(r => ({ ...r, fresh: isNew(r) })),
  }, null, 2));
} else if (!items.length) {
  console.log('未処理のフィードバックはありません');
} else {
  console.log(`未処理 ${items.length} 件（うち直近 3 時間 ${items.filter(isNew).length} 件）\n`);
  for (const r of items) {
    const jp = FEEDBACK_STATUS_JP[r.status] ?? r.status;
    console.log(`${isNew(r) ? '🆕' : '  '} [${jp}/${FEEDBACK_KIND_JP[r.kind] ?? r.kind}] ${r.name}`);
    console.log(`     id=${r.id}  ${r.reporter ?? '?'}  ${r.createdAt.slice(0, 16).replace('T', ' ')}`);
    if (r.screenPath) console.log(`     画面: ${r.screenPath}${r.selector ? `  要素: ${r.selector}` : ''}`);
    if (r.elementText) console.log(`     表示: ${String(r.elementText).slice(0, 80)}`);
    if (r.body !== r.name) console.log(`     ${r.body.replace(/\n/g, '\n     ')}`);
    if (r.decision) console.log(`     → 方針(${r.decidedBy ?? '?'}): ${r.decision}`);
    console.log('');
  }
}
