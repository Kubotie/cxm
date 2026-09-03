// ─── GET/POST /api/batch/company-profile-weekly ───────────────────────────────
//
// **顧客理解プロファイルの週次事前生成。**
//
// 顧客理解は議事録8件の本文＋利用実態＋外部情報を読ませる LLM 生成で、
// 1社あたり30秒前後かかる。都度生成では顧客情報タブを開くたびに待たされるため、
// 週1で作って company_profile_cache に保存し、画面は保存済みを読む。
//
// 制約は総時間ではなく **1回の関数実行が最大300秒**（Vercel のプラン上限）。
// 1回で全社は回れないので、**古い順に埋めて何度も呼ぶ**。
// DolphinScheduler 側で remaining が 0 になるまでループさせる
// （cxm_industry_intel と同じ作り。docs-src/cxm_v2/18_DolphinScheduler_Batch.md）。
//
//   ?tiers=1,2,3   対象Tier（既定 1,2,3）
//   ?limit=N       1回の処理社数の上限（既定なし。時間で止まる）
//   ?budgetSec=N   1回の実行に使う秒数（既定 240 / 上限 280）
//   ?maxAgeDays=N  この日数より新しいものは飛ばす（既定 7）

import { NextRequest, NextResponse } from 'next/server';
import { checkCronOrBatchAuth } from '@/lib/batch/auth';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import { fetchProfileAges, isProfileCacheEnabled } from '@/lib/nocodb/company-profile-cache';

export const maxDuration = 300;

/**
 * 1社あたりの見込み秒数。次の1社が予算内に収まらなければ止める。
 * 実測: 本番43秒 / ローカル127秒（議事録の量で振れる。2026-08-24）。
 * 短く見積もると、開始した社が外側の300秒に間に合わず丸ごと無駄になるため、
 * 本番実測の倍を取る。
 */
const PER_COMPANY_SEC = 90;

export async function GET(req: NextRequest)  { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const unauthorized = checkCronOrBatchAuth(req);
  if (unauthorized) return unauthorized;

  if (!isProfileCacheEnabled()) {
    return NextResponse.json(
      { error: 'NOCODB_COMPANY_PROFILE_TABLE_ID が未設定です' }, { status: 501 },
    );
  }

  const started = Date.now();
  const sp = req.nextUrl.searchParams;
  const tiers = (sp.get('tiers') ?? '1,2,3').split(',')
    .map(v => Number(v.trim()))
    .filter((v): v is 1 | 2 | 3 | 5 => [1, 2, 3, 5].includes(v));
  const limit      = Number(sp.get('limit') ?? '0') || 0;
  const budgetSec  = Math.min(Number(sp.get('budgetSec') ?? '240') || 240, 280);
  const maxAgeDays = Number(sp.get('maxAgeDays') ?? '7') || 7;

  const companies = await fetchCompaniesByTiers(tiers, 500).catch(() => []);

  // 生成日時は1回のクエリでまとめて引く。
  // 1社ずつ問い合わせると、対象を決めるだけで予算を食う（industry 版で踏んだ）。
  const ages = await fetchProfileAges().catch(() => new Map<string, number | null>());

  const stale = companies
    .map(c => ({ c, age: ages.has(c.id) ? ages.get(c.id)! : null }))
    .filter(x => x.age === null || x.age >= maxAgeDays)
    .sort((a, b) => (b.age ?? 9999) - (a.age ?? 9999));

  const queue = (limit > 0 ? stale.slice(0, limit) : stale).map(x => x.c);
  const staleTotal = stale.length;

  // 自分の API を叩く。生成ロジックは profile ルートが正本で、二重実装しない。
  const origin = req.nextUrl.origin;
  const token  = req.headers.get('authorization') ?? '';

  let ok = 0, failed = 0, processed = 0;
  const errors: string[] = [];

  for (const c of queue) {
    const elapsed = (Date.now() - started) / 1000;
    if (elapsed > budgetSec - PER_COMPANY_SEC) break;
    processed++;
    try {
      // refresh=1 で作り直して保存させる。業界トレンドは週次の別バッチが持つので触らない
      const res = await fetch(`${origin}/api/company/${c.id}/profile?refresh=1`, {
        headers: token ? { authorization: token } : undefined,
        cache: 'no-store',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      ok++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      if (errors.length < 5) errors.push(`${c.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    tiers,
    processed,
    saved: ok,
    failed,
    staleTotal,
    /** まだ古いまま残っている社数。0 になるまで走り続ける */
    remaining: staleTotal - processed,
    budgetSec,
    errors,
    elapsedSec: Math.round((Date.now() - started) / 1000),
  });
}
