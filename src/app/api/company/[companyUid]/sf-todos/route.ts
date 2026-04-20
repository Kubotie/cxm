// ─── POST /api/company/[companyUid]/sf-todos ──────────────────────────────────
//
// CXM Action を Salesforce Task として作成する。
// 2段階の安全設計（dry-run → confirmCreate）を採用する。
//
// ── 実行モード ───────────────────────────────────────────────────────────────
//   confirmCreate 省略 or false  → dry-run（default・安全）
//     sfAccountId/ownerId の解決・payload 検証のみ実行。Task は作成しない。
//   confirmCreate: true          → 実作成
//     上記解決を行ったうえで SF Task を実際に作成する。
//
// ── sfAccountId 解決順 ───────────────────────────────────────────────────────
//   1. request body の sfAccountId（明示指定）
//   2. companies テーブルの sf_account_id カラム
//   3. companyUid をそのまま使用（fallback）
//   → fallback が使われた場合は warnings に記録
//
// ── ownerId 解決 ─────────────────────────────────────────────────────────────
//   ownerEmail → resolveSfUserId(email) → SF UserId
//   解決できない場合は OwnerId 省略（Task は作成可能だが担当者なし）
//
// ── レスポンス ──────────────────────────────────────────────────────────────
//   dry-run:  { ok: true,  mode: 'dry_run',  resolved, payload, warnings }
//   created:  { ok: true,  mode: 'created',  sfTaskId, resolved, warnings }
//   error:    { ok: false, mode: 'error',    syncResult, error, resolved, warnings }

import { NextResponse } from 'next/server';
import {
  activeSalesforceTaskAdapter,
  buildCreateSfTaskPayload,
  type CreateSfTaskPayload,
} from '@/lib/salesforce/salesforce-task-adapter';
import { isSalesforceConfigured, resolveSfUserId } from '@/lib/salesforce/client';
import { fetchSfAccountId } from '@/lib/nocodb/companies';
import {
  logMutationEvent,
  buildSfTodoCreatedEvent,
} from '@/lib/company/company-mutation-events';

type RouteContext = { params: Promise<{ companyUid: string }> };

// ── sfAccountId 解決 ──────────────────────────────────────────────────────────

type SfAccountIdSource = 'explicit' | 'companies_table' | 'fallback';

async function resolveSfAccountId(
  companyUid:          string,
  explicitSfAccountId: string | undefined,
): Promise<{ sfAccountId: string; sfAccountIdSource: SfAccountIdSource; warnings: string[] }> {
  const warnings: string[] = [];
  if (explicitSfAccountId) {
    return { sfAccountId: explicitSfAccountId, sfAccountIdSource: 'explicit', warnings };
  }
  const fromTable = await fetchSfAccountId(companyUid);
  if (fromTable) {
    return { sfAccountId: fromTable, sfAccountIdSource: 'companies_table', warnings };
  }
  warnings.push(
    `sf_account_id が companies テーブルに設定されていません。` +
    `companyUid='${companyUid}' を SF Account ID として使用しています。`,
  );
  return { sfAccountId: companyUid, sfAccountIdSource: 'fallback', warnings };
}

// ── リクエスト型 ─────────────────────────────────────────────────────────────

interface SfTodoBody {
  // ── Action フィールド ───────────────────────────────────────────────────
  /** CXM Action ID（ログ / 紐付け用） */
  actionId?:         string | null;
  /** Action.title → SF Task Subject（必須） */
  subject:           string;
  /** 追加の説明文（body + sourceRef を組み合わせて SF Description に格納） */
  description?:      string;
  /** Action.status → SF Task Status（SF_TASK_STATUS_MAP で変換） */
  status?:           string;
  /** Action.dueDate (YYYY-MM-DD) → SF Task ActivityDate */
  dueDate?:          string | null;
  /** Action.owner（メールアドレス）→ SF UserId 解決 */
  ownerEmail?:       string;
  /** Action.sourceRef → SF Task Description 冒頭に "CXM Ref: ..." で付与 */
  sourceRef?:        string | null;
  /** personRef → SF Contact ID への変換が必要（現状未解決。WhoId は省略） */
  relatedPersonId?:  string | null;
  /** 優先度（'High' | 'Normal'。省略時 'Normal'） */
  priority?:         string;
  // ── 制御フィールド ──────────────────────────────────────────────────────
  /** Salesforce Account ID（省略時は自動解決） */
  sfAccountId?:      string;
  /**
   * false（省略）: dry-run のみ。Task 作成しない（デフォルト・安全）
   * true         : 実際に SF Task を作成する
   */
  confirmCreate?:    boolean;
}

// ── レスポンス型 ─────────────────────────────────────────────────────────────

interface ResolvedFields {
  sfAccountId:       string;
  sfAccountIdSource: SfAccountIdSource;
  ownerId:           string | null;
  ownerIdResolved:   boolean;
}

