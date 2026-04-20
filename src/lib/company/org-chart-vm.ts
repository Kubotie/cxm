// ─── Org Chart View Model ─────────────────────────────────────────────────────
//
// AppPerson[] → OrgChartVM
//
// ViewModel separating display logic from raw data.
// Supports Salesforce Contact / CXM-only mixed sources without code changes.
// Risk signals (stale high-influence contacts) are surfaced here.
//
// Consumed by: src/components/pages/company-detail.tsx (PeopleTab / OrgChartSection)

import type { AppPerson } from '@/lib/nocodb/types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Hierarchy tier derived from decisionInfluence */
export type PersonTier = 'decision_maker' | 'influencer' | 'operator' | 'unclassified';

/**
 * 意思決定構造上のレイヤー（5段階）。
 * 現時点は decisionInfluence + title/role のキーワードから暫定推定する。
 * 将来 company_people テーブルに以下のカラムを追加すれば精度が上がる:
 *   - layer_role          TEXT   'executive'|'department_head'|'manager'|'operator'|'unclassified'
 *   - is_executive        BOOL   経営層フラグ
 *   - is_department_head  BOOL   部署長フラグ
 *   - reports_to_person_id TEXT  直属の上長 person_id（manager_id と統合 or 別持ち）
 *   - display_group       TEXT   グルーピング用の任意ラベル
 *   - works_with_person_ids TEXT JSON配列: 横断的協働関係
 *   - stakeholder_note    TEXT   CSM 主観メモ
 */
export type OrgLayer = 'executive' | 'department_head' | 'manager' | 'operator' | 'unclassified';

/** How recently the person was last contacted */
export type TouchpointAge = 'recent' | 'warn' | 'stale' | 'none';

/**
 * Where the contact record originated.
 * 'salesforce' = synced from Salesforce Contact
 * 'cxm'        = added in CXM only (no SF record)
 * 'unknown'    = source not yet determined
 */
export type PersonSource = 'salesforce' | 'cxm' | 'unknown';

export interface OrgPersonRisk {
  personId:    string;
  personName:  string;
  type:        'stale_decision_maker' | 'no_touchpoint_high' | 'stale_influencer';
  severity:    'high' | 'medium';
  label:       string;
  description: string;
}

export interface OrgPersonVM {
  id:               string;
  name:             string;
  initials:         string;
  title?:           string;
  department?:      string;
  role:             string;
  tier:             PersonTier;
  /** Localised display label for the tier */
  tierLabel:        string;
  /**
   * 5段階のレイヤー（経営層〜未分類）。
   * 優先度: layerRole 明示 > is_executive/is_department_head > キーワード推定
   */
  layerRole:        OrgLayer;
  /** レイヤーが実データから確定している場合 true（キーワード推定の場合 false） */
  layerIsExplicit:  boolean;
  touchpointAge:    TouchpointAge;
  source:           PersonSource;
  isOwner:          boolean;
  isProposed:       boolean;
  email?:           string;
  riskFlags:        OrgPersonRisk[];
  /**
   * 横断協働関係の person_id リスト（works_with_person_ids から解決）。
   * 表示用: 連携: N名、hover で名前一覧
   */
  worksWithPersonIds: string[];
  /**
   * 上長解決に使ったフィールド。
   * 'reports_to' = reportsToPersonId が使われた（精度高）
   * 'manager'    = managerId が fallback として使われた（旧フィールド）
   * null         = 上長なし
   */
  parentSource:     'reports_to' | 'manager' | null;
  /** Pre-computed for ActionCreateDialog.prefillTitle */
  actionPrefillTitle: string;
  /** Pre-computed for ActionCreateDialog.prefillBody */
  actionPrefillBody:  string;
  /** Original AppPerson — use for edit callbacks and raw field access */
  raw: AppPerson;
}

// ── Relation edge (SVG / graph 拡張用) ────────────────────────────────────────

/**
 * 人物間の関係エッジ。
 * 現在の Layered / Tree ビューでは直接使用しないが、
 * 将来の OrgChartGraph（SVG overlay）が参照できるよう VM で保持する。
 *
 * type:
 *   'reports_to' — reports_to_person_id 由来の上下関係（精度高）
 *   'manager'    — manager_id 由来の上下関係（旧フィールド fallback）
 *   'works_with' — works_with_person_ids 由来の横断協働関係
 */
