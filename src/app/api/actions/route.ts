// GET /api/actions
// 現在ログイン中ユーザーの未完了アクション一覧を優先順で返す。
//
// データソース:
//   1. NocoDB company_actions（自分担当企業 = owner_name が name2 と一致する company_uid でフィルタ）
//   2. Salesforce Event（行動）（OwnerId = sf_account_id の行動）
//
// マージルール:
//   - NocoDB action に sf_todo_id あり → SF Event と照合し _source='both'
//   - NocoDB action に sf_todo_id なし → _source='cxm'
//   - SF Event が NocoDB に未登録      → _source='sf'（表示のみ、NocoDB には書かない）
//
// 優先順ロジック:
//   0 overdue / 1 today / 2 high / 3 support / 4 risk / 5 expansion / 6 others

import { NextResponse }                    from 'next/server';
import { getCurrentUserProfile, getUserRoleFromCookie } from '@/lib/auth/session';
import { fetchActionsByCompanyUids, fetchAllActionsAdmin } from '@/lib/nocodb/company-actions';
import { fetchAllCompanies }               from '@/lib/nocodb/companies';
import { activeSalesforceTaskAdapter }     from '@/lib/salesforce/salesforce-task-adapter';
import { nocoFetch, TABLE_IDS }            from '@/lib/nocodb/client';
import { toAppCompanyAction }              from '@/lib/nocodb/types';
import type { AppCompanyAction, RawCompanyAction } from '@/lib/nocodb/types';
import type { SalesforceEvent }            from '@/lib/salesforce/salesforce-task-adapter';

// ── 型 ────────────────────────────────────────────────────────────────────────

export type ActionSource = 'cxm' | 'sf' | 'both';

export interface ActionListItem extends AppCompanyAction {
  _source: ActionSource;
}

// ── 優先順スコア ──────────────────────────────────────────────────────────────

function getPriorityScore(action: ActionListItem, today: string): number {
  const open = action.status === 'open' || action.status === 'in_progress';
  if (!open) return 9;
  // SF行動（Event）は実施済み記録であり期限切れではない → 下位に配置
  if (action._source === 'sf' && action.dueDate && action.dueDate < today) return 7;
  if (action.dueDate && action.dueDate < today)    return 0; // overdue（CXMアクションのみ）
  if (action.dueDate === today)                    return 1; // today
  if (action.urgency === 'high')                   return 2;
  if (action.createdFrom === 'support_case')       return 3;
  if (action.createdFrom === 'risk_signal')        return 4;
  if (action.createdFrom === 'opportunity_signal') return 5;
  return 6;
}

// ── SF Event（行動）→ AppCompanyAction 変換 ───────────────────────────────────

function sfEventToAction(
  event: SalesforceEvent,
  ownerSfId: string,
  companyMap: Map<string, { uid: string; name: string }>,
  today: string,
): AppCompanyAction {
  const company = event.WhatId ? companyMap.get(event.WhatId) : undefined;

  // ActivityDate がなければ StartDateTime の日付部分を使う
  const date = event.ActivityDate
    ?? event.StartDateTime?.slice(0, 10)
    ?? null;

  // 過去日程（ActivityDate < today）の SF イベントは「実施済み」として扱う。
  // Salesforce に記録された行動は既に発生しているため、計画中ではなく実施済みに分類する。
  // 将来の予定（today 以降）は引き続き計画中として表示する。
  const status: AppCompanyAction['status'] = (date && date < today) ? 'done' : 'in_progress';

  return {
    rowId:              0,
    id:                 event.Id,
    companyUid:         company?.uid  ?? event.WhatId ?? '',
    companyName:        company?.name ?? event.WhatId ?? '',
    title:              event.Subject,
    body:               event.Description ?? '',
    owner:              '',
    ownerSfId,
    dueDate:            date,
    status,
    urgency:            'medium',
    recommendedChannel: null,
    createdFrom:        'manual',
    sourceRef:          null,
    personRef:          null,
    sfTodoStatus:       'synced',
    sfTodoId:           event.Id,
    sfLastSyncedAt:     null,
    poc:                null,
    activityType:       null,
    result:             null,
    eventFormat:        null,
    actionPurpose:      null,
    createdAt:          event.StartDateTime ?? new Date().toISOString(),
  };
}

