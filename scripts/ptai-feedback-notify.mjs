#!/usr/bin/env node
// ─── フィードバックの結果を、送ってくれた人たちのグループへ流す ────────────
//
//   node --experimental-strip-types --import ./scripts/ts-ext-register.mjs \
//     scripts/ptai-feedback-notify.mjs resolved <id> ["補足"]   解決の報告
//   … answer <id> "回答"                                       質問への回答
//   … --send を付けたときだけ実際に送る（付けなければ文面を出すだけ）
//
// ═════════════════════════════════════════════════════════════════════════
//  送り先は Power Automate の Webhook（PTAI_FEEDBACK_WEBHOOK_URL、.env.local）。
//  URL に署名が入っているので**リポジトリに書かない**（Kubotie/cxm は public）。
//
//  送るのは kubota さんが「解決」と明示したとき、または質問に答えるときだけ。
// ═════════════════════════════════════════════════════════════════════════
//
// 顧客名・議事録の中身は出さない。出すのは送信者が自分で書いた内容と対応内容だけ。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const send = process.argv.includes('--send');
const [mode, id, ...rest] = process.argv.slice(2).filter(a => a !== '--send');
const extra = rest.join(' ').trim();

if (!['resolved', 'answer'].includes(mode) || !id || (mode === 'answer' && !extra)) {
  console.error('使い方: resolved <id> ["補足"] | answer <id> "回答"  [--send]');
  process.exit(1);
}

const { getRecord } = await import('../src/lib/ptai/twenty-test/client.ts');
const { TEST_OBJECTS, FEEDBACK_KIND_JP } = await import('../src/lib/ptai/twenty-test/schema.ts');
const FB = TEST_OBJECTS.feedback;
const r = await getRecord(FB.plural, FB.singular, id);
if (!r) { console.error('フィードバックが見つかりません'); process.exit(1); }

const kind = FEEDBACK_KIND_JP[r.kind] ?? r.kind ?? '';
const title = mode === 'resolved' ? '✅ フィードバックを解決しました' : '💬 フィードバックへの回答';
const facts = [
  { title: '種別',   value: String(kind) },
  { title: '送信者', value: String(r.reporter ?? '—') },
  { title: '画面',   value: String(r.screenPath || '—') },
];
// 押すとそのままダッシュボードを開ける（未ログインならログイン画面を経由）
const DASHBOARD_URL = process.env.PTAI_DASHBOARD_URL || 'https://cxmx.vercel.app/ptai-pipeline';
const reply = mode === 'resolved' ? (extra || String(r.decision ?? '')) : extra;
const lines = [
  title,
  ...facts.map(f => `${f.title}: ${f.value}`),
  `いただいた内容: ${String(r.body ?? '')}`,
  `${mode === 'resolved' ? '対応' : '回答'}: ${reply}`,
  `ダッシュボード: ${DASHBOARD_URL}`,
];

// Teams の「Webhook 要求を受信したらチャネルに投稿する」が受け取る形（Adaptive Card）
const payload = {
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      type: 'AdaptiveCard', version: '1.4',
      body: [
        { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
        { type: 'FactSet', facts },
        { type: 'TextBlock', text: 'いただいた内容', weight: 'Bolder', wrap: true, spacing: 'Medium' },
        { type: 'TextBlock', text: String(r.body ?? ''), wrap: true },
        { type: 'TextBlock', text: mode === 'resolved' ? '対応' : '回答', weight: 'Bolder', wrap: true, spacing: 'Medium' },
        { type: 'TextBlock', text: reply, wrap: true },
      ],
      actions: [{ type: 'Action.OpenUrl', title: 'PtAI Pipeline ダッシュボードを開く', url: DASHBOARD_URL }],
    },
  }],
};

if (!send) {
  console.log('（下書き。--send で送ります）\n');
  console.log(lines.join('\n'));
  process.exit(0);
}

const url = process.env.PTAI_FEEDBACK_WEBHOOK_URL;
if (!url) { console.error('PTAI_FEEDBACK_WEBHOOK_URL が未設定です'); process.exit(1); }
const res = await fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
// 応答本文に URL が混ざることがあるので、状態コードだけ出す
console.log(res.ok ? `送信しました（${res.status}）` : `送信に失敗しました（${res.status}）`);
if (!res.ok) process.exit(1);
