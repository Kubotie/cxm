// ─── CSM管理全社 AI Summary 一括実行スクリプト ────────────────────────────────
// 使い方: node scripts/bulk-company-summary.mjs [--dry-run] [--base-url=http://...]
//          node scripts/bulk-company-summary.mjs --resume=30  # 30社目から再開
//
// 動作:
//   1. 各社に POST /api/company/[uid]/summary/regenerate を順次呼ぶ
//   2. 1社ずつ処理することでHTTPタイムアウトを回避
//   3. 全結果をまとめて表示

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── CLI 引数 ──────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const baseUrl = args.find(a => a.startsWith('--base-url='))?.split('=')[1]
  ?? 'http://localhost:3000';
const resumeFrom = parseInt(args.find(a => a.startsWith('--resume='))?.split('=')[1] ?? '0', 10);

// 並列数（APIのrate limitとサーバー負荷に応じて調整）
const CONCURRENCY    = 3;
const REQUEST_TIMEOUT = 120_000; // 1社あたり2分タイムアウト

// ── 対象 UID（NocoDB is_csm_managed=true 全100社）────────────────────────────

// ── 対象 UID ──────────────────────────────────────────────────────────────────
//
// 2026-09-30 セキュリティ是正: 実顧客の Salesforce Account ID を
// public リポジトリのソースに直書きしていたため、ローカルのファイルへ移した。
//   scripts/.bulk-targets.json  … string[] 形式の UID 一覧（.gitignore 済み）
// 別のファイルを使うときは --targets=<path> を指定する。

const targetsPath = args.find(a => a.startsWith('--targets='))?.split('=')[1]
  ?? join(__dir, '.bulk-targets.json');

let ALL_UIDS;
try {
  ALL_UIDS = JSON.parse(readFileSync(targetsPath, 'utf8'));
  if (!Array.isArray(ALL_UIDS) || !ALL_UIDS.length) throw new Error('配列が空です');
} catch (err) {
  console.error(
    `対象 UID の一覧を読めませんでした: ${targetsPath}\n` +
    `  ${err.message}\n` +
    `  ["sf_xxxx", ...] 形式の JSON を置くか、--targets=<path> で指定してください。`,
  );
  process.exit(1);
}


// ── 1社処理 ───────────────────────────────────────────────────────────────────

async function processOne(uid, index, total) {
  if (dryRun) {
    console.log(`  [${index+1}/${total}] DRY-RUN ${uid}`);
    return { uid, status: 'dry-run' };
  }

  const url = `${baseUrl}/api/company/${uid}/summary/regenerate`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 409) {
      console.log(`  [${index+1}/${total}] ⏭  SKIP (approved) ${uid}`);
      return { uid, status: 'skipped', reason: 'approved' };
    }
    if (!res.ok) {
      const reason = json.error ?? json.message ?? `HTTP ${res.status}`;
      console.log(`  [${index+1}/${total}] ✗  FAIL ${uid} — ${reason}`);
      return { uid, status: 'failed', reason };
    }

    const health = json.overall_health ?? '?';
    console.log(`  [${index+1}/${total}] ✓  OK   ${uid} [${health}]`);
    return { uid, status: 'ok', overall_health: health };

  } catch (e) {
    const reason = e?.message ?? String(e);
    console.log(`  [${index+1}/${total}] ✗  FAIL ${uid} — ${reason}`);
    return { uid, status: 'failed', reason };
  }
}

// ── 並列制御付き実行 ──────────────────────────────────────────────────────────

async function runWithConcurrency(uids, concurrency) {
  const results = new Array(uids.length);
  let cursor = 0;

  async function worker() {
    while (cursor < uids.length) {
      const i   = cursor++;
      results[i] = await processOne(uids[i], i, uids.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ── メイン ────────────────────────────────────────────────────────────────────

async function main() {
  const targets = resumeFrom > 0 ? ALL_UIDS.slice(resumeFrom) : ALL_UIDS;

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  CSM全社 AI Summary 一括実行`);
  console.log(`  対象: ${targets.length}社 (全${ALL_UIDS.length}社${resumeFrom > 0 ? ` / ${resumeFrom}社目から再開` : ''})`);
  console.log(`  並列数: ${CONCURRENCY} / エンドポイント: ${baseUrl}`);
  console.log(`  モード: ${dryRun ? 'DRY RUN（書き込みなし）' : '本番実行'}`);
  console.log('═══════════════════════════════════════════════════════');

  const t0 = Date.now();
  const results = await runWithConcurrency(targets, CONCURRENCY);

  const ok      = results.filter(r => r.status === 'ok').length;
  const failed  = results.filter(r => r.status === 'failed');
  const skipped = results.filter(r => r.status === 'skipped').length;
  const elapsed = ((Date.now() - t0) / 1000 / 60).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  完了サマリー');
  console.log(`  success : ${ok}`);
  console.log(`  failed  : ${failed.length}`);
  console.log(`  skipped : ${skipped} (approved)`);
  console.log(`  経過時間: ${elapsed}分`);
  if (failed.length > 0) {
    console.log('\n  失敗一覧:');
    for (const f of failed) console.log(`    - ${f.uid}: ${f.reason}`);
  }
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(e => { console.error(e); process.exit(1); });
