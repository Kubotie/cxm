// ─── GET /api/company/[companyUid]/profile ────────────────────────────────────
//
// 顧客理解プロファイルを生成する。担当者が商談前に読む「この顧客に何が起きているか」。
//
// 設計根拠: docs-src/cxm_v2/17_WHO_WHAT_Matching_Plan.md §11 / §15 / §16
//
// 材料（すべて出典付きで LLM に渡す）:
//   外部シグナル … company_external_intel（IR/組織/求人/競合）
//   議事録       … log_notion_minutes の本文
//   利用実態     … Metabase project-signals（キャンペーン/ヒートマップ/PV/習慣化）
//   サポート     … オープン件数・代替可能性の認知
//   契約         … MRR / 更新時期 / プラン
//
// 業界トレンド（市場・業界セクションの材料）:
//   個社の材料からは業界全体の動きは分からないため、Web 検索で別途集める（industry-intel.ts）。
//   コストがかかるので既定ではキャッシュのみ参照し、?industry=refresh で明示的に取得する。
//
// **生成結果は company_profile_cache に保存し、既定では保存済みを返す。**
//   1社30秒かかるため、都度生成では顧客情報タブを開くたびに30秒待たされていた。
//   ?refresh=1        … 作り直して保存する（担当者が「更新」を押したとき）
//   ?industry=refresh … 業界トレンドも取り直す（Web検索。さらに時間がかかる）
//   週次バッチ /api/batch/company-profile-weekly が古い順に埋める。

import { NextResponse } from 'next/server';
import { fetchCompanyByUid } from '@/lib/nocodb/companies';
import { fetchProjectsByCompany } from '@/lib/nocodb/project-info';
import { fetchNotionMinutes } from '@/lib/nocodb/communication-logs';
import { fetchSupportAggregateForCompany } from '@/lib/nocodb/support-by-company';
import { fetchLatestSnapshot } from '@/lib/nocodb/company-snapshot';
import { fetchProjectSignalMap } from '@/lib/metabase/project-signals';
import { fetchExternalIntel } from '@/lib/nocodb/external-intel';
import {
  fetchIndustryIntel, getCachedIndustryIntel, SOURCE_POLICY, type IndustryIntel,
} from '@/lib/company/industry-intel';
import {
  fetchStoredIndustryIntel, saveIndustryIntel,
} from '@/lib/nocodb/industry-intel-cache';
import { fetchStoredProfile, saveProfile } from '@/lib/nocodb/company-profile-cache';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';
import { EXTERNAL_SIGNAL_META, type ExternalSignalItem } from '@/lib/company/external-signal';
import {
  COMPANY_PROFILE_SYSTEM_PROMPT,
  COMPANY_PROFILE_TOOL,
  PROFILE_SECTIONS,
  buildProfileUserPrompt,
  type CompanyProfileResult,
  type ProfileEvidence,
} from '@/lib/prompts/company-profile';

// 生成は議事録8件の本文を読ませるため長い（ローカル実測 127秒 / 2026-08-24）。
// 120秒では途中で切れるため上限（このプランの最大は300秒）まで上げる。
export const maxDuration = 300;

/** 議事録は新しいものから何件読むか（本文を渡すため多すぎない範囲で） */
const MINUTES_LIMIT = 8;
/** 議事録1件あたりの本文上限 */
const MINUTES_BODY_CHARS = 2_500;

// ── レスポンス型 ──────────────────────────────────────────────────────────────

export interface ProfileSectionVM {
  key:     string;
  title:   string;
  bullets: Array<{
    text: string;
    /** 実体化した出典（UI でそのまま並べる） */
    evidence: Array<{
      id: string; kind: string; label: string;
      url: string | null; date: string | null;
      /** 情報の時点（外部記事の公開時期）。鮮度の表示に使う */
      asOf: string | null;
    }>;
  }>;
}

