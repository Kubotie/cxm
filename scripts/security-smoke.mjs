// ─── セキュリティ是正のスモークテスト ─────────────────────────────────────────
//
//   node scripts/security-smoke.mjs [baseUrl]
//   既定 http://localhost:3000（**ローカルの dev サーバーに対してのみ実行すること**）
//
// 依存を増やさないため、テストランナーは使わず Node 標準だけで書く。
// 本番へは実行しない。書き込み系は叩かない（状態を変えない GET と、
// 認証で必ず弾かれる呼び出しだけを使う）。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:3000';

// ── .env.local から署名鍵などを読む（値は出力しない）───────────────────────
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const SECRET = process.env.CXM_SESSION_SECRET;
if (!SECRET) { console.error('CXM_SESSION_SECRET が未設定です'); process.exit(1); }

// ── src/lib/auth/session-token.ts と同じ形式でトークンを作る ────────────────
const b64url = buf => Buffer.from(buf).toString('base64url');
function mint(name2, { expiresInSec = 3600, tamper = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64url(JSON.stringify({ u: name2, iat: now, exp: now + expiresInSec }));
  const sig = b64url(createHmac('sha256', SECRET).update(`v1.${body}`).digest());
  return `v1.${body}.${tamper ? b64url(Buffer.alloc(32, 1)) : sig}`;
}

// ── テストランナー（最小）────────────────────────────────────────────────────
let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    const detail = await fn();
    pass++; console.log(`  ✅ ${name}${detail ? `  — ${detail}` : ''}`);
  } catch (e) {
    fail++; console.log(`  ❌ ${name}\n       ${e.message}`);
  }
}
function expect(actual, wanted, label) {
  const ok = Array.isArray(wanted) ? wanted.includes(actual) : actual === wanted;
  if (!ok) throw new Error(`${label}: 期待 ${JSON.stringify(wanted)} / 実際 ${JSON.stringify(actual)}`);
  return `${label}=${actual}`;
}
const req = (path, { cookie, method = 'GET', headers = {}, body } = {}) =>
  fetch(BASE + path, {
    method, redirect: 'manual', body,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
  });

// 認証なしで読めてはいけない一般 API（読み取りのみ）
const GENERAL_API = '/api/nocodb/companies';
const ADMIN_API   = '/api/ops/ai-config';          // admin 限定
const OPS_API     = '/api/ops/sf-data-prep/report'; // admin/ops 限定
const PGA_API     = '/api/ptai/db';
const CRON_API    = '/api/batch/churn-radar';

console.log(`\nセキュリティスモーク（${BASE}）\n`);

// 1
await check('Cookie なしで一般 API が 401（HTML ではなく JSON）', async () => {
  const r = await req(GENERAL_API);
  const s = expect(r.status, 401, 'status');
  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new Error(`Content-Type が JSON でない: ${ct}`);
  return s;
});

// 2
await check('旧形式の平文 cxm_user_uid だけでは 401', async () =>
  expect((await req(GENERAL_API, { cookie: 'cxm_user_uid=Kubotie; cxm_user_role=admin' })).status, 401, 'status'));

// 3
await check('署名を改ざんしたセッションは 401', async () =>
  expect((await req(GENERAL_API, { cookie: `cxm_session=${mint('Kubotie', { tamper: true })}` })).status, 401, 'status'));

// 4
await check('期限切れセッションは 401', async () =>
  expect((await req(GENERAL_API, { cookie: `cxm_session=${mint('Kubotie', { expiresInSec: -60 })}` })).status, 401, 'status'));

// 5
await check('正常なセッションで一般 API が成功', async () =>
  expect((await req(GENERAL_API, { cookie: `cxm_session=${mint('Kubotie')}` })).status, 200, 'status'));

// 6
await check('一般ユーザー（csm）が admin API を叩くと 403', async () =>
  expect((await req(ADMIN_API, { cookie: `cxm_session=${mint('BB')}` })).status, 403, 'status'));

await check('一般ユーザー（csm）が ops API を叩くと 403', async () =>
  expect((await req(OPS_API, { cookie: `cxm_session=${mint('BB')}` })).status, 403, 'status'));

// 7
await check('admin が admin API を叩くと成功', async () =>
  expect((await req(ADMIN_API, { cookie: `cxm_session=${mint('Kubotie')}` })).status, 200, 'status'));

// 8
await check('認証 API は middleware に妨害されない', async () => {
  const r = await req('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  // middleware が弾いていれば 401。ハンドラに届いていれば 400（必須項目エラー）
  return expect(r.status, 400, 'status');
});

// 9
await check('Cron が正しい Bearer で実行できる', async () => {
  const r = await req(CRON_API, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  if (r.status === 401) throw new Error('正しい CRON_SECRET が拒否された');
  return `status=${r.status}`;
});
await check('Cron が誤った Bearer では拒否される', async () =>
  expect((await req(CRON_API, { headers: { Authorization: 'Bearer wrong-secret' } })).status, 401, 'status'));
await check('Cron API は Cookie 無し・Bearer 無しでは通らない', async () =>
  expect((await req(CRON_API)).status, [401, 403], 'status'));

// 10
await check('PGA の読み書き API はセッションを要求する', async () => {
  const anon = await req(PGA_API);
  expect(anon.status, 401, 'anon');
  const authed = await req(PGA_API, { cookie: `cxm_session=${mint('Kubotie')}` });
  return expect(authed.status, 200, 'authed');
});
await check('PGA の RAW（顧客データ）は未認証で取れない', async () =>
  expect((await req('/api/ptai/raw')).status, 401, 'status'));
await check('PGA の静的 JS も未認証では取れない', async () => {
  const r = await req('/ptai-pipeline/board.js');
  return expect(r.status, [307, 302], 'status(ログインへリダイレクト)');
});

// 11
await check('クライアントコードから NEXT_PUBLIC_SUPPORT_BATCH_SECRET が消えている', async () => {
  const { execSync } = await import('node:child_process');
  const out = execSync(
    "grep -rl 'process.env.NEXT_PUBLIC_SUPPORT_BATCH_SECRET' src/ || true",
    { encoding: 'utf8' },
  ).trim();
  if (out) throw new Error(`まだ参照が残っている:\n${out}`);
  return '参照 0 件';
});

// 補足: ページは JSON ではなくログイン画面へリダイレクトすること
await check('ページ（/v2）は未認証でログインへリダイレクト', async () => {
  const r = await req('/v2');
  return expect(r.status, [307, 302], 'status');
});

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗\n`);
process.exit(fail ? 1 : 0);