export type SfTodoResult =
  // ── dry-run（confirmCreate 省略 or false）────────────────────────────────
  | {
      ok:         true;
      mode:       'dry_run';
      syncResult: 'dry_run';
      sfTodoId:   null;
      actionId:   string | null;
      resolved:   ResolvedFields;
      payload:    CreateSfTaskPayload;
      warnings:   string[];
    }
  // ── 作成成功（confirmCreate: true）──────────────────────────────────────
  | {
      ok:         true;
      mode:       'created';
      syncResult: 'synced';
      sfTodoId:   string;
      sfTaskId:   string;   // sfTodoId と同値（新命名）
      syncedAt:   string;
      actionId:   string | null;
      resolved:   ResolvedFields;
      warnings:   string[];
    }
  // ── エラー ─────────────────────────────────────────────────────────────
  | {
      ok:         false;
      mode:       'error';
      syncResult: 'adapter_not_connected' | 'sync_error';
      sfTodoId:   null;
      error:      string;
      actionId:   string | null;
      resolved:   ResolvedFields;
      warnings:   string[];
    };

/** 旧型名エイリアス（既存コンポーネントとの互換性維持） */
export type SfTodoCreateResult = SfTodoResult;

// ── POST ───────────────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: RouteContext) {
  const { companyUid } = await params;
  if (!companyUid) {
    return NextResponse.json({ error: 'companyUid is required' }, { status: 400 });
  }

  let body: SfTodoBody;
  try {
    body = await req.json().catch(() => ({})) as SfTodoBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.subject?.trim()) {
    return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  }

  const confirmCreate = body.confirmCreate === true;
  const warnings: string[] = [];

  // ─ sfAccountId 解決 ───────────────────────────────────────────────────────
  const {
    sfAccountId, sfAccountIdSource, warnings: sfWarn,
  } = await resolveSfAccountId(companyUid, body.sfAccountId);
  warnings.push(...sfWarn);

  // ─ ownerId 解決 ───────────────────────────────────────────────────────────
  let ownerId: string | null = null;
  let ownerIdResolved = false;
  if (body.ownerEmail) {
    if (isSalesforceConfigured()) {
      const resolved = await resolveSfUserId(body.ownerEmail).catch(() => undefined);
      if (resolved) {
        ownerId = resolved;
        ownerIdResolved = true;
      } else {
        warnings.push(
          `ownerEmail '${body.ownerEmail}' に対応する SF User が見つかりませんでした。OwnerId は省略されます。`,
        );
      }
    } else {
      warnings.push('Salesforce 未接続のため ownerEmail の解決をスキップしました。');
    }
  }

  // ─ payload 構築 ───────────────────────────────────────────────────────────
  const basePayload = buildCreateSfTaskPayload({
    title:     body.subject.trim(),
    status:    body.status    ?? 'open',
    dueDate:   body.dueDate   ?? null,
    sourceRef: body.sourceRef ?? null,
    priority:  body.priority,
  });

  // description: body.description があれば追記
  const descParts: string[] = [];
  if (basePayload.description) descParts.push(basePayload.description);
  if (body.description?.trim()) descParts.push(body.description.trim());

  const payload: CreateSfTaskPayload = {
    ...basePayload,
    whatId:  sfAccountId,
    ...(ownerId          && { ownerId }),
    ...(descParts.length && { description: descParts.join('\n') }),
  };

  const resolved: ResolvedFields = { sfAccountId, sfAccountIdSource, ownerId, ownerIdResolved };

  // ─ dry-run（confirmCreate: false / 省略）─────────────────────────────────
  const actionId = body.actionId ?? null;

  // ─ dry-run（confirmCreate: false / 省略）─────────────────────────────────
  if (!confirmCreate) {
    if (!isSalesforceConfigured()) {
      warnings.push('Salesforce 環境変数が未設定です。実際の Task 作成はできません（要設定）。');
    }
    const result: SfTodoResult = {
      ok:         true,
      mode:       'dry_run',
      syncResult: 'dry_run',
      sfTodoId:   null,
      actionId,
      resolved,
      payload,
      warnings,
    };
    return NextResponse.json(result, { status: 200 });
  }

  // ─ 実作成（confirmCreate: true）──────────────────────────────────────────
  if (!isSalesforceConfigured()) {
    const result: SfTodoResult = {
      ok:         false,
      mode:       'error',
      syncResult: 'adapter_not_connected',
      sfTodoId:   null,
      error:      'Salesforce 環境変数が未設定です。SALESFORCE_* を設定してください。',
      actionId,
      resolved,
      warnings,
    };
    return NextResponse.json(result, { status: 503 });
  }

  const createResult = await activeSalesforceTaskAdapter.createTask(payload);
  const syncedAt = new Date().toISOString();

  if (createResult.syncResult === 'synced') {
    // mutation log（fire-and-forget）
    logMutationEvent(buildSfTodoCreatedEvent(companyUid, {
      sfTodoId:        createResult.sfId,
      subject:         body.subject.trim(),
      priority:        body.priority ?? 'Normal',
      dueDate:         body.dueDate ?? null,
      relatedSignalId: body.sourceRef ?? null,
      relatedPersonId: body.relatedPersonId ?? null,
      syncResult:      'synced',
    }, { source: 'ui' })).catch(() => {});

    const result: SfTodoResult = {
      ok:         true,
      mode:       'created',
      syncResult: 'synced',
      sfTodoId:   createResult.sfId,
      sfTaskId:   createResult.sfId,
      syncedAt,
      actionId,
      resolved,
      warnings,
    };
    return NextResponse.json(result, { status: 201 });
  }

  const result: SfTodoResult = {
    ok:         false,
    mode:       'error',
    syncResult: 'sync_error',
    sfTodoId:   null,
    error:      createResult.error ?? 'SF Task 作成に失敗しました',
    actionId,
    resolved,
    warnings,
  };
  return NextResponse.json(result, { status: 502 });
}
