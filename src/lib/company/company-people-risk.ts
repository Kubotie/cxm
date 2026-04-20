// ─── Company People Risk ──────────────────────────────────────────────────────
//
// People / Org Chart に関するリスクを計算する。
// org-chart-vm.ts の OrgPersonRisk（個人単位）に加え、
// 企業単位のリスクシグナルを出力する。
//
// 用途:
//   - Overview の Health signal セクションに表示
//   - priority-score.ts の PriorityScoreInput に渡す
//   - Action の起票 prefill に活用
//
// このファイルは副作用なし。サーバー・クライアント両対応。

import type { AppPerson } from '@/lib/nocodb/types';
import { getPersonTier, getTouchpointAge } from './org-chart-vm';
import type { LocalAction } from './action-vm';

// ── 型定義 ────────────────────────────────────────────────────────────────────

/** 企業単位の People リスク種別 */
export type CompanyPeopleRiskType =
  | 'no_decision_maker'           // 意思決定者 (high influence) がいない
  | 'no_key_contact'              // high/medium influence のコンタクトが誰もいない
  | 'stale_decision_maker'        // 意思決定者が 90d+ 未接触
  | 'no_touchpoint_decision_maker' // 意思決定者の接触記録なし
  | 'stale_influencer'            // 影響者が 90d+ 未接触
  | 'owner_missing'               // owner 未設定の high influence 担当者がいる
  | 'overdue_actions'             // 期限切れ action がある
  | 'many_open_actions';          // open action が多数ある（警告）

export interface CompanyPeopleRisk {
  type:        CompanyPeopleRiskType;
  severity:    'high' | 'medium' | 'low';
  label:       string;
  description: string;
  /** 関係する person の id 一覧（UI でハイライトする用） */
  personIds:   string[];
}

// ── しきい値定数 ──────────────────────────────────────────────────────────────

const MANY_OPEN_ACTIONS_THRESHOLD = 5;

// ── People リスク計算 ─────────────────────────────────────────────────────────

/**
 * allContacts と localActions から企業単位の People リスクを計算する。
 *
 * @param contacts  マージ済み AppPerson[]（mergeCompanyPeople の出力）
 * @param actions   当該企業の open/in_progress アクション一覧
 */
