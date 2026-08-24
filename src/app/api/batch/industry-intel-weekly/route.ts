// ─── GET/POST /api/batch/industry-intel-weekly ────────────────────────────────
//
// **外部情報（市場・業界）の週次事前取得。**
//
// 業界調査は Web検索 + LLM で1社あたり数十秒かかる。
// これまでプロセス内キャッシュだけで、再起動やインスタンス切替のたびに消え、
// 顧客情報タブを開くたびに再検索していた。
//
// 外部情報は日次で変わるものではないので、週1で取って NocoDB に保存する。
// 画面は保存済みを読む（手動更新の導線は残す）。
//
// ⚠️ **1社あたり約85秒**（実測 2026-08-22 / 2社170秒）。
//   制約は総時間ではなく **1回の関数実行が最大300秒** という点だけ。
//   1回で全社は回れないので、**短い間隔で何度も呼んで古い順に埋める**。
//   1回の実行では時間の許すかぎり処理する（既定で240秒まで＝約2〜3社）。
//
//   土日月の朝（JST 06:00-12:00）に10分間隔で走らせると、
//   1朝あたり 36回 × 約2.8社 ≒ 100社。**3朝で Tier1–3 を十分に一巡できる。**
//
//   ?tiers=1,2     対象Tier（既定 1,2）
//   ?limit=N       1回の処理社数の上限（既定なし。時間で止まる）
//   ?budgetSec=N   1回の実行に使う秒数（既定 240 / 上限 280）
//   ?maxAgeDays=N  この日数より新しいものは飛ばす（既定 7）

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import { fetchIndustryIntel } from '@/lib/company/industry-intel';
import {
  saveIndustryIntel, fetchStoredIndustryIntel, isIndustryCacheEnabled,
} from '@/lib/nocodb/industry-intel-cache';

export const maxDuration = 300;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  // 外部スケジューラ（DolphinScheduler）からも叩くため、必ず認証する。
  // CRON_SECRET / SUPPORT_BATCH_SECRET のいずれかを Bearer で要求する。
  const unauthorized = checkCronOrBatchAuth(req);
  if (unauthorized) return unauthorized;

  if (!isIndustryCacheEnabled()) {
    return NextResponse.json(
      { error: 'NOCODB_INDUSTRY_INTEL_TABLE_ID が未設定です' }, { status: 501 },
    );
  }

  const started = Date.now();
  const tiersParam = req.nextUrl.searchParams.get('tiers') ?? '1,2';
  const tiers = tiersParam.split(',')
    .map(v => Number(v.trim()))
    .filter((v): v is 1 | 2 | 3 | 5 => [1, 2, 3, 5].includes(v));
  // 既定では件数で切らず、時間の許すかぎり処理する。
  // 固定件数だと、速い日は時間を余らせ、遅い日は途中で切れる。
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '0') || 0;
  const budgetSec = Math.min(
    Number(req.nextUrl.searchParams.get('budgetSec') ?? '240') || 240,
    280,
  );
  const maxAgeDays = Number(req.nextUrl.searchParams.get('maxAgeDays') ?? '7') || 7;

  const companies = await fetchCompaniesByTiers(tiers, 500).catch(() => []);

  // **古い順に処理する。** 1回で全社は回れないので、
  // 毎日走らせて未取得・古いものから順に埋めていく。
  const withAge = await Promise.all(companies.map(async c => ({
    c,
    age: (await fetchStoredIndustryIntel(c.id).catch(() => ({ ageDays: null }))).ageDays,
  })));
  const stale = withAge
    .filter(x => x.age === null || x.age >= maxAgeDays)
    .sort((a, b) => (b.age ?? 9999) - (a.age ?? 9999));

  const queue = (limit > 0 ? stale.slice(0, limit) : stale).map(x => x.c);
  const staleTotal = stale.length;

  let ok = 0, failed = 0, trends = 0;
  const errors: string[] = [];

  // 1社ずつ順に。Web検索APIのレート制限とコスト暴走を避けるため並列にしない
  let processed = 0;
  for (const c of queue) {
    // 次の1社（約85秒）が予算内に収まらないなら、そこで止める。
    // 途中まででも保存されているので、次の起動が続きから拾う。
    const elapsed = (Date.now() - started) / 1000;
    if (elapsed > budgetSec - 90) break;
    processed++;
    try {
      const intel = await fetchIndustryIntel({
        companyName: c.name,
        domain: c.companyDomain ?? undefined,
        force: true,   // 週次なので必ず取り直す
      });
      await saveIndustryIntel({ companyUid: c.id, companyName: c.name, intel });
      trends += intel.trends?.length ?? 0;
      ok++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await saveIndustryIntel({ companyUid: c.id, companyName: c.name, intel: null, error: msg })
        .catch(() => undefined);
      if (errors.length < 5) errors.push(`${c.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    tiers,
    /** 今回処理した社数（時間の許すかぎり） */
    processed,
    saved: ok, failed, trends,
    /** 対象だった社数 */
    staleTotal,
    /** まだ古いまま残っている社数。0 になるまで走り続ける */
    remaining: staleTotal - processed,
    budgetSec,
    errors,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  });
}