export interface RelationEdge {
  fromPersonId: string;
  toPersonId:   string;
  type:         'reports_to' | 'manager' | 'works_with';
}

// ── Manager tree node (for hierarchy display) ────────────────────────────────

export interface OrgTreeNode {
  person:    OrgPersonVM;
  children:  OrgTreeNode[];
  /** 0 = root (no parent), 1+ = depth */
  depth:     number;
}

/**
 * Org chart の描画モード。
 * 'manager_tree' — manager_id が十分にあり階層ツリーを構築できる
 * 'tier'         — tier（decisionInfluence）ベースのフラット表示
 * 'department'   — 情報不足のため部署ごとのフラット表示
 */
export type OrgDisplayMode = 'manager_tree' | 'tier' | 'department';

export interface OrgChartVM {
  persons:            OrgPersonVM[];
  /** Persons grouped by PersonTier (all four tiers always present, may be empty) */
  tiers:              Record<PersonTier, OrgPersonVM[]>;
  /** Persons grouped by OrgLayer (5 layers always present, may be empty) */
  byLayer:            Record<OrgLayer, OrgPersonVM[]>;
  /** Persons grouped by department name; empty department key = '（部署不明）' */
  byDepartment:       Record<string, OrgPersonVM[]>;
  /**
   * Persons grouped by display_group (CSM が設定したグルーピングラベル).
   * display_group が未設定の場合は department を fallback とし、
   * それも未設定なら '（グループ不明）' に入る。
   * sync-policy.ts: ORG_GROUP_RESOLUTION_PRIORITY 参照。
   */
  byDisplayGroup:     Record<string, OrgPersonVM[]>;
  /** True when at least one person has a tier other than 'unclassified' */
  hasHierarchy:       boolean;
  /** Flat list of all risk flags across all persons */
  peopleRisks:        OrgPersonRisk[];
  /** Subset: decision_makers with stale or missing touchpoint */
  staleHighInfluence: OrgPersonVM[];
  // ── Manager tree ─────────────────────────────────────────────────────────
  /** 推奨描画モード（データ品質に応じて自動選択） */
  displayMode:        OrgDisplayMode;
  /** manager tree のルートノード群（displayMode === 'manager_tree' のときに使う） */
  treeRoots:          OrgTreeNode[];
  /** manager_id カバレッジ（0.0〜1.0）。0.6 以上で 'manager_tree' に切り替わる */
  managerCoverage:    number;
  /**
   * 全関係エッジのフラットリスト。
   * 現在の Layered / Tree ビューは直接使わないが、
   * 将来 OrgChartGraph（SVG overlay）が参照できるよう保持する。
   * reports_to > manager > works_with の全エッジを含む。
   */
  edges:              RelationEdge[];
}

// ── Layer inference ───────────────────────────────────────────────────────────
//
// 追加データが埋まるまでの暫定ルール:
//   1. 将来フィールド (layer_role / is_executive / is_department_head) が存在すれば優先
//   2. decisionInfluence=high + exec キーワード → executive
//   3. decisionInfluence=high + dept_head キーワード → department_head
//   4. decisionInfluence=high (キーワードなし) → executive (高影響力=経営層と仮定)
//   5. decisionInfluence=medium + dept_head キーワード → department_head
//   6. decisionInfluence=medium → manager
//   7. decisionInfluence=low → operator
//   8. decisionInfluence=unknown → unclassified

const EXEC_KEYWORDS = [
  'ceo', 'cto', 'coo', 'cfo', 'cmo', 'cso', 'cpo', 'evp', 'svp',
  'vp ', 'v.p.', 'vice president', 'president', 'executive',
  'director',
  '社長', '会長', '専務', '常務', '取締役', '代表',
];

const DEPT_HEAD_KEYWORDS = [
  'manager', 'head of', ' head', 'lead', 'chief', 'gm', 'general manager',
  'マネージャー', '部長', '課長', '室長', 'リーダー', 'グループ長',
];

const VALID_LAYERS = new Set<string>([
  'executive', 'department_head', 'manager', 'operator', 'unclassified',
]);

/**
 * AppPerson の既存フィールドから OrgLayer を解決する。
 *
 * 優先順位:
 *   1. layer_role フィールドが有効な値を持つ場合 → 最優先（CSM が明示的に設定）
 *   2. is_executive === true → 'executive'
 *   3. is_department_head === true → 'department_head'
 *   4. reports_to_person_id / manager_id は接続に使うが layerRole には直接影響しない
 *   5. decisionInfluence + title/role キーワード → 暫定推定
 *   6. 最後に 'unclassified'
 */
