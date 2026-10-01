// ─── Twenty Health / RAW diff の API テスト ──────────────────────────────────
//
//   node scripts/twenty-health.test.mjs [baseUrl]
//
// ローカル dev サーバーに対して **GET のみ** 実行する。
// Twenty / NocoDB / Pipeline の pga_docs への書き込みは一切しない。
// 依存を増やさないため Node 標準だけで書いている。
//
// 対象は **PtAI Pipeline の Twenty 連携**だけ。
// CXM のコードとデータには触れていないことも、あわせて検査する（末尾の「CXM 保護」）。

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHmac } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:3000';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of (await readFile(f, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const SECRET = process.env.CXM_SESSION_SECRET;
const TWENTY_KEY = process.env.TWENTY_API_KEY ?? '';
if (!SECRET) { console.error('CXM_SESSION_SECRET が未設定'); process.exit(1); }

const b64 = b => Buffer.from(b).toString('base64url');
function session(name2) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ u: name2, iat: now, exp: now + 900 }));
  return `v1.${body}.${b64(createHmac('sha256', SECRET).update(`v1.${body}`).digest())}`;
}

let pass = 0, fail = 0;
async function check(name, fn) {
  try { const d = await fn(); pass++; console.log(`  ✅ ${name}${d ? ` — ${d}` : ''}`); }
  catch (e) { fail++; console.log(`  ❌ ${name}\n       ${e.message}`); }
}
const get = (path, cookie) =>
  fetch(BASE + path, { headers: cookie ? { Cookie: `cxm_session=${cookie}` } : {}, redirect: 'manual' });

const ADMIN = session('Kubotie');   // role=admin
const CSM   = session('BB');        // role=csm

console.log(`\nTwenty Health / RAW diff（${BASE}）\n`);

await check('未認証で health は 401', async () => {
  const r = await get('/api/ops/twenty/health');
  if (r.status !== 401) throw new Error(`status=${r.status}`);
  return 'status=401';
});

await check('csm ロールで health は 403', async () => {
  const r = await get('/api/ops/twenty/health', CSM);
  if (r.status !== 403) throw new Error(`status=${r.status}`);
  return 'status=403';
});

await check('csm ロールで raw-diff も 403', async () => {
  const r = await get('/api/ops/twenty/raw-diff', CSM);
  if (r.status !== 403) throw new Error(`status=${r.status}`);
  return 'status=403';
});

await check('csm ロールで /ops/twenty 画面の API に到達できない', async () => {
  const r = await get('/api/ops/twenty/health', CSM);
  const body = await r.text();
  if (body.includes('resolvedBaseUrl')) throw new Error('本文が漏れている');
  return 'body に診断結果が含まれない';
});

let health = null;
await check('admin で health が 200 かつ status が ok / degraded', async () => {
  const r = await get('/api/ops/twenty/health', ADMIN);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  health = await r.json();
  if (!['ok', 'degraded'].includes(health.status)) throw new Error(`status=${health.status}: ${health.warnings?.[0] ?? ''}`);
  return `status=${health.status} base=${health.resolvedBaseUrl}`;
});

await check('health が Cache-Control: no-store を返す', async () => {
  const r = await get('/api/ops/twenty/health', ADMIN);
  const cc = r.headers.get('cache-control') ?? '';
  if (!cc.includes('no-store')) throw new Error(`cache-control=${cc}`);
  return cc;
});

await check('PtAI フィルタ付きの企業件数が全社数と混同されていない', async () => {
  if (!health) throw new Error('health 未取得');
  const n = health.counts.pgaCompanies;
  if (n == null) throw new Error('件数が取れていない');
  if (n > 1000) throw new Error(`${n} 件。フィルタが落ちている疑い（全社は 5,000 件超）`);
  return `pgaCompanies=${n}`;
});

await check('スキーマ検証が両方 true', async () => {
  if (!health) throw new Error('health 未取得');
  if (!health.schema.companyFieldsVerified) throw new Error('Company が不一致');
  if (!health.schema.opportunityFieldsVerified) throw new Error('Opportunity が不一致');
  return 'company / opportunity ともに一致';
});

await check('応答に API キーが含まれない', async () => {
  const r = await get('/api/ops/twenty/health', ADMIN);
  const body = await r.text();
  if (TWENTY_KEY && body.includes(TWENTY_KEY)) throw new Error('キーが含まれている');
  if (/authorization/i.test(body)) throw new Error('Authorization の語が含まれている');
  return 'キー・Authorization ともに無し';
});