// ── WhatId → company 解決 ─────────────────────────────────────────────────────

async function buildCompanyMap(
  whatIds: string[],
): Promise<Map<string, { uid: string; name: string }>> {
  const map = new Map<string, { uid: string; name: string }>();
  const unique = [...new Set(whatIds)].filter(Boolean);
  if (unique.length === 0 || !TABLE_IDS.companies) return map;

  type RawRow = { company_uid?: string; canonical_name?: string; sf_account_id?: string };
  const rows = await nocoFetch<RawRow>(
    TABLE_IDS.companies,
    {
      where:  `(sf_account_id,in,${unique.join(',')})`,
      fields: 'company_uid,canonical_name,sf_account_id',
      limit:  String(unique.length + 10),
    },
    false,
  ).catch(() => [] as RawRow[]);

  for (const row of rows) {
    if (row.sf_account_id && row.company_uid) {
      map.set(row.sf_account_id, {
        uid:  row.company_uid,
        name: row.canonical_name ?? row.company_uid,
      });
    }
  }
  return map;
}

// ── SF イベント ID → NocoDB actions の targeted 取得 ────────────────────────
//
// SF event ID 一覧に対して NocoDB の sf_todo_id カラムを直引きする。
// fetchAllActionsAdmin の limit: 500 では古いアクションが切れて dedup が壊れるため、
// SF events の数（通常 < 100）に限定した小さなクエリで確実に取得する。
//
async function fetchNocoActionsBySfEventIds(
  sfEventIds: string[],
): Promise<AppCompanyAction[]> {
  const tableId = TABLE_IDS.company_actions;
  if (!tableId || sfEventIds.length === 0) return [];
  const where = `(sf_todo_id,in,${sfEventIds.join(',')})`;
  const rows = await nocoFetch<RawCompanyAction>(tableId, {
    where,
    limit: String(sfEventIds.length + 10),
  }, false).catch(() => [] as RawCompanyAction[]);
  return rows.map(toAppCompanyAction);
}