export function inferOrgLayer(person: AppPerson): { layer: OrgLayer; explicit: boolean } {
  // ── Step 1: 明示的な layer_role ─────────────────────────────────────────
  if (person.layerRole && VALID_LAYERS.has(person.layerRole)) {
    return { layer: person.layerRole as OrgLayer, explicit: true };
  }

  // ── Step 2: is_executive / is_department_head フラグ ─────────────────────
  if (person.isExecutive)      return { layer: 'executive',       explicit: true };
  if (person.isDepartmentHead) return { layer: 'department_head', explicit: true };

  // ── Step 3: title / role キーワードによる暫定推定 ─────────────────────────
  const combined = `${(person.title ?? '').toLowerCase()} ${(person.role ?? '').toLowerCase()}`;

  if (person.decisionInfluence === 'high') {
    if (EXEC_KEYWORDS.some(k => combined.includes(k)))       return { layer: 'executive',       explicit: false };
    if (DEPT_HEAD_KEYWORDS.some(k => combined.includes(k))) return { layer: 'department_head', explicit: false };
    return { layer: 'executive', explicit: false }; // 高影響力かつキーワードなし → 経営層と仮定
  }
  if (person.decisionInfluence === 'medium') {
    if (DEPT_HEAD_KEYWORDS.some(k => combined.includes(k))) return { layer: 'department_head', explicit: false };
    return { layer: 'manager', explicit: false };
  }
  if (person.decisionInfluence === 'low') return { layer: 'operator',       explicit: false };
  return { layer: 'unclassified', explicit: false };
}

// ── Relation Policy (Single Source of Truth) ─────────────────────────────────
//
// ① 縦関係（上下関係・親子関係）
//    reports_to_person_id が最優先。CSM が UI で設定した精確な上長。
//    reports_to_person_id が null の場合に限り manager_id を fallback として使う。
//    manager_id は SF ReportsToId 由来の旧フィールドで、SF sync 時に上書きされる場合がある。
//    → 新規設定は必ず reports_to_person_id を使うこと（manager_id は読み取り互換のみ）。
//
// ② 横断協働関係
//    works_with_person_ids は CXM 主。SF には同期しない。
//    CSM が UI で自由に編集できる。
//    双方向補完: person A が B を works_with に含めれば B のカードにも反映（buildOrgChartVM で処理）。
//
// ③ 関係性の編集箇所
//    ContactFormDialog の「組織上の関係性」セクションのみで行う。
//    NocoDB PATCH 経由で company_people テーブルに永続化される。
//    編集後は setLocalContacts → allContacts (useMemo) → orgVM (useMemo) の
//    チェーンで自動再計算・再描画される。SF 側への書き戻しは行わない。
//
// ④ parentSource（OrgPersonVM.parentSource）
//    上長解決に使ったフィールドを記録。'reports_to' = 精確、'manager' = fallback。
//    OrgPersonNode の tooltip で表示し、CSM がデータ品質を把握できるようにする。
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 親子関係解決: reports_to_person_id を優先し、なければ manager_id を使う。
 * sync-policy.ts の ORG_PARENT_RESOLUTION_PRIORITY と一致させること。
 */
export function resolveParentId(person: AppPerson): string | null {
  return person.reportsToPersonId ?? person.managerId ?? null;
}

// ── Tier display labels ───────────────────────────────────────────────────────

const TIER_LABEL: Record<PersonTier, string> = {
  decision_maker: '意思決定者',
  influencer:     '影響者',
  operator:       '実務担当',
  unclassified:   '未分類',
};

// ── Pure logic helpers (exported for reuse / testing) ─────────────────────────

/** Map AppPerson.decisionInfluence → PersonTier */
export function getPersonTier(influence: AppPerson['decisionInfluence']): PersonTier {
  switch (influence) {
    case 'high':   return 'decision_maker';
    case 'medium': return 'influencer';
    case 'low':    return 'operator';
    default:       return 'unclassified';
  }
}

/** Compute staleness of the last recorded touchpoint */
export function getTouchpointAge(tp: string | null | undefined): TouchpointAge {
  if (!tp) return 'none';
  const days = (Date.now() - new Date(tp).getTime()) / 86_400_000;
  if (isNaN(days)) return 'none';
  if (days > 90) return 'stale';
  if (days > 30) return 'warn';
  return 'recent';
}