await check('応答に顧客データらしき値が含まれない', async () => {
  const r = await get('/api/ops/twenty/health', ADMIN);
  const body = await r.text();
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(body)) throw new Error('UUID が含まれている');
  if (/株式会社|有限会社/.test(body)) throw new Error('社名らしき文字列が含まれている');
  return 'UUID・社名ともに無し';
});

await check('warnings が集計情報だけで構成されている', async () => {
  if (!health) throw new Error('health 未取得');
  const joined = (health.warnings ?? []).join('\n');
  if (/[0-9a-f]{8}-[0-9a-f]{4}-/.test(joined)) throw new Error('UUID が含まれている');
  if (/株式会社/.test(joined)) throw new Error('社名が含まれている');
  return `${health.warnings.length} 件`;
});

let diff = null;
await check('admin で raw-diff が 200', async () => {
  const r = await get('/api/ops/twenty/raw-diff', ADMIN);
  if (r.status !== 200) throw new Error(`status=${r.status}`);
  diff = await r.json();
  return `status=${diff.status}`;
});

await check('raw-diff が件数だけを返す（顧客データを含まない）', async () => {
  const r = await get('/api/ops/twenty/raw-diff', ADMIN);
  const body = await r.text();
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(body)) throw new Error('UUID が含まれている');
  if (/株式会社|有限会社/.test(body)) throw new Error('社名が含まれている');
  return 'UUID・社名ともに無し';
});

await check('Pipeline の Twenty Health が CXM の NocoDB 業務データを import していない', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/app/api/ops/twenty/health/route.ts', 'utf8');
  const bad = ['lib/ptai/store', 'lib/nocodb/'].filter(x => src.includes(x));
  if (bad.length) throw new Error(`NocoDB 依存が残っている: ${bad.join(', ')}`);
  return '認証ガード以外に NocoDB 依存なし';
});

await check('Twenty 読み取り経路（アダプター）が NocoDB を import していない', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = 'src/lib/twenty/adapters';
  const bad = [];
  for (const f of await readdir(dir)) {
    const src = await readFile(`${dir}/${f}`, 'utf8');
    if (src.includes('lib/ptai/store') || src.includes('lib/nocodb/')) bad.push(f);
  }
  const client = await readFile('src/lib/twenty/client.ts', 'utf8');
  if (client.includes('lib/ptai/store') || client.includes('lib/nocodb/')) bad.push('client.ts');
  if (bad.length) throw new Error(`NocoDB 依存がある: ${bad.join(', ')}`);
  return 'client / adapters ともに NocoDB 非依存';
});

await check('NocoDB が落ちても health が動く（データ経路が独立している）', async () => {
  // health は Twenty しか読まない。NocoDB を使うのは認証（staff_identify）だけで、
  // それは Twenty の疎通確認とは別の関心事。
  // ここでは「health の応答に NocoDB 由来の項目が無い」ことで独立を確認する。
  const r = await get('/api/ops/twenty/health', ADMIN);
  const d = await r.json();
  const keys = Object.keys(d).sort();
  const expected = ['checkedAt', 'counts', 'resolvedBaseUrl', 'schema', 'status', 'warnings'];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) throw new Error(`応答の項目が想定と違う: ${keys.join(',')}`);
  return '応答は Twenty 由来の項目のみ';
});

await check('raw-diff は移行確認用と明記されている', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/app/api/ops/twenty/raw-diff/route.ts', 'utf8');
  if (!src.includes('移行確認用の一時ツール')) throw new Error('位置づけの記載が無い');
  for (const w of ['setDoc', 'addDoc', 'deleteDoc']) {
    if (src.includes(w)) throw new Error(`NocoDB への書き込み（${w}）がある`);
  }
  return '一時ツールと明記・書き込みなし';
});

await check('/api/ptai/raw の既定が legacy_nocodb で、Twenty へ切り替え可能', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/lib/twenty/data-source.ts', 'utf8');
  if (!src.includes("DEFAULT_SOURCE: PtaiDataSource = 'legacy_nocodb'")) throw new Error('既定が legacy_nocodb でない');
  const route = await readFile('src/app/api/ptai/raw/route.ts', 'utf8');
  if (!route.includes('buildPtaiRawFromTwenty')) throw new Error('Twenty 経路が無い');
  return '既定は legacy_nocodb。今回は切り替えない';
});

