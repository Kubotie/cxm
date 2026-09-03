// ─── GET /api/home/digest ─────────────────────────────────────────────────────
//
// **v2 ホームの「外部の動き」と「バッチ稼働状況」を返す。**
//
// ホームは毎朝いちばん最初に開く画面なので、**取得は保存済みの読み取りだけ**に限る。
//   - 業界ニュース  : industry_intel_cache（週次バッチ cxm_industry_intel が書く）
//   - データ更新状況: project_metrics（日次バッチ cxm_project_metrics が書く）
//
// ⚠️ ここで Web 検索にフォールバックしてはいけない。1社85秒かかる（§実測）。
//    未取得の企業は `coverage.missing` として件数で返し、画面に明示する。
//
// 「今週どこを見るか」は /api/companies/proposal-board が持っている。
// 重い計算を二重に持たないため、ホームはそちらをクライアントから別途叩く。

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllStoredIndustryIntel } from '@/lib/nocodb/industry-intel-cache';
import { fetchMetricsBatchStatus } from '@/lib/nocodb/project-metrics';
import { fetchCompaniesByTiers } from '@/lib/nocodb/companies';
import type { AppCompany } from '@/lib/nocodb/types';

export const revalidate = 300;

/** 1社あたりニュースを何件まで拾うか。1社が多弁だと他社が埋もれる */
const PER_COMPANY = 4;
/** 全体の返却上限 */
const MAX_ITEMS = 120;

export interface HomeNewsItem {
  companyUid:  string;
  companyName: string;
  /** 担当 CSM（companies.owner_name = staff_identify.name2） */
  owner:       string | null;
  tier:        number | null;
  industry:    string | null;
  text:        string;
  sourceUrl:   string | null;
  sourceTitle: string | null;
  /** 情報の時点 "YYYY-MM" / "YYYY"。不明なら null */
  asOf:        string | null;
  /** この企業の業界調査を取得した日時（JST） */
  fetchedAt:   string | null;
  ageDays:     number | null;
}

export interface HomeDigestResponse {
  news: HomeNewsItem[];
  /** 業界名 → その業界のニュース件数（多い順） */
  industries: Array<{ name: string; count: number; companies: number }>;
  /** 担当者の一覧（フィルタ用） */
  owners: string[];
  coverage: {
    /** Tier1–3 の対象社数 */
    target:    number;
    /** 業界調査が保存されている社数 */
    stored:    number;
    /** 7日以内に取得できている社数 */
    fresh:     number;
    /** 一度も取得できていない社数 */
    missing:   number;
    /** 取得に失敗している社数 */
    failed:    number;
    /** いちばん新しい取得時刻（JST） */
    latestAt:  string | null;
    /** いちばん古い取得時刻（JST）。ここが古いと一巡できていない */
    oldestAt:  string | null;
  };
  batch: {
    daily: {
      latestDate: string | null;
      computedAt: string | null;
      rowCount:   number;
      isToday:    boolean;
    };
  };
  generatedAt: string;
}

export async function GET(_req: NextRequest) {
  const [stored, batchDaily, companies] = await Promise.all([
    fetchAllStoredIndustryIntel(500).catch(() => []),
    fetchMetricsBatchStatus().catch(() => ({
      latestDate: null, computedAt: null, rowCount: 0, isToday: false,
    })),
    fetchCompaniesByTiers([1, 2, 3], 600).catch(() => []),
  ]);

  // company_uid → 担当 / Tier。ニュースを「自分の担当だけ」に絞れるようにする
  const meta = new Map<string, AppCompany>(companies.map(c => [c.id, c] as const));

  const news: HomeNewsItem[] = [];
  for (const row of stored) {
    const trends = row.intel?.trends ?? [];
    const c = meta.get(row.companyUid);
    for (const t of trends.slice(0, PER_COMPANY)) {
      if (!t.text?.trim()) continue;
      news.push({
        companyUid:  row.companyUid,
        companyName: row.companyName ?? c?.name ?? row.companyUid,
        owner:       c?.owner ?? null,
        tier:        c?.tier ?? null,
        industry:    row.industryName,
        text:        t.text.trim(),
        sourceUrl:   t.sourceUrl ?? null,
        sourceTitle: t.sourceTitle ?? null,
        asOf:        t.asOf ?? null,
        fetchedAt:   row.fetchedAt,
        ageDays:     row.ageDays,
      });
    }
  }

  // 新しい話題を上に。asOf（情報の時点）が主、次いで取得日時。
  // asOf 不明は下げる（出典ポリシー上は残っていないはずだが、保険）。
  news.sort((a, b) => {
    const ax = a.asOf ?? '', bx = b.asOf ?? '';
    if (ax !== bx) return bx.localeCompare(ax);
    return (b.fetchedAt ?? '').localeCompare(a.fetchedAt ?? '');
  });

  // **同じ企業の話題を連続させない。**
  // 素直に日付順に並べると、1社の4件が固まって上位を占め、
  // 「担当顧客の業界で何が起きているか」を眺める用途に使えなくなる（実測）。
  // 企業ごとの順序（＝新しい順）は保ったまま、1件ずつ回して混ぜる。
  const interleaved = roundRobinByCompany(news);

  // 業界の束ね。同じ業界の企業が複数いるとき、何社分の話かも出す
  const byIndustry = new Map<string, { count: number; companies: Set<string> }>();
  for (const n of interleaved) {
    const key = n.industry?.trim();
    if (!key) continue;
    const e = byIndustry.get(key) ?? { count: 0, companies: new Set<string>() };
    e.count++; e.companies.add(n.companyUid);
    byIndustry.set(key, e);
  }

  const fetchedAts = stored.map(s => s.fetchedAt).filter((v): v is string => Boolean(v)).sort();

  const res: HomeDigestResponse = {
    news: interleaved.slice(0, MAX_ITEMS),
    industries: Array.from(byIndustry.entries())
      .map(([name, e]) => ({ name, count: e.count, companies: e.companies.size }))
      .sort((a, b) => b.count - a.count),
    owners: Array.from(new Set(companies.map(c => c.owner).filter((v): v is string => Boolean(v)))).sort(),
    coverage: {
      target:  companies.length,
      stored:  stored.length,
      fresh:   stored.filter(s => s.ageDays != null && s.ageDays <= 7).length,
      missing: Math.max(0, companies.length - stored.length),
      failed:  stored.filter(s => s.error).length,
      latestAt: fetchedAts.at(-1) ?? null,
      oldestAt: fetchedAts[0] ?? null,
    },
    batch: { daily: batchDaily },
    generatedAt: new Date(Date.now() + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16),
  };

  return NextResponse.json(res);
}

/**
 * 企業ごとにまとめてから1件ずつ取り出して混ぜる。
 * 企業内の並び（新しい順）は保つ。企業の登場順は最初に現れた順。
 */
function roundRobinByCompany(items: HomeNewsItem[]): HomeNewsItem[] {
  const buckets = new Map<string, HomeNewsItem[]>();
  for (const n of items) {
    const arr = buckets.get(n.companyUid);
    if (arr) arr.push(n); else buckets.set(n.companyUid, [n]);
  }
  const queues = Array.from(buckets.values());
  const out: HomeNewsItem[] = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const q of queues) {
      const item = q[round];
      if (item) { out.push(item); added = true; }
    }
    if (!added) break;
  }
  return out;
}