// ── Private helpers ───────────────────────────────────────────────────────────

function detectSource(person: AppPerson): PersonSource {
  // source フィールドが明示的に設定されている場合（company_people テーブル由来）は優先する
  if (person.source === 'salesforce') return 'salesforce';
  if (person.source === 'cxm')        return 'cxm';
  // SF 連動済みの場合（sfId がある、または status === 'confirmed'）は salesforce 扱い
  if (person.sfId || person.syncStatus === 'synced') return 'salesforce';
  if (person.status === 'confirmed')  return 'salesforce';
  if (person.status === 'proposed')   return 'cxm';
  return 'unknown';
}

function buildRiskFlags(
  person: AppPerson,
  tier:   PersonTier,
  tpAge:  TouchpointAge,
): OrgPersonRisk[] {
  const risks: OrgPersonRisk[] = [];
  const roleLabel = person.title ?? person.role ?? '';

  if (tier === 'decision_maker' && tpAge === 'stale') {
    risks.push({
      personId:    person.id,
      personName:  person.name,
      type:        'stale_decision_maker',
      severity:    'high',
      label:       `${person.name}（意思決定者）が90日以上未接触`,
      description: `${person.name}（${roleLabel}）との最終接触から90日以上経過しています。フォローアップを検討してください。`,
    });
  } else if (tier === 'decision_maker' && tpAge === 'none') {
    risks.push({
      personId:    person.id,
      personName:  person.name,
      type:        'no_touchpoint_high',
      severity:    'medium',
      label:       `${person.name}（意思決定者）の接触記録なし`,
      description: `${person.name}（${roleLabel}）の接触記録がありません。初回コンタクトを計画してください。`,
    });
  } else if (tier === 'influencer' && tpAge === 'stale') {
    risks.push({
      personId:    person.id,
      personName:  person.name,
      type:        'stale_influencer',
      severity:    'medium',
      label:       `${person.name}（影響者）が90日以上未接触`,
      description: `${person.name}との最終接触から90日以上経過しています。`,
    });
  }

  return risks;
}

function buildActionPrefill(person: AppPerson): { title: string; body: string } {
  const role    = person.title ?? person.role ?? '';
  const deptStr = person.department ? `（${person.department}）` : '';
  const lines   = [
    `対象: ${person.name}`,
    role        && `役職: ${role}`,
    person.department  && `部署: ${person.department}`,
    person.email       && `メール: ${person.email}`,
    person.lastTouchpoint && `最終接触: ${person.lastTouchpoint}`,
  ].filter(Boolean) as string[];
  return {
    title: `${person.name}${deptStr} へのフォローアップ`,
    body:  lines.join('\n'),
  };
}

// ── Builder ───────────────────────────────────────────────────────────────────

// ── Manager tree builder ──────────────────────────────────────────────────────

/**
 * OrgPersonVM[] から reports_to_person_id > manager_id を使ってツリー構造を構築する。
 * 循環参照防止のため visited Set を使う。
 *
 * @returns ルートノードの配列（親なし、または親が見つからない人物）
 */
function buildManagerTree(persons: OrgPersonVM[]): OrgTreeNode[] {
  const byId   = new Map<string, OrgPersonVM>();
  for (const p of persons) byId.set(p.id, p);

  const visited = new Set<string>();

  function buildNode(vm: OrgPersonVM, depth: number): OrgTreeNode {
    visited.add(vm.id);
    const children = persons
      .filter(p => resolveParentId(p.raw) === vm.id && !visited.has(p.id))
      .map(child => buildNode(child, depth + 1));
    return { person: vm, children, depth };
  }

  // ルート: 親が存在しない / 自己参照 / グラフ外を指している人
  const roots = persons
    .filter(p => {
      const pid = resolveParentId(p.raw);
      if (!pid) return true;
      if (pid === p.id) return true;   // self-reference → root
      return !byId.has(pid);           // 外部（SF parent 等）→ root 扱い
    })
    .map(p => buildNode(p, 0));

  // ツリーに含まれなかった人（孤立ノード）を depth 0 で追加
  const orphans = persons
    .filter(p => !visited.has(p.id))
    .map(p => ({ person: p, children: [], depth: 0 }));

  return [...roots, ...orphans];
}

/**
 * 親子リンクカバレッジ（reports_to_person_id or manager_id が有効な人の割合）を計算する。
 * reports_to_person_id が設定されていれば manager_id より精度が高いとみなす。
 */