// ── ハンドラ ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeDone = searchParams.get('include_done') === '1';

  const profile = await getCurrentUserProfile().catch(() => null);
  if (!profile) {
    return NextResponse.json(
      { error: 'ログイン中のユーザーが見つかりません', actions: [] },
      { status: 401 },
    );
  }

  // ── Admin: 全ユーザー分のアクションを返す ─────────────────────────────────
  // NocoDB の role カラムが未設定の場合のフォールバックとして Cookie も確認する
  const roleCookie = await getUserRoleFromCookie();
  const effectiveRole = roleCookie ?? profile.role;

  if (effectiveRole === 'admin') {
    const nocoActions = await fetchAllActionsAdmin(includeDone).catch(() => [] as AppCompanyAction[]);

    // SF Events は自分の分のみ（全ユーザー分の SF 取得は N×API コールになるため）
    const sfId = profile.sf_account_id;
    let sfTasks: SalesforceEvent[] = [];
    let companyMap = new Map<string, { uid: string; name: string }>();

    if (sfId) {
      sfTasks = await activeSalesforceTaskAdapter.fetchEventsByOwner(sfId).catch(() => []);
      const whatIds = sfTasks.map(t => t.WhatId ?? '').filter(Boolean);
      companyMap = await buildCompanyMap(whatIds);
    }

    // SF event ID で直接引いた NocoDB actions を追加して nocoSfIds を確実に構築
    // （fetchAllActionsAdmin の limit:500 で古いアクションが切れても dedup が効くように）
    const sfEventIds = sfTasks.map(e => e.Id).filter(Boolean);
    const sfLinkedActions = await fetchNocoActionsBySfEventIds(sfEventIds);
    const allSfTodoIds = [
      ...nocoActions.map(a => a.sfTodoId),
      ...sfLinkedActions.map(a => a.sfTodoId),
    ].filter((id): id is string => !!id);
    const nocoSfIds = new Set(allSfTodoIds);
    const merged: ActionListItem[] = [];

    for (const action of nocoActions) {
      const inSf = action.sfTodoId ? nocoSfIds.has(action.sfTodoId) : false;
      merged.push({ ...action, _source: inSf ? 'both' : 'cxm' });
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const event of sfTasks) {
      if (nocoSfIds.has(event.Id)) continue;
      merged.push({ ...sfEventToAction(event, sfId!, companyMap, today), _source: 'sf' });
    }
    merged.sort((a, b) => {
      const sa = getPriorityScore(a, today);
      const sb = getPriorityScore(b, today);
      if (sa !== sb) return sa - sb;
      return a.createdAt.localeCompare(b.createdAt);
    });

    return NextResponse.json({
      actions:      merged,
      owner:        profile.name2,
      isAdminView:  true,
      sfEventCount: sfTasks.length,
    });
  }

  // ── 通常ユーザー ────────────────────────────────────────────────────────────

  if (!profile.sf_account_id) {
    return NextResponse.json({
      actions: [],
      owner:  profile.name2,
      warn:   'sf_account_id が未設定です（Settings でユーザーを選択してください）',
    });
  }

  const sfId = profile.sf_account_id;

  // 自分担当企業の UID / SF Account ID 一覧を取得
  const myCompanies = await fetchAllCompanies(500, profile.name2).catch(() => []);
  const myCompanyUids  = myCompanies.map(c => c.uid);
  const mySfAccountIds = new Set(myCompanies.map(c => c.sfAccountId).filter(Boolean) as string[]);

  // ── 並列フェッチ ────────────────────────────────────────────────────────────
  const [nocoActionsRaw, sfEventsRaw] = await Promise.all([
    fetchActionsByCompanyUids(myCompanyUids, includeDone).catch(() => [] as AppCompanyAction[]),
    activeSalesforceTaskAdapter.fetchEventsByOwner(sfId).catch(() => [] as SalesforceEvent[]),
  ]);

  // NocoDB: 自分担当企業 かつ 自分がオーナーのアクションに絞る
  const nocoActions = nocoActionsRaw.filter(a => a.ownerSfId === sfId);

  // SF Events: WhatId が自分担当企業の SF Account ID に含まれるものに絞る
  const sfTasks = mySfAccountIds.size > 0
    ? sfEventsRaw.filter(e => e.WhatId && mySfAccountIds.has(e.WhatId))
    : sfEventsRaw;

  // ── WhatId → company 解決 ──────────────────────────────────────────────────
  const whatIds = sfTasks.map(t => t.WhatId ?? '').filter(Boolean);
  const companyMap = await buildCompanyMap(whatIds);

  // ── マージ ─────────────────────────────────────────────────────────────────
  // SF event ID で直接引いた NocoDB actions を追加して nocoSfIds を確実に構築。
  // nocoActionsRaw（ownerSfId フィルタ前）も使うことで、owner 未設定アクションも dedup 対象にする。
  const sfEventIds2 = sfTasks.map(e => e.Id).filter(Boolean);
  const sfLinkedActions2 = await fetchNocoActionsBySfEventIds(sfEventIds2);
  const allSfTodoIds2 = [
    ...nocoActionsRaw.map(a => a.sfTodoId),
    ...sfLinkedActions2.map(a => a.sfTodoId),
  ].filter((id): id is string => !!id);
  const nocoSfIds = new Set(allSfTodoIds2);
  const merged: ActionListItem[] = [];

  for (const action of nocoActions) {
    const inSf = action.sfTodoId ? nocoSfIds.has(action.sfTodoId) : false;
    merged.push({ ...action, _source: inSf ? 'both' : 'cxm' });
  }
  // ── 優先順ソート ───────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  for (const event of sfTasks) {
    if (nocoSfIds.has(event.Id)) continue;
    const action = sfEventToAction(event, sfId, companyMap, today);
    merged.push({ ...action, _source: 'sf' });
  }
  merged.sort((a, b) => {
    const sa = getPriorityScore(a, today);
    const sb = getPriorityScore(b, today);
    if (sa !== sb) return sa - sb;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return NextResponse.json({
    actions:      merged,
    owner:        profile.name2,
    sfEventCount: sfTasks.length,
  });
}
