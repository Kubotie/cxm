// ─── GET /api/ops/twenty/health ───────────────────────────────────────────────
//
// PtAI Pipeline の疎通確認。**GET しか発行しない。**
//
// ── 見ているもの（2026-10-01 に現行設計へ合わせた）──────────────────────────
//   ★ test*（Pipeline が実際に読み書きする 7 オブジェクト）
//   ★ Notion の目標 DB（目標の正本）
//   ★ 利用者の名寄せ（staff_identify × Twenty workspaceMember）
//     既存 Company / Opportunity / Note は **Pipeline は使っていない**ので参考値。
//     空でも実害が無いため legacyNotes に分けてある（warnings と混ぜない）。
//
// ── 触るもの / 触らないもの ──────────────────────────────────────────────────
//   staff_identify は**読むだけ**（利用者の名寄せ）。CXM の業務テーブルと
//   Pipeline の pga_docs には一切アクセスしない。
//
// ── 返さないもの ──────────────────────────────────────────────────────────────
//   API キー / Authorization ヘッダー / 顧客名 / 商談名 / Note 本文 / 生レスポンス /
//   メールアドレス。返すのは接続状態・件数・スキーマ検証の真偽・集計ベースの警告と、
//   社内の name2（表示名）だけ。
//
// ── 認可 ──────────────────────────────────────────────────────────────────────
//   admin / ops のみ（requireOpsOrAdmin）。
//   manager を含めていないのは、src/lib/auth/role.ts が Salesforce 系・データ整備系の
//   運用エンドポイントから manager を外しているのに合わせたため。
//   Twenty も外部 CRM の接続診断であり、同じ区分とみなす。
//   csm / viewer は 403。未認証は 401。
//
// ── degraded ──────────────────────────────────────────────────────────────────
//   接続自体は成功しているが、補助情報（件数・スキーマ）の一部が取れなかった場合は
//   error にせず degraded にして、取れた分だけ返す。

import { NextRequest, NextResponse } from 'next/server';
import { requireOpsOrAdmin } from '@/lib/auth/guard';
import {
  isTwentyConfiguredAsync, getTwentyConfigStatus, resolveBaseUrl,
  countRecords, listRecords, listObjectMetadata, TwentyError,
} from '@/lib/twenty/client';
import {
  TWENTY_SOURCES, MEASURED_2026_09_30, COMPANY_POLICY, OPPORTUNITY_POLICY,
} from '@/lib/twenty/sync-policy';
import { getPtaiDataSource } from '@/lib/twenty/data-source';
import { TEST_OBJECTS, type TestObjectKey } from '@/lib/ptai/twenty-test/schema';
import { listTargetRows } from '@/lib/ptai/notion/client';
import { listPtaiStaff } from '@/lib/ptai/staff';
import { DEFAULT_APPROVER_NAME2 } from '@/lib/ptai/approver-policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

export type TestCounts = Record<TestObjectKey, number | null>;

export interface TwentyHealthResult {
  status: 'ok' | 'degraded' | 'error';
  /** 実測で確定した接続先。**キーではない** */
  resolvedBaseUrl: string;
  checkedAt: string;
  /** Pipeline がいまどちらから読んでいるか（PTAI_DATA_SOURCE） */
  dataSource: 'legacy_nocodb' | 'twenty';
  /** ★ いま Pipeline が読み書きしているオブジェクト */
  testCounts: TestCounts;
  /** 目標の正本（Notion 専用 DB） */
  notionTargets: { ok: boolean; rows: number | null; message: string | null };
  /**
   * 操作者の名寄せ。Twenty の `createdBy` を本人に紐付けられる人数。
   * **メールアドレス以外は返さない**（名前は name2 のみ）。
   */
  /** staff は **Pipeline 利用者の人数**（CXM だけの人は数えない） */
  identity: { staff: number; linkedToTwenty: number; unlinked: string[] };
  /** Phase 1 で見ていた既存オブジェクト。**Pipeline は使っていない**（参考値） */
  counts: {
    pgaCompanies:     number | null;
    opportunities:    number | null;
    notes:            number | null;
    workspaceMembers: number | null;
    tasks:            number | null;
    noteTargets:      number | null;
  };
  schema: {
    companyFieldsVerified:     boolean;
    opportunityFieldsVerified: boolean;
  };
  /** 現行設計で対処が要るもの。集計情報だけ */
  warnings: string[];
  /** 既存オブジェクトについての参考情報。現行設計では実害が無い */
  legacyNotes: string[];
}