function calcManagerCoverage(persons: OrgPersonVM[]): number {
  if (persons.length <= 1) return 0;
  const byId = new Map(persons.map(p => [p.id, p]));
  // 意思決定者以外が対象（彼らの parent は外部の場合が多い）
  const candidates = persons.filter(p => p.tier !== 'decision_maker');
  if (candidates.length === 0) return 0;
  const withParent = candidates.filter(p => {
    const pid = resolveParentId(p.raw);
    return pid && pid !== p.id && byId.has(pid);
  });
  return withParent.length / candidates.length;
}

function resolveDisplayMode(
  hasHierarchy: boolean,
  managerCoverage: number,
  personCount: number,
): OrgDisplayMode {
  if (personCount === 0) return 'tier';
  if (managerCoverage >= 0.6) return 'manager_tree';
  if (hasHierarchy)           return 'tier';
  return 'department';
}

/**
 * Build an OrgChartVM from a merged list of AppPerson (API + locally added).
 * Call this in PeopleTab once and pass the result down to all org chart sub-components.
 */
export function buildOrgChartVM(contacts: AppPerson[]): OrgChartVM {
  const personsBase: OrgPersonVM[] = contacts.map(person => {
    const tier            = getPersonTier(person.decisionInfluence);
    const { layer, explicit } = inferOrgLayer(person);
    const tpAge           = getTouchpointAge(person.lastTouchpoint);
    const source          = detectSource(person);
    const risks           = buildRiskFlags(person, tier, tpAge);
    const prefill         = buildActionPrefill(person);
    const worksWithPersonIds = Array.isArray(person.worksWithPersonIds)
      ? person.worksWithPersonIds
      : [];

    // 上長解決元を記録（tooltip / UI 表示用）
    const parentSource: OrgPersonVM['parentSource'] =
      person.reportsToPersonId ? 'reports_to' :
      person.managerId          ? 'manager'    :
      null;

    return {
      id:                 person.id,
      name:               person.name,
      initials:           person.name.slice(0, 1),
      title:              person.title,
      department:         person.department,
      role:               person.role ?? '',
      tier,
      tierLabel:          TIER_LABEL[tier],
      layerRole:          layer,
      layerIsExplicit:    explicit,
      touchpointAge:      tpAge,
      source,
      worksWithPersonIds,
      parentSource,
      isOwner:            !!person.owner,
      isProposed:         person.status === 'proposed',
      email:              person.email,
      riskFlags:          risks,
      actionPrefillTitle: prefill.title,
      actionPrefillBody:  prefill.body,
      raw:                person,
    };
  });

  // ── works_with 双方向補完（VM表示専用・DB保存値は変更しない）─────────────────
  // A.worksWithPersonIds に B が含まれる場合、B.worksWithPersonIds にも A を補完。
  // カードの ⇌ N名 バッジと RelationEdge.type='works_with' の意味を一致させる。
  const wwExpand = new Map<string, Set<string>>(
    personsBase.map(p => [p.id, new Set(p.worksWithPersonIds)]),
  );
  for (const p of personsBase) {
    for (const wid of p.worksWithPersonIds) {
      if (wwExpand.has(wid)) wwExpand.get(wid)!.add(p.id); // 逆方向補完
    }
  }
  const persons: OrgPersonVM[] = personsBase.map(p => ({
    ...p,
    worksWithPersonIds: Array.from(wwExpand.get(p.id) ?? []),
  }));

  // Tier grouping — all four tiers always present
  const tiers: Record<PersonTier, OrgPersonVM[]> = {
    decision_maker: [],
    influencer:     [],
    operator:       [],
    unclassified:   [],
  };
  for (const p of persons) tiers[p.tier].push(p);

  // Layer grouping — all five layers always present
  const byLayer: Record<OrgLayer, OrgPersonVM[]> = {
    executive:       [],
    department_head: [],
    manager:         [],
    operator:        [],
    unclassified:    [],
  };
  for (const p of persons) byLayer[p.layerRole].push(p);

  // Department grouping
  const byDepartment: Record<string, OrgPersonVM[]> = {};
  for (const p of persons) {
    const dept = p.department?.trim() || '（部署不明）';
    if (!byDepartment[dept]) byDepartment[dept] = [];
    byDepartment[dept].push(p);
  }

  // Display group grouping: display_group 優先 → department fallback → '（グループ不明）'
  // sync-policy.ts ORG_GROUP_RESOLUTION_PRIORITY に準拠
  const byDisplayGroup: Record<string, OrgPersonVM[]> = {};
  for (const p of persons) {
    const grp = p.raw.displayGroup?.trim() || p.department?.trim() || '（グループ不明）';
    if (!byDisplayGroup[grp]) byDisplayGroup[grp] = [];
    byDisplayGroup[grp].push(p);
  }

  const peopleRisks        = persons.flatMap(p => p.riskFlags);
  const staleHighInfluence = persons.filter(
    p => p.tier === 'decision_maker' && (p.touchpointAge === 'stale' || p.touchpointAge === 'none'),
  );
  const hasHierarchy      = persons.some(p => p.tier !== 'unclassified');
  const managerCoverage   = calcManagerCoverage(persons);
  const displayMode       = resolveDisplayMode(hasHierarchy, managerCoverage, persons.length);
  const treeRoots         = displayMode === 'manager_tree' ? buildManagerTree(persons) : [];

  // ── RelationEdge list（将来の SVG/graph 拡張用） ──────────────────────────────
  const personIdSet = new Set(persons.map(p => p.id));
  const edges: RelationEdge[] = [];
  for (const p of persons) {
    // 上下関係: reports_to_person_id 優先 → manager_id fallback
    const parentId = p.raw.reportsToPersonId ?? p.raw.managerId ?? null;
    if (parentId && parentId !== p.id && personIdSet.has(parentId)) {
      edges.push({
        fromPersonId: p.id,
        toPersonId:   parentId,
        type:         p.raw.reportsToPersonId ? 'reports_to' : 'manager',
      });
    }
    // 横断協働関係（重複を避けるため from < to の順でのみ追加）
    for (const wid of p.worksWithPersonIds) {
      if (personIdSet.has(wid) && p.id < wid) {
        edges.push({ fromPersonId: p.id, toPersonId: wid, type: 'works_with' });
      }
    }
  }

  return {
    persons, tiers, byLayer, byDepartment, byDisplayGroup, hasHierarchy, peopleRisks, staleHighInfluence,
    displayMode, treeRoots, managerCoverage, edges,
  };
}

