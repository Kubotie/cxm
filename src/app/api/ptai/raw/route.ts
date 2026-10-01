// ─── GET /api/ptai/raw（**PtAI Pipeline 専用**）───────────────────────────────
//
// board.js が読む RAW（原本 1353 行の `const RAW = {...}` 相当）を返す。
// 顧客名・MRR・議事録を含むので public/ には置かず、ログイン必須のこの経路で返す。
//
// ═══════════════════════════════════════════════════════════════════════════
//  **このルートは PtAI Pipeline のためだけにある。CXM の取得経路とは無関係。**
//
//  取得元は Feature Flag `PTAI_DATA_SOURCE` で切り替える（移行期間専用）。
//
//    legacy_nocodb（**現在の既定**）
//        Pipeline の pga_docs/_raw を読む。移植過程で作られた**一時的な互換実装**で、
//        目標設計ではない
//    twenty（**目標設計**）
//        Twenty から GET して RAW 互換へ変換して返す。**pga_docs へ保存しない**
//
//  目標は「Pipeline の業務データは Twenty が唯一の正本」。
//  Phase 2D で legacy 分岐を削除し、Pipeline から `pga_docs` 依存を外す。
//  **CXM の NocoDB 利用はこの計画の対象外で、影響を受けない。**
// ═══════════════════════════════════════════════════════════════════════════
//
// ── キャッシュ方針 ────────────────────────────────────────────────────────────
//   legacy: スナップショットは動かないのでプロセス内に保持し、`private, max-age=300`
//   twenty: **プロセス内キャッシュを持たない。** `private, max-age=60` のみ。
//           Twenty で更新してから画面に出るまで最大 60 秒＋board.js の
//           6 秒ポーリング分の遅れが出る（`X-Ptai-Staleness` に明示）。
//           長めのキャッシュを置くと「Twenty が正本」という前提が崩れて見えるため短くする。
//
// ── ログ ──────────────────────────────────────────────────────────────────────
//   顧客名・UUID・本文は出さない。出すのは件数と紐付け方式だけ。

import { NextResponse } from 'next/server';
import { getUserUidFromCookie } from '@/lib/auth/session';
import { getRawSnapshot, isPtaiStoreConfigured } from '@/lib/ptai/store';
import { getPtaiDataSource } from '@/lib/twenty/data-source';
import { isTwentyConfiguredAsync, TwentyError } from '@/lib/twenty/client';
import { buildRawFromNewSources } from '@/lib/ptai/raw-view';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** legacy（pga_docs）経路だけで使う。twenty 経路では使わない */
let legacyCached: string | null = null;

export async function GET() {
  if (!(await getUserUidFromCookie())) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const source = getPtaiDataSource();
  return source === 'twenty' ? fromTwenty() : fromLegacyNocodb();
}

// ── Twenty（最終形）──────────────────────────────────────────────────────────

async function fromTwenty(): Promise<NextResponse> {
  if (!(await isTwentyConfiguredAsync())) {
    return NextResponse.json(
      { error: 'twenty_not_configured', message: 'Twenty の API キーが未設定です' },
      { status: 503 },
    );
  }

  try {
    // Notion（アカウント情報の正本）＋ Twenty test*（商談）から組み立てる
    const { snapshot, diagnostics } = await buildRawFromNewSources();

    // 診断は**件数だけ**。顧客が特定できる値は出さない
    console.info('[ptai/raw] source=twenty', JSON.stringify(diagnostics));

    return new NextResponse(JSON.stringify(snapshot), {
      headers: {
        'Content-Type':  'application/json; charset=utf-8',
        // Twenty が正本なので短くする。更新が画面に出るまでの遅れは下のヘッダで明示
        'Cache-Control': 'private, max-age=60',
        'X-Ptai-Data-Source': 'twenty',
        // 反映遅延の目安（HTTP キャッシュ 60 秒 ＋ board.js のポーリング 6 秒）
        'X-Ptai-Staleness-Seconds': '66',
        'X-Ptai-Partial-Failures': String(diagnostics.partialFailures.length),
        'X-Ptai-Companies': String(diagnostics.companies),
        'X-Ptai-Deals': String(diagnostics.deals),
      },
    });
  } catch (e) {
    const err = e as TwentyError;
    console.error('[ptai/raw] Twenty から取得できませんでした', err.toSafeString?.() ?? String(err));
    return NextResponse.json(
      { error: 'twenty_unavailable', message: err.toSafeString?.() ?? 'Twenty から取得できませんでした' },
      { status: 502 },
    );
  }
}

// ── pga_docs（Pipeline の互換実装。Phase 2D で削除）──────────────────────────
//   ここで読むのは Pipeline 専用の `pga_docs` テーブルだけ。
//   CXM の NocoDB テーブルには触れない。

async function fromLegacyNocodb(): Promise<NextResponse> {
  if (!isPtaiStoreConfigured()) {
    return NextResponse.json({ error: 'store_not_configured' }, { status: 503 });
  }

  if (!legacyCached) legacyCached = await getRawSnapshot();
  if (!legacyCached) {
    return NextResponse.json(
      { error: 'raw_not_seeded', hint: 'PTAI_DATA_SOURCE=twenty に切り替えるか、移行元スナップショットを投入してください' },
      { status: 503 },
    );
  }

  return new NextResponse(legacyCached, {
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
      'X-Ptai-Data-Source': 'legacy_nocodb',
      // 移行元の固定スナップショット。Twenty の更新は反映されない
      'X-Ptai-Staleness-Seconds': 'snapshot',
    },
  });
}