await check('Twenty 経路が pga_docs へ保存しない', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/app/api/ptai/raw/route.ts', 'utf8');
  for (const w of ['setRawSnapshot', 'setDoc', 'addDoc']) {
    if (src.includes(w)) throw new Error(`保存処理（${w}）がある`);
  }
  return '保存処理なし';
});

// ── CXM 保護（今回の変更が PtAI Pipeline に閉じていることの検査）──────────────
//
//   CXM は引き続き NocoDB を主要データストアとして利用する。
//   ここでは「CXM のコードと環境変数に手を付けていない」ことを確認する。

const { execFileSync } = await import('node:child_process');
const gitClean = (...paths) => {
  const out = execFileSync('git', ['status', '--porcelain', '--', ...paths], { encoding: 'utf8' }).trim();
  return out ? out.split('\n').map(l => l.slice(3)) : [];
};

await check('CXM の src/lib/nocodb/** に差分がない', async () => {
  const dirty = gitClean('src/lib/nocodb');
  if (dirty.length) throw new Error(`変更されている: ${dirty.join(', ')}`);
  return '差分なし';
});

await check('CXM 関連ルート（画面・API・バッチ）に差分がない', async () => {
  const dirty = gitClean(
    'src/app/(cxm)/v2', 'src/app/api/company', 'src/app/api/companies',
    'src/app/api/batch', 'src/app/api/home', 'src/lib/salesforce', 'src/lib/notion',
  );
  if (dirty.length) throw new Error(`変更されている: ${dirty.join(', ')}`);
  return '差分なし';
});

await check('共通認証（staff_identify / セッション）に差分がない', async () => {
  const dirty = gitClean('src/lib/auth', 'src/middleware.ts', 'src/app/api/auth');
  if (dirty.length) throw new Error(`変更されている: ${dirty.join(', ')}`);
  return '差分なし。staff_identify は NocoDB のまま';
});

await check('共通認証が従来どおり staff_identify を利用している', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile('src/lib/nocodb/client.ts', 'utf8');
  if (!src.includes('NOCODB_STAFF_IDENTIFY_TABLE_ID')) throw new Error('staff_identify の参照が消えている');
  const r = await get('/api/ops/twenty/health', ADMIN);
  if (r.status !== 200) throw new Error(`認証経由の疎通に失敗 status=${r.status}`);
  return '認証は従来どおり動作';
});

await check('NOCODB_PGA_DOCS_TABLE_ID 以外の NocoDB 設定を削除していない', async () => {
  const { readFile } = await import('node:fs/promises');
  const head = execFileSync('git', ['show', 'HEAD:.env.example'], { encoding: 'utf8' });
  const now  = await readFile('.env.example', 'utf8');
  const keys = t => new Set((t.match(/^NOCODB_[A-Z0-9_]+(?==)/gm) ?? []));
  const removed = [...keys(head)].filter(k => !keys(now).has(k));
  if (removed.length) throw new Error(`削除されている: ${removed.join(', ')}`);
  if (!now.includes('NOCODB_PGA_DOCS_TABLE_ID')) throw new Error('Pipeline 用のキーまで消えている');
  return `${keys(now).size} 件すべて維持`;
});

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗\n`);
if (diff) {
  console.log('  RAW との差分（件数のみ）:');
  console.log(`    企業      Twenty ${diff.companies.twenty} / RAW ${diff.companies.raw} / ID一致 ${diff.companies.matchedById} / Twentyのみ ${diff.companies.onlyInTwenty} / RAWのみ ${diff.companies.onlyInRaw} / 社名一致 ${diff.companies.matchedByNameFallback} / 不一致 ${diff.companies.unmatched}`);
  console.log(`    商談      計 ${diff.opportunities.total} / リレーション ${diff.opportunities.linkedByRelation} / 完全一致 ${diff.opportunities.linkedByExactName} / 部分一致 ${diff.opportunities.linkedByPartialName} / 未紐付 ${diff.opportunities.unlinked}`);
  console.log(`    Note      計 ${diff.notes.total} / noteTargets ${diff.notes.linkedByNoteTargets} / タイトル ${diff.notes.linkedByTitle} / 未紐付 ${diff.notes.unlinked}`);
}
process.exit(fail ? 1 : 0);