// ── Graph モード拡張の方針（将来実装用メモ） ─────────────────────────────────
//
// 現在の描画モード: 'manager_tree' | 'layered' | 'tier'（company-detail.tsx 内で切替）
//
// layered モードでは DOM 計測ベースの SVG ベジェ曲線を実装済み:
//   - containerRef → [data-pid] → getBoundingClientRect() で座標取得
//   - reports_to → 実線 sky-300(#7dd3fc)、manager → 破線 slate-200(#e2e8f0)
//   - 毎 render 後に再計測（resize/layout 変化に自動追従）
//   - works_with: hover で相手カードを ring-2 ring-indigo-300 でハイライト
//
// 追加予定モード: 'graph'（自由配置 + フル関係線 SVG）
//
// 【次の一手（graph モード実装時）】
//   1. npm install dagre  ← 階層レイアウトエンジン（MIT、~50kB）
//   2. company-detail.tsx の mode state に 'graph' を追加、切替ボタン追加
//   3. OrgChartGraph コンポーネント新規作成:
//      - dagre.layout() で persons → {x, y} 座標を計算
//      - SVG foreignObject でカード、<path> で関係線を描画
//      - react-zoom-pan-pinch で zoom/pan 対応
//   4. vm.edges の利用:
//      const coordMap = new Map<string, {x: number; y: number}>();
//      for (const e of vm.edges) {
//        const from = coordMap.get(e.fromPersonId);
//        const to   = coordMap.get(e.toPersonId);
//        if (from && to) drawEdge(from, to, e.type);
//        // type: 'reports_to' → 実線 / 'manager' → 破線 / 'works_with' → 点線
//      }
//
// 【layered モードとの差分】
//   layered: 帯状レイアウト固定、DOM 計測で線を後付け → シンプルだが自由度低い
//   graph:   dagre による最適配置、全関係線を表現可能 → 実装コスト高、zoom 必要
//
// 【まだ必要なもの】
//   - dagre（または d3-hierarchy / elkjs）
//   - react-zoom-pan-pinch（zoom/pan UI）
//   - 大人数時のパフォーマンス対策（仮想化 or canvas 化、20名超で要検討）
//
// ─────────────────────────────────────────────────────────────────────────────