export interface CompanyProfileResponse {
  companyUid:  string;
  companyName: string;
  tier:        number | null;
  headline:    string;
  sections:    ProfileSectionVM[];
  unknowns:    string[];
  /** 生成に使った材料の件数（透明性のため） */
  evidenceCounts: Record<string, number>;
  /** 業界トレンドの取得状況（UI で「業界を調べる」ボタンの出し分けに使う） */
  industry: {
    name:      string | null;
    trendCount: number;
    fetchedAt: string | null;
    sources:   Array<{ url: string; title: string }>;
    /** 出典ポリシーで除外した件数（なぜ少ないかを UI に伝える） */
    excluded:  IndustryIntel['excluded'] | null;
    /** 採用条件（UI に明示する） */
    policy: {
      maxAgeMonths:     number;
      allowUnknownDate: boolean;
      keepDeadLinks:    boolean;
    };
  };
  generatedAt: string;
  /** 保存済みを返したか。false = このリクエストで生成した */
  fromCache: boolean;
  /** 生成からの経過日数。fromCache のときだけ入る */
  ageDays: number | null;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ companyUid: string }> },
) {
  const { companyUid } = await params;
  const sp = new URL(req.url).searchParams;
  // industry=refresh のときだけ業界トレンドを取りに行く（Web検索のコストがかかるため）
  const refreshIndustry = sp.get('industry') === 'refresh';
  // refresh=1 / industry=refresh は作り直し。それ以外は保存済みを返す
  const forceRegenerate = sp.get('refresh') === '1' || refreshIndustry;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid が指定されていません' }, { status: 400 });
  }

  // ── 保存済みを返す（既定）──────────────────────────────────────────────
  // 生成は1社30秒かかる。**開くたびに待たせない**ことを優先し、
  // 古さは fromCache / ageDays で返して画面に出す（黙って古いものを出さない）。
  if (!forceRegenerate) {
    const cached = await fetchStoredProfile<CompanyProfileResponse>(companyUid)
      .catch(() => ({ profile: null, generatedAt: null, ageDays: null }));
    if (cached.profile) {
      return NextResponse.json({
        ...cached.profile,
        fromCache: true,
        ageDays:   cached.ageDays,
      } satisfies CompanyProfileResponse);
    }
  }

  const [company, projects, minutes, support, snapshot, signalMap, intel] = await Promise.all([
    fetchCompanyByUid(companyUid).catch(() => null),
    fetchProjectsByCompany(companyUid).catch(() => []),
    fetchNotionMinutes(companyUid, MINUTES_LIMIT).catch(() => []),
    fetchSupportAggregateForCompany(companyUid).catch(() => null),
    fetchLatestSnapshot(companyUid).catch(() => null),
    fetchProjectSignalMap().catch(() => new Map()),
    fetchExternalIntel(companyUid).catch(() => [] as ExternalSignalItem[]),
  ]);

  if (!company) {
    return NextResponse.json({ error: `企業が見つかりません: ${companyUid}` }, { status: 404 });
  }

  // ── 業界トレンド（市場・業界セクションの材料）────────────────────────────
  // 既定はキャッシュのみ。無ければ market セクションは空になる（個社材料から推測させない）
  //
  // ⚠️ ここは以前、保存済みを読んだ直後に `else` 側の
  //    `getCachedIndustryIntel()` で**上書きして捨てていた**（2026-08-24 修正）。
  //    週次バッチが集めた業界トレンドが画面に出ないまま「業界トレンドを調べる」が
  //    表示され続ける状態だった。分岐を1本にまとめて再発しないようにする。
  let industry: IndustryIntel | null = null;
  if (refreshIndustry) {
    industry = await fetchIndustryIntel({
      companyName: company.name,
      // ドメインは業界特定の精度を上げるので渡す（companies.company_domain）
      domain:      company.companyDomain,
      force:       true,
    }).catch(() => null);
    if (industry) {
      await saveIndustryIntel({ companyUid, companyName: company.name, intel: industry })
        .catch(() => undefined);
    }
  } else {
    const stored = await fetchStoredIndustryIntel(companyUid).catch(
      () => ({ intel: null, fetchedAt: null, ageDays: null }),
    );
    industry = stored.intel ?? getCachedIndustryIntel(company.name);
  }

  // ── 材料の組み立て（ID を振る）──────────────────────────────────────────
  const evidences: ProfileEvidence[] = [];
  let seq = 0;
  const nextId = () => `E${++seq}`;

  // 業界トレンド（業界全体の話。個社の材料と混ざらないよう先頭に置く）
  for (const t of industry?.trends ?? []) {
    evidences.push({
      id:    nextId(),
      kind:  '業界',
      label: t.sourceTitle ?? industry?.industry ?? '業界トレンド',
      url:   t.sourceUrl,
      date:  null,
      asOf:  t.asOf,
      body:  t.asOf ? `${t.text}（${t.asOf}時点の情報）` : t.text,
    });
  }

  // 外部シグナル
  for (const s of intel) {
    if (s.dismissed) continue;
    evidences.push({
      id:    nextId(),
      kind:  '外部情報',
      label: `${EXTERNAL_SIGNAL_META[s.signalId]?.label ?? s.signalId}｜${s.sourceRef ?? s.sourceUrl ?? ''}`,
      url:   s.sourceUrl,
      date:  s.occurredAt,
      body:  `${s.headline}\n引用: ${s.excerpt}`,
    });
  }

  // 契約・健全性
  if (snapshot) {
    evidences.push({
      id:    nextId(),
      kind:  '契約',
      label: `日次スナップショット ${snapshot.snapshot_date}`,
      url:   null,
      date:  snapshot.snapshot_date,
      body: [
        snapshot.mrr != null ? `MRR ${Math.round(snapshot.mrr).toLocaleString('ja-JP')}円` : null,
        snapshot.renewal_date ? `契約更新 ${snapshot.renewal_date}（残 ${snapshot.renewal_bucket}）` : null,
        snapshot.overall_health ? `健全性 ${snapshot.overall_health}` : null,
        snapshot.m_phase ? `CSMフェーズ ${snapshot.m_phase}` : null,
      ].filter(Boolean).join(' / '),
    });
  }

  // 利用実態（プロジェクト単位）
  const paidProjects = projects.filter(p => p.paidType !== 'FREE');
  for (const p of paidProjects) {
    const sig = signalMap.get(p.id);
    if (!sig) continue;
    const pvRate = sig.pvCeiling && sig.monthPvCount != null
      ? Math.round((sig.monthPvCount / sig.pvCeiling) * 100) : null;
    evidences.push({
      id:    nextId(),
      kind:  '利用実態',
      label: `Metabase 利用シグナル｜${p.name || sig.projectName}`,
      url:   null,
      date:  sig.lastActiveDate,
      body: [
        `契約種別 ${p.paidType ?? '不明'}`,
        `稼働キャンペーン ${sig.runningCampaignWithGoalCount}本`,
        `ヒートマップ実施 ${sig.heatmapCount}件`,
        `過去30日アクティブ ${sig.l30Active}`,
        pvRate != null ? `PV消化率 ${pvRate}%（${sig.monthPvCount?.toLocaleString('ja-JP')} / ${sig.pvCeiling?.toLocaleString('ja-JP')}）` : null,
        p.habituationStatus === true ? '習慣化 あり' : p.habituationStatus === false ? '習慣化 なし' : null,
        sig.lastActiveDate ? `最終活動 ${sig.lastActiveDate}` : null,
      ].filter(Boolean).join(' / '),
    });
  }

  // サポート
  if (support) {
    const open = support.openIntercomCount + support.openCseCount;
    evidences.push({
      id:    nextId(),
      kind:  'サポート',
      label: 'Intercom / CSE チケット集計',
      url:   null,
      date:  null,
      body: [
        `オープン ${open}件（Intercom ${support.openIntercomCount} / CSE ${support.openCseCount}）`,
        support.waitingCseCount ? `顧客回答待ち ${support.waitingCseCount}件` : null,
        support.criticalCount ? `重大度critical ${support.criticalCount}件` : null,
        `直近90日のオープン ${support.recentOpenCount}件`,
      ].filter(Boolean).join(' / '),
    });
  }

  // 議事録（本文）
  for (const m of minutes) {
    if (!m.body?.trim()) continue;
    evidences.push({
      id:    nextId(),
      kind:  '議事録',
      label: m.title,
      url:   null,
      date:  m.meetingDate,
      body:  m.body.slice(0, MINUTES_BODY_CHARS),
    });
  }

  if (evidences.length === 0) {
    return NextResponse.json(
      { error: '顧客理解を書くための材料がありません。議事録・利用実態・外部情報のいずれかが必要です。' },
      { status: 422 },
    );
  }

  // ── 生成 ────────────────────────────────────────────────────────────────
  let result: CompanyProfileResult;
  try {
    const client = getAnthropicClient();
    const completion = await client.chat.completions.create({
      model: getAnthropicModel(),
      max_tokens: 6000,
      tools: [COMPANY_PROFILE_TOOL],
      tool_choice: { type: 'function', function: { name: 'write_company_profile' } },
      messages: [
        { role: 'system', content: COMPANY_PROFILE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildProfileUserPrompt({
            companyName: company.name,
            tier:        company.tier,
            evidences,
            today:       new Date().toISOString().slice(0, 10),
          }),
        },
      ],
    });

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('生成のツール呼び出しが返りませんでした');
    }
    result = JSON.parse(toolCall.function.arguments) as CompanyProfileResult;
  } catch (e) {
    return NextResponse.json(
      { error: `顧客理解の生成に失敗しました: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // ── 出典を実体化 ────────────────────────────────────────────────────────
  const byId = new Map(evidences.map(e => [e.id, e]));
  const sections: ProfileSectionVM[] = PROFILE_SECTIONS.map(def => {
    const found = (result.sections ?? []).find(s => s.key === def.key);
    return {
      key:   def.key,
      title: def.title,
      bullets: (found?.bullets ?? []).map(b => ({
        text: b.text,
        evidence: (b.evidence_refs ?? [])
          .map(ref => byId.get(ref))
          .filter((e): e is ProfileEvidence => e !== undefined)
          .map(e => ({
            id: e.id, kind: e.kind, label: e.label,
            url: e.url, date: e.date, asOf: e.asOf ?? null,
          })),
      })),
    };
  });

  const evidenceCounts: Record<string, number> = {};
  for (const e of evidences) evidenceCounts[e.kind] = (evidenceCounts[e.kind] ?? 0) + 1;

  const body: CompanyProfileResponse = {
    companyUid,
    companyName: company.name,
    tier:        company.tier,
    headline:    result.headline ?? '',
    sections,
    unknowns:    result.unknowns ?? [],
    evidenceCounts,
    industry: {
      name:       industry?.industry ?? null,
      trendCount: industry?.trends.length ?? 0,
      fetchedAt:  industry?.fetchedAt ?? null,
      sources:    industry?.sources ?? [],
      excluded:   industry?.excluded ?? null,
      policy: {
        maxAgeMonths:     SOURCE_POLICY.maxAgeMonths,
        allowUnknownDate: SOURCE_POLICY.allowUnknownDate,
        keepDeadLinks:    SOURCE_POLICY.keepDeadLinks,
      },
    },
    generatedAt: new Date().toISOString(),
    fromCache: false,
    ageDays:   0,
  };

  // 保存に失敗しても生成物は返す（画面を空にしない）
  await saveProfile({
    companyUid,
    companyName:   company.name,
    profile:       body,
    headline:      body.headline,
    bulletCount:   sections.reduce((n, s) => n + s.bullets.length, 0),
    evidenceCount: evidences.length,
    unknownCount:  body.unknowns.length,
    industryName:  body.industry.name,
    trendCount:    body.industry.trendCount,
  }).catch(() => undefined);

  return NextResponse.json(body);
}