export function calcCompanyPeopleRisks(
  contacts: AppPerson[],
  actions:  LocalAction[],
): CompanyPeopleRisk[] {
  const risks: CompanyPeopleRisk[] = [];
  const now = new Date();

  // ── 1. 意思決定者不在 ─────────────────────────────────────────────────────
  const decisionMakers = contacts.filter(
    p => getPersonTier(p.decisionInfluence) === 'decision_maker',
  );
  if (contacts.length > 0 && decisionMakers.length === 0) {
    risks.push({
      type:        'no_decision_maker',
      severity:    'high',
      label:       '意思決定者が未登録',
      description: '高影響度 (high) のコンタクトが存在しません。重要な意思決定者との関係構築が必要です。',
      personIds:   [],
    });
  }

  // ── 2. key contact（high/medium）不在 ──────────────────────────────────────
  const keyContacts = contacts.filter(p =>
    p.decisionInfluence === 'high' || p.decisionInfluence === 'medium',
  );
  if (contacts.length > 0 && keyContacts.length === 0) {
    risks.push({
      type:        'no_key_contact',
      severity:    'medium',
      label:       'Key Contact が未登録',
      description: '高・中影響度のコンタクトが存在しません。',
      personIds:   [],
    });
  }

  // ── 3. 意思決定者の接触状態 ────────────────────────────────────────────────
  for (const dm of decisionMakers) {
    const tpAge = getTouchpointAge(dm.lastTouchpoint);
    if (tpAge === 'stale') {
      risks.push({
        type:        'stale_decision_maker',
        severity:    'high',
        label:       `${dm.name}（意思決定者）が90日以上未接触`,
        description: `${dm.name}との最終接触から90日以上経過しています。フォローアップを計画してください。`,
        personIds:   [dm.id],
      });
    } else if (tpAge === 'none') {
      risks.push({
        type:        'no_touchpoint_decision_maker',
        severity:    'medium',
        label:       `${dm.name}（意思決定者）の接触記録なし`,
        description: `${dm.name}の接触記録がありません。初回コンタクトを計画してください。`,
        personIds:   [dm.id],
      });
    }
  }

  // ── 4. 影響者の接触状態 ────────────────────────────────────────────────────
  const influencers = contacts.filter(
    p => getPersonTier(p.decisionInfluence) === 'influencer',
  );
  const staleInfluencers = influencers.filter(
    p => getTouchpointAge(p.lastTouchpoint) === 'stale',
  );
  if (staleInfluencers.length > 0) {
    risks.push({
      type:        'stale_influencer',
      severity:    'medium',
      label:       `影響者 ${staleInfluencers.length}名が90日以上未接触`,
      description: staleInfluencers.map(p => p.name).join('、') + ' との接触が90日以上経過しています。',
      personIds:   staleInfluencers.map(p => p.id),
    });
  }

  // ── 5. key contact の owner 未設定 ─────────────────────────────────────────
  const noOwnerKeyContacts = decisionMakers.filter(p => !p.owner);
  if (noOwnerKeyContacts.length > 0) {
    risks.push({
      type:        'owner_missing',
      severity:    'low',
      label:       `意思決定者 ${noOwnerKeyContacts.length}名のオーナー未設定`,
      description: noOwnerKeyContacts.map(p => p.name).join('、') + ' のオーナー（担当 CSM）が未設定です。',
      personIds:   noOwnerKeyContacts.map(p => p.id),
    });
  }

  // ── 6. 期限切れ Action ─────────────────────────────────────────────────────
  const overdueActions = actions.filter(a => {
    if (a.status !== 'open' && a.status !== 'in_progress') return false;
    if (!a.dueDate) return false;
    return new Date(a.dueDate) < now;
  });
  if (overdueActions.length > 0) {
    risks.push({
      type:        'overdue_actions',
      severity:    'high',
      label:       `期限切れ Action ${overdueActions.length}件`,
      description: `期日を過ぎた open action が ${overdueActions.length}件あります。早急に対応してください。`,
      personIds:   [],
    });
  }

  // ── 7. open action 多数 ────────────────────────────────────────────────────
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress');
  if (openActions.length >= MANY_OPEN_ACTIONS_THRESHOLD) {
    risks.push({
      type:        'many_open_actions',
      severity:    'low',
      label:       `Open Action ${openActions.length}件`,
      description: `未完了の Action が ${openActions.length}件あります。優先度を整理することをお勧めします。`,
      personIds:   [],
    });
  }

  return risks;
}

// ── Priority score 用のシグナル集約 ──────────────────────────────────────────

export interface PeopleActionSignal {
  /** 意思決定者不在 */
  hasNoDecisionMaker:       boolean;
  /** 意思決定者が stale */
  hasStaleDm:               boolean;
  /** 期限切れ Action がある */
  hasOverdueActions:        boolean;
  /** open action 数 */
  openActionCount:          number;
  /** key contact (high/medium) 数 */
  keyContactCount:          number;
}

/**
 * PriorityScore 計算に渡す People/Action シグナルを集約する。
 */
export function buildPeopleActionSignal(
  contacts: AppPerson[],
  actions:  LocalAction[],
): PeopleActionSignal {
  const now = new Date();
  const decisionMakers = contacts.filter(
    p => getPersonTier(p.decisionInfluence) === 'decision_maker',
  );
  return {
    hasNoDecisionMaker: contacts.length > 0 && decisionMakers.length === 0,
    hasStaleDm: decisionMakers.some(p => getTouchpointAge(p.lastTouchpoint) === 'stale'),
    hasOverdueActions: actions.some(a => {
      if (a.status !== 'open' && a.status !== 'in_progress') return false;
      return !!a.dueDate && new Date(a.dueDate) < now;
    }),
    openActionCount: actions.filter(a => a.status === 'open' || a.status === 'in_progress').length,
    keyContactCount: contacts.filter(
      p => p.decisionInfluence === 'high' || p.decisionInfluence === 'medium',
    ).length,
  };
}
