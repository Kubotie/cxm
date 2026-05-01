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

const ALL_UIDS = [
  "sf_0017F00001hnsiXQAQ", "sf_0017F00001JMLA1QAP", "sf_0017F00000TEOWIQA5",
  "sf_0017F00001X6D8mQAF", "sf_001Q900000amU8kIAE", "sf_0017F00002MUdGDQA1",
  "sf_0017F00000WicuBQAR", "sf_0017F00001cXjDeQAK", "sf_0017F00001cY4FEQA0",
  "sf_0017F00000TExdGQAT", "sf_0017F00002i1mpdQAA", "sf_001Q900000B0JE1IAN",
  "sf_0017F00002MU2VrQAL", "sf_0017F00001hn9v1QAA", "sf_0017F00000TEOHAQA5",
  "sf_0017F00000svlCIQAY", "sf_0017F00001ZtqLQQAZ", "sf_001Q9000009ZYw5IAG",
  "sf_0017F000011mBBOQA2", "sf_001A7000002POsvIAG", "sf_0017F00000fdBIAQA2",
  "sf_0017F00000TEOSoQAP", "sf_0017F00001GidRhQAJ", "sf_0017F00002cuwrRQAQ",
  "sf_0017F00000TEOQ0QAP", "sf_0017F00000TEOXnQAP", "sf_0017F00000TF1IlQAL",
  "sf_001Q900000OxFADIA3", "sf_001A7000005qEBEIA2", "sf_0017F00001KAaIXQA1",
  "sf_0017F00000UitdXQAR", "sf_0017F00000fgIEBQA2", "sf_0017F00000UiwVgQAJ",
  "sf_0017F00001iYGm2QAG", "sf_0017F00001kB0hpQAC", "sf_0017F00002PYxycQAD",
  "sf_001A7000004ibcdIAA", "sf_0017F00000TEORaQAP", "sf_0017F00000q7JOsQAM",
  "sf_0017F00001cXkJbQAK", "sf_0017F00001z435ZQAQ", "sf_001A7000002gNNYIA2",
  "sf_0017F00001GkuqwQAB", "sf_0017F00000TEON9QAP", "sf_0017F00000mEvVrQAK",
  "sf_0017F00000TEOXyQAP", "sf_0017F00000TEOMqQAP", "sf_0017F00000TEOJEQA5",
  "sf_0017F00001KBxeGQAT", "sf_001Q900000n0adZIAQ", "sf_001A7000004J3nJIAS",
  "sf_001Q900000yFa0cIAC", "sf_0017F00003DoliBQAR", "sf_0017F00002cwD2AQAU",
  "sf_001Q900000eAv7dIAC", "sf_001Q900000C2CvpIAF", "sf_001A7000003Fp43IAC",
  "sf_0017F00002cwBDsQAM", "sf_001Q9000006HYt6IAG", "sf_001Q900000GWSZSIA5",
  "sf_0017F00002x7V3tQAE", "sf_0017F00000otHNtQAM", "sf_0017F00001sf7YjQAI",
  "sf_0017F00000TEOQeQAP", "sf_001Q900000xlsnoIAA", "sf_0017F00003DqIh6QAF",
  "sf_0017F00002wpR5xQAE", "sf_001Q900000CfohtIAB", "sf_001A7000006YuKjIAK",
  "sf_001Q900000HkmCjIAJ", "sf_001Q9000008TWI1IAO", "sf_0017F00000TEOJ6QAP",
  "sf_0017F00000TEOWLQA5", "sf_001A7000004AjOyIAK", "sf_001Q900000sa86bIAA",
  "sf_0017F00000qD5fqQAC", "sf_001Q900001DVH1NIAX", "sf_001Q900000FsoNPIAZ",
  "sf_001A7000002g7HxIAI", "sf_0017F00002PYzPEQA1", "sf_0017F00000qwfZHQAY",
  "sf_001Q900000ibmVpIAI", "sf_001A7000002RNl9IAG", "sf_001Q9000004Bu7sIAC",
  "sf_0017F00000TEOWSQA5", "sf_001Q900000pGhbVIAS", "sf_0017F00001mxbblQAA",
  "sf_001A7000003ihpDIAQ", "sf_0017F00000TEONAQA5", "sf_001A7000004mhZgIAI",
  "sf_0017F00002jqaEjQAI", "sf_0017F00002MUdCNQA1", "sf_001A7000002ruPWIAY",
  "sf_001A7000003o98tIAA", "sf_001Q9000003XsG3IAK", "sf_001Q900000p2YEmIAM",
  "sf_0017F00003DoIMhQAN", "sf_001Q900000gWXDaIAO", "sf_001A7000004y4L2IAI",
  "sf_001Q900000tHQjBIAW",
];

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
