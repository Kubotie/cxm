// ─── GET /api/radar/voices ────────────────────────────────────────────────────
//
// 言質のレビュー一覧。**13社ぶんの個社ページを開いて回るのは、毎週やる作業として
// 成立しない。** 週4〜5件を1画面で片付けるためのエンドポイント。
//
// 返すのは churn_radar_voice と churn_radar_state の突き合わせだけ。
// 企業の状態（stage / 更新までの日数）を添えるのは、同じ引用でも
// 「更新30日前の会社」と「300日前の会社」では判断が変わるため。
//
// クエリ:
//   status=pending|confirmed|rejected|all   既定 pending
//   priority=required|reference|all         既定 required

import { NextRequest, NextResponse } from 'next/server';
import { nocoFetchAll, TABLE_IDS } from '@/lib/nocodb/client';
import { fetchAllRadarStates } from '@/lib/churn/radar-state';
import { sourceUrl, SOURCE_LABEL } from '@/lib/churn/radar-source';
import type { RadarStage } from '@/lib/churn/radar-rules';

export const dynamic = 'force-dynamic';

// ── 出力型 ───────────────────────────────────────────────────────────────────

export interface RadarVoiceListItem {
  voiceId:       string;
  companyUid:    string;
  companyName:   string;
  /** 同じ発言でも、更新が近い会社ほど重い。判断材料として添える */
  stage:         RadarStage;
  daysToRenewal: number | null;
  ownerName:     string | null;
  mrr:           number | null;
  intentType:    string;
  intentLabel:   string;
  quotedText:    string;
  extractReason: string | null;
  confidence:    number;
  occurredAt:    string;
  sourceLabel:   string;
  url:           string | null;
  priority:      'required' | 'reference';
  reviewStatus:  'pending' | 'confirmed' | 'rejected';
  reviewedBy:    string | null;
}

export interface RadarVoicesResponse {
  ready:  boolean;
  items:  RadarVoiceListItem[];
  counts: {
    requiredPending:  number;
    referencePending: number;
    confirmed:        number;
    rejected:         number;
  };
  setupHint?: string;
}

interface RawVoice {
  voice_id?:         string | null;
  company_uid?:      string | null;
  source_type?:      string | null;
  source_record_id?: string | null;
  occurred_at?:      string | null;
  intent_type?:      string | null;
  intent_label?:     string | null;
  quoted_text?:      string | null;
  extract_reason?:   string | null;
  confidence?:       number | string | null;
  review_priority?:  string | null;
  review_status?:    string | null;
  reviewed_by?:      string | null;
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<RadarVoicesResponse>> {
  const empty: RadarVoicesResponse = {
    ready: false, items: [],
    counts: { requiredPending: 0, referencePending: 0, confirmed: 0, rejected: 0 },
  };

  if (!TABLE_IDS.churn_radar_voice) {
    return NextResponse.json({
      ...empty,
      setupHint: 'NOCODB_CHURN_RADAR_VOICE_TABLE_ID が未設定です。',
    });
  }

  const sp       = req.nextUrl.searchParams;
  const status   = sp.get('status')   ?? 'pending';
  const priority = sp.get('priority') ?? 'required';

  const [rows, states] = await Promise.all([
    nocoFetchAll<RawVoice>(TABLE_IDS.churn_radar_voice, { sort: '-occurred_at' })
      .catch(() => [] as RawVoice[]),
    fetchAllRadarStates(),
  ]);

  const stateByUid = new Map(states.map(s => [s.company_uid, s]));

  const all: RadarVoiceListItem[] = rows
    .filter(r => r.voice_id && r.company_uid && r.quoted_text)
    .map(r => {
      const st = stateByUid.get(String(r.company_uid).trim());
      const src = String(r.source_type ?? '');
      return {
        voiceId:       String(r.voice_id),
        companyUid:    String(r.company_uid).trim(),
        companyName:   st?.canonical_name?.trim() || String(r.company_uid).trim(),
        stage:         (st?.stage ?? 'clear') as RadarStage,
        daysToRenewal: st?.days_to_renewal ?? null,
        ownerName:     st?.owner_name ?? null,
        mrr:           st?.mrr ?? null,
        intentType:    String(r.intent_type ?? ''),
        intentLabel:   String(r.intent_label ?? r.intent_type ?? ''),
        quotedText:    String(r.quoted_text),
        extractReason: r.extract_reason ? String(r.extract_reason) : null,
        confidence:    Number(r.confidence ?? 0),
        occurredAt:    String(r.occurred_at ?? '').slice(0, 10),
        sourceLabel:   SOURCE_LABEL[src] ?? src,
        url:           sourceUrl(src, r.source_record_id ? String(r.source_record_id) : null),
        priority:      (String(r.review_priority ?? 'required') as RadarVoiceListItem['priority']),
        reviewStatus:  (String(r.review_status ?? 'pending') as RadarVoiceListItem['reviewStatus']),
        reviewedBy:    r.reviewed_by ? String(r.reviewed_by) : null,
      };
    });

  const counts = {
    requiredPending:  all.filter(v => v.priority === 'required'  && v.reviewStatus === 'pending').length,
    referencePending: all.filter(v => v.priority === 'reference' && v.reviewStatus === 'pending').length,
    confirmed:        all.filter(v => v.reviewStatus === 'confirmed').length,
    rejected:         all.filter(v => v.reviewStatus === 'rejected').length,
  };

  const items = all
    .filter(v => status   === 'all' || v.reviewStatus === status)
    .filter(v => priority === 'all' || v.priority     === priority)
    // 更新が近い会社から。同じ発言でも期限が近いほど先に判断すべき
    .sort((a, b) => {
      const da = a.daysToRenewal ?? 9999, db = b.daysToRenewal ?? 9999;
      if (da !== db) return da - db;
      return b.confidence - a.confidence;
    });

  return NextResponse.json({ ready: true, items, counts });
}