const EMPTY_TEST_COUNTS = (): TestCounts =>
  Object.fromEntries(Object.keys(TEST_OBJECTS).map(k => [k, null])) as TestCounts;

/** 安全なエラー応答。原因は種別までで、応答本文もキーも載せない */
function errorResult(message: string, baseUrl: string): TwentyHealthResult {
  return {
    status: 'error',
    resolvedBaseUrl: baseUrl,
    checkedAt: new Date().toISOString(),
    dataSource: getPtaiDataSource(),
    testCounts: EMPTY_TEST_COUNTS(),
    notionTargets: { ok: false, rows: null, message: null },
    identity: { staff: 0, linkedToTwenty: 0, unlinked: [] },
    counts: {
      pgaCompanies: null, opportunities: null, notes: null,
      workspaceMembers: null, tasks: null, noteTargets: null,
    },
    schema: { companyFieldsVerified: false, opportunityFieldsVerified: false },
    warnings: [message],
    legacyNotes: [],
  };
}

export async function GET(_req: NextRequest): Promise<NextResponse<TwentyHealthResult | { error: string }>> {
  const gate = await requireOpsOrAdmin();
  if (!gate.ok) return gate.response;

  const cfg = getTwentyConfigStatus();
  const dataSource = getPtaiDataSource();
  const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };

  if (!(await isTwentyConfiguredAsync())) {
    return NextResponse.json(
      errorResult('TWENTY_API_KEY が未設定です。Vercel の環境変数に読み取り用キーを設定してください。', cfg.baseUrl),
      noStore,
    );
  }

  // ── 1. 接続 ────────────────────────────────────────────────────────────────
  let baseUrl = cfg.baseUrl;
  try {
    const { base, authFailedBase } = await resolveBaseUrl({ force: true });
    if (!base) {
      const msg = authFailedBase
        ? `API には到達していますが（${authFailedBase}）、キーが拒否されました。キーの値と読み取り権限を確認してください。`
        : 'どの候補でも Twenty の API に到達できませんでした。TWENTY_API_URL を確認してください（crm.ptmind.com はフロントエンドなので不可）。';
      return NextResponse.json(errorResult(msg, authFailedBase ?? cfg.baseUrl), noStore);
    }
    baseUrl = base;
  } catch (e) {
    const err = e as TwentyError;
    console.error('[ops/twenty/health] 接続に失敗', err.toSafeString());
    return NextResponse.json(errorResult(err.toSafeString(), cfg.baseUrl), noStore);
  }

  // warnings = 現行設計で対処が要ること
  // legacyNotes = Phase 1 で見ていた既存オブジェクトの参考情報（Pipeline は使っていない）
  const warnings: string[] = [];
  const legacyNotes: string[] = [];
  let degraded = false;

  // ── 2. 件数（フィルタを必ず渡す）───────────────────────────────────────────
  const count = async (key: keyof typeof TWENTY_SOURCES): Promise<number | null> => {
    const src = TWENTY_SOURCES[key];
    try {
      return await countRecords(src.plural, src.filter);
    } catch (e) {
      degraded = true;
      warnings.push(`${src.plural} の件数を取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`);
      return null;
    }
  };

  const counts: TwentyHealthResult['counts'] = {
    pgaCompanies:     await count('companies'),
    opportunities:    await count('opportunities'),
    notes:            await count('notes'),
    workspaceMembers: await count('workspaceMembers'),
    tasks:            await count('tasks'),
    noteTargets:      await count('noteTargets'),
  };

  // ── 2b. ★ Pipeline が実際に読み書きしている test* ──────────────────────────
  const testCounts = EMPTY_TEST_COUNTS();
  for (const [key, obj] of Object.entries(TEST_OBJECTS)) {
    try {
      testCounts[key as TestObjectKey] = await countRecords(obj.plural, null);
    } catch (e) {
      degraded = true;
      warnings.push(`${obj.singular} の件数を取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`);
    }
  }

  // ── 2c. 目標の正本（Notion 専用 DB）────────────────────────────────────────
  const notionTargets: TwentyHealthResult['notionTargets'] = { ok: false, rows: null, message: null };
  // Pipeline を実際に使う人（目標 DB のメンバー行＋承認者）。名寄せの対象はこの人たち
  const ptaiMembers = new Set<string>(DEFAULT_APPROVER_NAME2);
  try {
    const rows = await listTargetRows();
    notionTargets.ok = true;
    notionTargets.rows = rows.length;
    for (const r of rows) if (r.name2) ptaiMembers.add(r.name2);
    if (rows.length === 0) {
      warnings.push('Notion の目標 DB が空です。チーム目標とメンバー別目標を入れてください');
    }
  } catch (e) {
    degraded = true;
    notionTargets.message = 'Notion の目標 DB を読めませんでした（NOTION_PTAI_TARGETS_DS_ID とトークンを確認してください）';
    warnings.push(notionTargets.message);
    void e;
  }

  // ── 2d. 操作者を Twenty の本人レコードに紐付けられるか ─────────────────────
  //   API キーは 1 本のままで、`createdBy` に workspaceMemberId を入れて本人を記録する。
  //   紐付かない人は名前の文字列だけになるので、ここで見えるようにしておく。
  const identity: TwentyHealthResult['identity'] = { staff: 0, linkedToTwenty: 0, unlinked: [] };
  try {
    const staff = await listPtaiStaff();
    // ⚠ staff_identify には CXM だけを使う人も入っている。
    //    **Pipeline を使う人だけ**を見ないと、関係ない未紐付が警告に並ぶ。
    const mine = ptaiMembers.size
      ? staff.filter(s => ptaiMembers.has(s.name2))
      : staff;
    identity.staff = mine.length;
    identity.linkedToTwenty = mine.filter(s => s.workspaceMemberId).length;
    identity.unlinked = mine.filter(s => !s.workspaceMemberId).map(s => s.name2);
    if (identity.unlinked.length) {
      warnings.push(
        `Twenty に席が無い Pipeline 利用者が ${identity.unlinked.length} 名います（${identity.unlinked.join(', ')}）。`
        + 'この人たちの作成レコードは createdBy が名前の文字列だけになり、Twenty 上で本人に紐付きません',
      );
    }
  } catch {
    degraded = true;
    warnings.push('利用者の名寄せ（staff_identify × workspaceMember）を確認できませんでした');
  }

  // ── 3. スキーマ検証 ────────────────────────────────────────────────────────
  const schema = { companyFieldsVerified: false, opportunityFieldsVerified: false };
  try {
    const objects = await listObjectMetadata();
    const byName = new Map(objects.map(o => [o.nameSingular, new Set(o.fields.map(f => f.name))]));

    const check = (obj: string, policy: typeof COMPANY_POLICY): { ok: boolean; missing: string[] } => {
      const fields = byName.get(obj);
      if (!fields) return { ok: false, missing: ['(オブジェクトが見つからない)'] };
      const expected = policy.map(p => p.twentyField).filter((f): f is string => !!f);
      const missing = expected.filter(f => !fields.has(f));
      return { ok: missing.length === 0, missing };
    };

    const c = check('company', COMPANY_POLICY);
    const o = check('opportunity', OPPORTUNITY_POLICY);
    schema.companyFieldsVerified = c.ok;
    schema.opportunityFieldsVerified = o.ok;
    // フィールド名は顧客データではないので警告に出してよい
    if (!c.ok) legacyNotes.push(`既存 Company に想定フィールドがありません: ${c.missing.join(', ')}`);
    if (!o.ok) legacyNotes.push(`既存 Opportunity に想定フィールドがありません: ${o.missing.join(', ')}`);

    // stage の選択肢が 5 段階のままか
    const oppMeta = objects.find(x => x.nameSingular === 'opportunity');
    const stage = oppMeta?.fields.find(f => f.name === 'stage');
    const stageCount = stage?.options?.length ?? 0;
    if (stageCount && stageCount !== Object.keys(MEASURED_2026_09_30.stageDistribution).length) {
      legacyNotes.push(`既存 Opportunity.stage の選択肢が ${stageCount} 個です（2026-09-30 実測は 5 個）。8 段階は testOpportunity.stage 側で持っています`);
    }
  } catch (e) {
    degraded = true;
    warnings.push(`スキーマを取得できませんでした（${(e as TwentyError).kind ?? 'error'}）`);
  }

  // ── 4. 既存オブジェクトについての参考情報 ──────────────────────────────────
  //   ここから下は Phase 1 で見ていた Twenty の **既存** Company / Opportunity / Note。
  //   Pipeline は test* 側を読み書きしているので、空でも実害は無い。
  //   「対処が要る警告」と混ぜないよう legacyNotes に分ける。
  if (counts.pgaCompanies != null) {
    const diff = counts.pgaCompanies - MEASURED_2026_09_30.legacySnapshotCompanies;
    if (diff !== 0) {
      legacyNotes.push(
        `移行元スナップショット（${MEASURED_2026_09_30.legacySnapshotCompanies} 社）と Twenty の既存 Company（${counts.pgaCompanies} 社）で ${diff > 0 ? '+' : ''}${diff} 社ぶんの差があります`,
      );
    }
  }

  try {
    const opps = await listRecords('opportunities', { depth: 1, pageSize: 60 });
    const filled = (k: string) => opps.filter(o => o[k] != null && o[k] !== '').length;
    const filledMoney = (k: string) =>
      opps.filter(o => {
        const v = o[k];
        return typeof v === 'object' && v !== null && (v as { amountMicros?: unknown }).amountMicros != null;
      }).length;

    if (opps.length) {
      if (filled('company') === 0) legacyNotes.push(`既存 Opportunity の company リレーションが ${opps.length} 件すべて空です（Pipeline は testOpportunity.notionCompanyId で紐付けています）`);
      if (filled('owner') === 0)   legacyNotes.push(`既存 Opportunity の owner リレーションが ${opps.length} 件すべて空です（Pipeline は testOpportunity.owner に Notion の担当を入れています）`);
      if (filledMoney('netMrr') === 0 && filledMoney('amount') === 0) {
        legacyNotes.push(`既存 Opportunity の金額（netMrr / amount）が ${opps.length} 件すべて空です（金額は testOpportunity.addMrr にあります）`);
      }
      if (filled('closeDate') === 0) legacyNotes.push(`既存 Opportunity の closeDate が ${opps.length} 件すべて空です（Pipeline は testOpportunity.applyDate / billingDate を使います）`);
    }
  } catch (e) {
    degraded = true;
    legacyNotes.push(`既存 Opportunity の充足率を確認できませんでした（${(e as TwentyError).kind ?? 'error'}）`);
  }

  if (counts.notes != null && counts.noteTargets != null && counts.notes > 0) {
    const rate = Math.round((counts.noteTargets / counts.notes) * 100);
    if (rate < 50) {
      legacyNotes.push(`Note ${counts.notes} 件に対し noteTargets が ${counts.noteTargets} 件（${rate}%）しかありません。議事録の紐付けはタイトル照合に頼っています`);
    }
  }

  legacyNotes.push('既存 Opportunity.stage（5 段階）とダッシュボード 8 段階の対応は未確定です（監査 Q6）。既存 Opportunity へ書き戻す段階で決めます');
  warnings.push('🚨 使っているのは Admin キーです（2026-09-30 確認）。test* の書き込みに必要ですが、既存オブジェクトも壊せる権限があります。範囲を絞ったキーへの差し替えが未了です');
  if (dataSource === 'legacy_nocodb') {
    warnings.push('PTAI_DATA_SOURCE が legacy_nocodb です。この環境のダッシュボードは Twenty ではなく移行元の pga_docs を読んでいます');
  }

  return NextResponse.json(
    {
      status: degraded ? 'degraded' : 'ok',
      resolvedBaseUrl: baseUrl,
      checkedAt: new Date().toISOString(),
      dataSource,
      testCounts,
      notionTargets,
      identity,
      counts,
      schema,
      warnings,
      legacyNotes,
    } satisfies TwentyHealthResult,
    noStore,
  );
}
