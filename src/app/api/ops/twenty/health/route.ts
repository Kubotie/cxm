// ─── GET /api/ops/twenty/health ───────────────────────────────────────────────
//
// Twenty CRM への疎通確認（Phase 1）。**読み取りしかしない。**
//
//   ?probe=base     base URL の候補を順に叩いて、どれが応答するかだけ見る（既定）
//   ?probe=counts   base 解決に加えて、対象オブジェクトの件数を取る
//   ?probe=meta     さらに、対象オブジェクトのフィールド定義を要約して返す
//
// キーが未設定でも 200 を返し、status:'not_configured' で何が足りないかを示す
// （画面側で「未接続」と出せるようにするため。500 にはしない）。
// **API キーはレスポンスにもログにも出さない。**
//
// 認可: admin / ops のみ（src/lib/auth/guard.ts）

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/guard';
import {
  isTwentyConfigured, getTwentyConfigStatus, resolveBaseUrl, countRecords,
  listObjectMetadata, TwentyError, TWENTY_MAX_LIMIT, TWENTY_DEFAULT_PAGE_SIZE,
  type BaseProbe, type TwentyObjectMeta,
} from '@/lib/twenty/client';
import { TWENTY_SOURCES } from '@/lib/twenty/sync-policy';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** メタ情報を見たいオブジェクト（取得スクリプト meta.py と同じ範囲） */
const META_OBJECTS = ['opportunity', 'company', 'workspaceMember', 'note', 'task', 'person'];

interface HealthResponse {
  status: 'ok' | 'not_configured' | 'auth_failed' | 'unreachable' | 'error';
  checkedAt: string;
  config: {
    configured: boolean;
    missing: string[];
    /** 環境変数に設定されている値。**キーではない** */
    configuredUrl: string;
    resolvedUrl: string | null;
  };
  limits: { maxLimit: number; defaultPageSize: number };
  baseProbe?: BaseProbe[];
  counts?: Record<string, number | null>;
  meta?: Record<string, Array<{ name: string; type: string; custom?: boolean; options?: string[] }>>;
  message?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse<HealthResponse | { error: string }>> {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const probe = req.nextUrl.searchParams.get('probe') ?? 'base';
  const base: HealthResponse = {
    status: 'ok',
    checkedAt: new Date().toISOString(),
    config: getTwentyConfigStatus(),
    limits: { maxLimit: TWENTY_MAX_LIMIT, defaultPageSize: TWENTY_DEFAULT_PAGE_SIZE },
  };

  if (!isTwentyConfigured()) {
    return NextResponse.json({
      ...base,
      status: 'not_configured',
      message: 'TWENTY_API_KEY が未設定です。Vercel の環境変数に読み取り用キーを設定してください。',
    });
  }

  try {
    const { base: resolved, report, authFailedBase } = await resolveBaseUrl({ force: true });
    base.baseProbe = report;
    base.config = getTwentyConfigStatus();

    if (!resolved && authFailedBase) {
      // base は当たっている。キーが違うか、権限が足りない
      return NextResponse.json({
        ...base,
        status: 'auth_failed',
        message:
          `API には到達しています（${authFailedBase}）が、キーが拒否されました。` +
          'TWENTY_API_KEY の値と、そのキーに読み取り権限があるかを確認してください。',
      });
    }

    if (!resolved) {
      return NextResponse.json({
        ...base,
        status: 'unreachable',
        message:
          'どの base URL 候補でも metadata API に到達できませんでした。' +
          'TWENTY_API_URL を確認してください（crm.ptmind.com はフロントエンドなので不可）。',
      });
    }

    if (probe === 'counts' || probe === 'meta') {
      const counts: Record<string, number | null> = {};
      for (const src of Object.values(TWENTY_SOURCES)) {
        counts[src.plural] = await countRecords(src.plural).catch(() => null);
      }
      base.counts = counts;
    }

    if (probe === 'meta') {
      const objects = await listObjectMetadata();
      const meta: HealthResponse['meta'] = {};
      for (const o of objects as TwentyObjectMeta[]) {
        if (!o.nameSingular || !META_OBJECTS.includes(o.nameSingular)) continue;
        meta[o.nameSingular] = (o.fields ?? [])
          .filter(f => f.isActive !== false)
          .map(f => ({
            name: f.name,
            type: f.type,
            ...(f.isCustom ? { custom: true } : {}),
            ...(f.options?.length ? { options: f.options.map(x => x.value ?? '').filter(Boolean) } : {}),
          }));
      }
      base.meta = meta;
    }

    return NextResponse.json(base);
  } catch (e) {
    const err = e as TwentyError;
    // 例外メッセージにキーは含まれない（client.ts は URL とステータスしか載せない）
    console.error('[ops/twenty/health] 疎通確認に失敗', err.message);
    return NextResponse.json({
      ...base,
      status: err.configIssue ? 'not_configured' : 'error',
      message: `${err.message}${err.status ? ` (HTTP ${err.status})` : ''}`,
    });
  }
}
