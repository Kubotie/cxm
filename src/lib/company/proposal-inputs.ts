// ─── 提案の材料（Evidence）を集める ──────────────────────────────────────────
//
// 提案準備タブの3段フロー（材料を選ぶ → WHATを選ぶ → ストーリーを作る）の第1段。
//
// 設計の要:
//   1. **材料は「状況IDを運ぶもの」と「運ばないもの」に分かれる。**
//      運ぶもの（行動シグナル・準備度・外部情報・手動登録）を外すと WHAT の候補が実際に変わる。
//      運ばないもの（議事録本文・顧客理解・利用実態の生値）は WHAT 選定には影響せず、
//      ストーリーの材料としてだけ効く。**この違いを UI で隠さない。**
//      隠すと「チェックを外したのに候補が変わらない」が不具合に見える。
//   2. **IDは安定させる。** 再生成・再選択で同じ材料を追跡するため、
//      行番号や配列順ではなく内容から決まるキーを使う。
//   3. **confidence を必ず持たせる。** 観測（measured）/ 推論（inferred）/ 申告（stated）は
//      提案文での扱いが違う。推論を観測として語らせないための土台。
//   4. 鮮度（asOf）を持たせる。古い材料を根拠に「今」を語らせない。
//
// 副作用なし。サーバー・クライアント両対応。

import type { ProposalReadinessVM, ProposalPlay, RenewalBucket } from '@/lib/company/proposal-readiness';
import type { CaseEntry, PlaybookEntry } from '@/lib/notion/what-catalog';
import type { DetectedBehaviorSignal } from '@/lib/company/behavior-signals';

// ── 型 ────────────────────────────────────────────────────────────────────────

export type EvidenceKind =
  | 'readiness'      // 準備度の4要素
  | 'play'           // 提案の型（準備度から導出）
  | 'renewal'        // 契約更新の位置
  | 'behavior'       // 内部・行動シグナル（R/O/H）
  | 'external'       // 外部情報（X系）
  | 'manual'         // 手動登録の状況
  | 'case'           // 事例（活用ギャラリー）— Proof の材料
  | 'playbook'       // 施策・問い（E）— Approach / Execution の材料
  | 'usage'          // 利用実態の生値
  | 'communication'  // 議事録・コミュニケーション本文
  | 'profile';       // 顧客理解プロファイル

/** 材料の確度。提案文での語り方を変えるために区別する */
export type EvidenceConfidence =
  | 'measured'   // 観測値（Metabase / NocoDB の実測）
  | 'inferred'   // 推論（LLM抽出・キーワード判定）
  | 'stated';    // 申告・記述（議事録の発言・担当者入力）

export interface EvidenceItem {
  /** 安定ID。選択状態と生成結果の紐付けに使う */
  id:      string;
  kind:    EvidenceKind;
  title:   string;
  /** 実測値・本文抜粋。ストーリー生成でそのまま根拠として渡る */
  detail:  string;
  /**
   * この材料が根拠づける状況ID。
   * **空配列 = WHAT 選定には影響しない**（ストーリーの材料としてのみ効く）。
   */
  situationIds: string[];
  /** 出所。どこを見れば裏が取れるか */
  source:  string;
  asOf:    string | null;
  confidence: EvidenceConfidence;
  /** 近似判定で立った材料（定義そのままでない） */
  approximate: boolean;
  /** 初期状態で選択しておくか */
  defaultSelected: boolean;
}

export interface EvidenceGroup {
  kind:  EvidenceKind;
  label: string;
  /** この群の材料が WHAT 選定に影響するか（UI の説明に使う） */
  affectsWhat: boolean;
  note:  string;
  items: EvidenceItem[];
  /**
   * 件数を絞った場合の内訳。**黙って切り捨てない。**
   * 絞ったことが見えないと「事例が少ない」と誤解される。
   */
  truncated?: { shown: number; total: number; reason: string };
}

// ── 群の定義 ──────────────────────────────────────────────────────────────────

const GROUP_META: Record<EvidenceKind, { label: string; affectsWhat: boolean; note: string }> = {
  behavior: {
    label: '観測された行動', affectsWhat: true,
    note: '利用・接点・サポートの実測から自動検出したもの。外すとWHATの候補が変わります。',
  },
  readiness: {
    label: '提案準備度', affectsWhat: true,
    note: '低い要素だけが状況として効きます。外すとWHATの候補が変わります。',
  },
  play: {
    label: '提案の型', affectsWhat: true,
    note: '準備度・外部機会・更新時期から導出。ほぼ全てのWHATがこれを見ています。',
  },
  renewal: {
    label: '契約更新の位置', affectsWhat: true,
    note: '満了91〜31日前は解約判断期。提案の可否そのものに関わります。',
  },
  external: {
    label: '外部情報', affectsWhat: true,
    note: '登録済みの外部シグナル。「なぜ今か」の根拠になります。',
  },
  manual: {
    label: '手動登録の状況', affectsWhat: true,
    note: '自動検出できない状況（データ整備・体制・意思決定など）。',
  },
  case: {
    label: '事例（活用ギャラリー）', affectsWhat: false,
    note: '状況が一致した事例だけを出しています。Proof（なぜ実現できると言えるか）の材料になります。'
        + '「社名非公開」は展開可否がぼかしのため伏せてあります。',
  },
  playbook: {
    label: '施策・問い', affectsWhat: false,
    note: '状況が一致した施策と自然言語クエリ。Approach と Execution の材料になります。'
        + '注意書き（※）は制約なので落とさず渡します。',
  },
  usage: {
    label: '利用実態の生値', affectsWhat: false,
    note: 'WHATの選定には使いません。ストーリーで具体的な数字を出すための材料です。',
  },
  communication: {
    label: '会話・議事録', affectsWhat: false,
    note: 'WHATの選定には使いません。相手の言葉をストーリーに反映するための材料です。',
  },
  profile: {
    label: '顧客理解', affectsWhat: false,
    note: 'WHATの選定には使いません。前提認識の記述に使います。',
  },
};

// ── 入力 ──────────────────────────────────────────────────────────────────────

export interface BuildEvidenceInput {
  readiness:      ProposalReadinessVM | null;
  play:           ProposalPlay | null;
  playLabel:      string | null;
  renewalBucket:  RenewalBucket | null;
  renewalDate:    string | null;
  renewalDaysLeft: number | null;
  behavior:       DetectedBehaviorSignal[];
  external:       Array<{
    id: string; signalId: string; title: string; summary: string;
    sourceUrl: string | null; asOf: string | null;
  }>;
  manualSituations: Array<{ situationId: string; note: string; source: string | null; observedAt: string | null }>;
  usage: {
    campaigns: number | null; heatmaps: number | null; l30Active: number | null;
    pvRate: number | null; lastActiveDate: string | null; paidProjectCount: number;
  } | null;
  communications: Array<{
    id: string; channel: string; title: string; body: string; date: string | null;
  }>;
  profileSections: Array<{ key: string; label: string; text: string; asOf: string | null }>;
  /**
   * 事例・施策の候補（カタログ由来）。
   * **状況が交差するものだけをカードにする。** 全件出すとカード選択が破綻する
   * （事例は80件ある）。
   */
  cases?:     CaseEntry[];
  playbooks?: PlaybookEntry[];
  /** 交差判定に使う状況ID */
  activeSignals?: string[];
}

/** 事例の表示件数の上限（Proof形式ごと）。全件出すとカード選択が破綻する */
const CASE_LIMIT_PER_PROOF = 2;

/** 準備度の factor が「低い」とみなすしきい値（what-matching と揃える） */
const LOW_FACTOR_SCORE = 45;

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function buildEvidenceGroups(input: BuildEvidenceInput): EvidenceGroup[] {
  const byKind = new Map<EvidenceKind, EvidenceItem[]>();
  const push = (item: EvidenceItem) => {
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  };

  // ── 観測された行動（R/O/H）────────────────────────────────────────────
  for (const b of input.behavior) {
    push({
      id: `behavior:${b.id}`,
      kind: 'behavior',
      title: b.id,
      detail: b.detail,
      situationIds: [b.id],
      source: 'Metabase / NocoDB の実測',
      asOf: null,
      confidence: 'measured',
      approximate: b.approximate,
      // 近似判定のものも既定で入れる（外す判断は担当者に委ねる）
      defaultSelected: true,
    });
  }

  // ── 提案準備度の4要素 ─────────────────────────────────────────────────
  const f = input.readiness?.factors;
  if (f) {
    const factors: Array<[string, string, typeof f.utilization]> = [
      ['RD_Util_Low',      '利用の充足', f.utilization],
      ['RD_Exec_Low',      '実行体制',   f.execution],
      ['RD_Rel_Cold',      '関係の温度', f.relationship],
      ['RD_Friction_High', '摩擦の少なさ', f.friction],
    ];
    for (const [sid, label, factor] of factors) {
      const low = factor.score !== null && factor.score < LOW_FACTOR_SCORE;
      push({
        id: `readiness:${sid}`,
        kind: 'readiness',
        title: `${label}${factor.score !== null ? ` ${factor.score}点` : '（未評価）'}`,
        detail: factor.reasons.join(' / ') || '根拠の記述なし',
        // 低いときだけ状況として効く。高いことは「効く状況」にならない
        situationIds: low ? [sid] : [],
        source: 'proposal-readiness の算出',
        asOf: null,
        confidence: 'measured',
        approximate: false,
        defaultSelected: true,
      });
    }
  }

  // ── 提案の型 ──────────────────────────────────────────────────────────
  if (input.play) {
    const sid = PLAY_SITUATION[input.play];
    push({
      id: `play:${input.play}`,
      kind: 'play',
      title: input.playLabel ?? input.play,
      detail: '準備度・外部機会・更新時期から導出した提案の型',
      situationIds: sid ? [sid] : [],
      source: 'decideProposalPlay の判定',
      asOf: null,
      confidence: 'measured',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 契約更新の位置 ────────────────────────────────────────────────────
  const days = input.renewalDaysLeft;
  if (input.renewalDate || days !== null) {
    const sids: string[] = [];
    if (typeof days === 'number' && days >= 0) {
      if (days <= 30) sids.push('RENEWAL_Near_0_30');
      else if (days <= 60) sids.push('RENEWAL_31_60');
    } else if (input.renewalBucket === '0-30') {
      sids.push('RENEWAL_Near_0_30');
    }
    push({
      id: 'renewal:position',
      kind: 'renewal',
      title: days !== null ? `契約満了まで${days}日` : `更新区分 ${input.renewalBucket ?? '不明'}`,
      detail: renewalNote(input.renewalBucket, days),
      situationIds: sids,
      source: 'company_daily_snapshot の renewal_date',
      asOf: input.renewalDate,
      confidence: 'measured',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 外部情報 ──────────────────────────────────────────────────────────
  for (const e of input.external) {
    push({
      id: `external:${e.id}`,
      kind: 'external',
      title: e.title || e.signalId,
      detail: e.summary + (e.sourceUrl ? `\n出典: ${e.sourceUrl}` : ''),
      situationIds: [e.signalId],
      source: e.sourceUrl ?? 'company_external_intel',
      asOf: e.asOf,
      // 外部情報は LLM 抽出・人の承認を経ているが観測ではない
      confidence: 'inferred',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 手動登録の状況 ────────────────────────────────────────────────────
  for (const m of input.manualSituations) {
    push({
      id: `manual:${m.situationId}`,
      kind: 'manual',
      title: m.situationId,
      detail: m.note || '（メモなし）',
      situationIds: [m.situationId],
      source: m.source ?? 'company_situations',
      asOf: m.observedAt,
      confidence: 'stated',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 事例（活用ギャラリー）──────────────────────────────────────────────
  // 状況が交差するものだけ。さらに Proof形式ごとに上限をかける。
  // 絞った件数は truncated に出す（黙って切り捨てない）。
  const active = new Set(input.activeSignals ?? []);
  const matchedCases = (input.cases ?? [])
    .filter(c => c.effectiveFor.some(sid => active.has(sid)));

  const perProof = new Map<string, number>();
  let caseShown = 0;
  for (const c of matchedCases) {
    const key = c.proofKind ?? '（Proof形式なし）';
    const n = perProof.get(key) ?? 0;
    if (n >= CASE_LIMIT_PER_PROOF) continue;
    perProof.set(key, n + 1);
    caseShown++;

    // 実行後の効果に数値があれば観測、なければ記述扱い。
    // 数値の無い事例を「観測」として提案文に断定させない。
    const hasNumber = /\d/.test(c.effect);
    push({
      id: `case:${c.pageId}`,
      kind: 'case',
      title: c.name,
      detail: [
        c.issue      ? `課題: ${c.issue}` : null,
        c.hypothesis ? `仮説: ${c.hypothesis}` : null,
        c.effect     ? `実行後の効果: ${c.effect}` : null,
        c.proofKind  ? `Proof形式: ${c.proofKind}` : null,
      ].filter(Boolean).join('\n'),
      situationIds: c.effectiveFor.filter(sid => active.has(sid)),
      source: c.url ?? '活用ギャラリー（Notion）',
      asOf: null,
      confidence: hasNumber ? 'measured' : 'stated',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 施策・問い（E）────────────────────────────────────────────────────
  const matchedPlaybooks = (input.playbooks ?? [])
    .filter(p => p.effectiveFor.some(sid => active.has(sid)));

  for (const p of matchedPlaybooks) {
    push({
      id: `playbook:${p.pageId}`,
      kind: 'playbook',
      title: `${p.kind ? `[${p.kind}] ` : ''}${p.name}`,
      detail: [
        // 注意書き（※ / ⚠）を含む原文をそのまま残す。要約すると制約が消える
        p.knowledge || null,
        p.effort       ? `想定工数: ${p.effort}` : null,
        p.maturityStep ? `必要な成熟度: ${p.maturityStep}` : null,
        p.sources.length ? `出典: ${p.sources.join('、')}` : null,
      ].filter(Boolean).join('\n'),
      situationIds: p.effectiveFor.filter(sid => active.has(sid)),
      source: p.url ?? 'E｜施策・問いライブラリ（Notion）',
      asOf: null,
      confidence: 'stated',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 利用実態の生値 ────────────────────────────────────────────────────
  const u = input.usage;
  if (u) {
    const parts: string[] = [];
    if (u.campaigns !== null) parts.push(`実行中キャンペーン ${u.campaigns}件`);
    if (u.heatmaps  !== null) parts.push(`ヒートマップ ${u.heatmaps}件`);
    if (u.l30Active !== null) parts.push(`30日活動 ${u.l30Active}件`);
    if (u.pvRate    !== null) parts.push(`PV消化率 ${u.pvRate}%`);
    if (u.lastActiveDate)     parts.push(`最終活動 ${u.lastActiveDate}`);
    if (parts.length > 0) {
      push({
        id: 'usage:aggregate',
        kind: 'usage',
        title: `利用実態（有料PJ ${u.paidProjectCount}件の合算）`,
        detail: parts.join(' / '),
        situationIds: [],
        source: 'Metabase project-signals',
        asOf: u.lastActiveDate,
        confidence: 'measured',
        approximate: false,
        defaultSelected: true,
      });
    }
  }

  // ── 会話・議事録 ──────────────────────────────────────────────────────
  for (const c of input.communications) {
    if (!c.body.trim()) continue;
    push({
      id: `comm:${c.id}`,
      kind: 'communication',
      title: `${c.channel}｜${c.title || '（件名なし）'}`,
      detail: c.body.slice(0, 1200),
      situationIds: [],
      source: c.channel,
      asOf: c.date,
      confidence: 'stated',
      approximate: false,
      // 直近3件だけ既定で入れる。全部入れるとストーリーが古い話に引っ張られる
      defaultSelected: false,
    });
  }
  const comms = byKind.get('communication') ?? [];
  comms
    .slice()
    .sort((a, b) => (b.asOf ?? '').localeCompare(a.asOf ?? ''))
    .slice(0, 3)
    .forEach(item => { item.defaultSelected = true; });

  // ── 顧客理解 ──────────────────────────────────────────────────────────
  for (const p of input.profileSections) {
    if (!p.text.trim()) continue;
    push({
      id: `profile:${p.key}`,
      kind: 'profile',
      title: p.label,
      detail: p.text.slice(0, 1500),
      situationIds: [],
      source: '顧客理解プロファイル（LLM生成）',
      asOf: p.asOf,
      confidence: 'inferred',
      approximate: false,
      defaultSelected: true,
    });
  }

  // ── 群に整形（材料が0件の群は落とす）─────────────────────────────────
  const order: EvidenceKind[] = [
    'behavior', 'readiness', 'play', 'renewal', 'external', 'manual',
    'case', 'playbook', 'usage', 'communication', 'profile',
  ];
  return order
    .map(kind => {
      const g: EvidenceGroup = {
        kind,
        label: GROUP_META[kind].label,
        affectsWhat: GROUP_META[kind].affectsWhat,
        note: GROUP_META[kind].note,
        items: byKind.get(kind) ?? [],
      };
      if (kind === 'case' && matchedCases.length > caseShown) {
        g.truncated = {
          shown: caseShown,
          total: matchedCases.length,
          reason: `Proof形式ごとに最大${CASE_LIMIT_PER_PROOF}件に絞っています`,
        };
      }
      return g;
    })
    .filter(g => g.items.length > 0);
}

/** 契約更新の位置づけ。expired を「余裕がある」と言わないための分岐 */
function renewalNote(bucket: RenewalBucket | null, days: number | null): string {
  if (bucket === 'expired') {
    return '契約満了日を過ぎている。更新状況の確認が先で、新提案の前提が成立していない可能性がある。';
  }
  if (bucket === '31-90') {
    return '解約判断期（満了91〜31日前）。新提案より継続確保を優先する局面。';
  }
  if (days !== null && days <= 30) {
    return '満了30日以内。運用上この期間の解約はできないため、更新予定に近い。';
  }
  if (days !== null) return `満了まで${days}日。更新時期の制約は受けない。`;
  return '更新日が取得できていない。時期の制約は判断していない。';
}

const PLAY_SITUATION: Record<ProposalPlay, string | null> = {
  expand:  'PLAY_Expand',
  connect: 'PLAY_Connect',
  deepen:  'PLAY_Deepen',
  rebuild: 'PLAY_Rebuild',
  // 型が決まっていない状態。対応する状況IDは無い（Notion A にも存在しない）
  unknown: null,
};

// ── 選択 → 状況IDの復元 ───────────────────────────────────────────────────────

/**
 * 選択された材料から状況IDを組み立てる。
 *
 * **これが「選択がWHATに効く」の実体。** 選択されていない材料の状況IDは入らない。
 * ここを通さずに activeSignals を作ると、選択が飾りになる。
 */
export function situationIdsFromSelection(
  groups: EvidenceGroup[],
  selectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  const ids = new Set<string>();
  for (const g of groups) {
    for (const item of g.items) {
      if (!selected.has(item.id)) continue;
      for (const sid of item.situationIds) ids.add(sid);
    }
  }
  return [...ids];
}

/** 選択された材料そのものを引く（ストーリー生成のプロンプト材料） */
export function selectedEvidence(
  groups: EvidenceGroup[],
  selectedIds: string[],
): EvidenceItem[] {
  const selected = new Set(selectedIds);
  return groups.flatMap(g => g.items.filter(i => selected.has(i.id)));
}

// ── 狙いとの関連度 ────────────────────────────────────────────────────────────
//
// 狙いを決めた後、どの材料がその狙いに関わるのかを機械的に出す。
// これが無いと、議事録が100件ある企業で担当者が選べない。
//
// 判定は2段:
//   1. **状況IDの重なり** — 狙いの「効く／前提／逆効果」と材料の状況IDが一致するか。
//      これが本来の根拠だが、議事録・利用実態は状況IDを持たないので当たらない。
//   2. **語句の一致** — 狙いの名称・価値の語句が材料の本文に出てくるか。
//      形態素解析は使わず、漢字・カタカナ・英字の連なりを拾う程度に留める。
//      精度は高くないが、**なぜ関連と判定したかを担当者に見せられる**ので
//      外す判断ができる。LLM で関連度を出すと20秒待たされ、理由も説明できない。

/** 関連と判定した理由。UI でそのまま出す */
export interface EvidenceRelevance {
  related: boolean;
  /** 一致した状況IDの日本語名や語句（なぜ関連なのか） */
  hits: string[];
  by: 'situation' | 'keyword' | null;
}

/** 関連判定に使わない一般語（どの提案にも出るもの） */
const STOP_WORDS = new Set([
  '提案', '支援', '機能', '設計', '活用', '実装', '状態', '状況', '情報', '内容',
  '対応', '実施', '確認', '検討', '運用', '利用', '顧客', '担当', '業務', '課題',
  'App', 'PGA', 'Ptengine',
]);

/**
 * 狙いの名称・価値から関連判定用の語句を取り出す。
 *
 * ⚠️ 短い語は使わない。実測で「体制」「成果」「一緒」「価値」が全材料に当たり、
 * 関連判定が意味を失った。**漢字・カタカナは3文字以上**に絞る。
 * 英字は略語（LP / AB / PoC / LPO）が2文字から意味を持つので2文字以上とする。
 *
 * 中黒（・）は語の区切りなので必ず落とす。含めると「解析・ヒートマップ・セグ」
 * のような塊や「メント」（→「マネジメント」に誤ヒット）が生まれる。
 */
export function intentKeywords(...texts: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    // カタカナは ー（長音）を含め、・（U+30FB）は除く
    const matches = t.match(/[一-鿿]{3,6}|[ァ-ヶー]{3,10}|[A-Za-z][A-Za-z0-9]{1,14}/g) ?? [];
    for (const m of matches) {
      // 末尾の長音は語の一部（「ワークフロー」→「ワークフロ」にすると一致しなくなる）。
      // 落とすのは先頭の長音だけ。
      const w = m.replace(/^ー+/, '');
      if (w.length < 2 || STOP_WORDS.has(w)) continue;
      out.add(w);
    }
  }
  return [...out].slice(0, 16);
}

/**
 * 材料の大半に当たる語句を落とす。
 *
 * 固定の除外リストだけでは足りない（企業ごとに何が一般語かは変わる）。
 * **半分以上の材料に出てくる語句は情報量が無い**ので外す。
 * 手書きのリストを増やし続けるより、この方が壊れにくい。
 */
export function pruneCommonKeywords(
  keywords: string[],
  items: Array<{ title: string; detail: string }>,
  maxRatio = 0.5,
): string[] {
  if (items.length < 4) return keywords;
  const texts = items.map(i => `${i.title}\n${i.detail}`);
  return keywords.filter(k => {
    const hits = texts.filter(t => t.includes(k)).length;
    return hits / texts.length <= maxRatio;
  });
}

/**
 * 材料が狙いに関連するか。
 *
 * @param situationLabel 状況ID → 日本語名（理由の表示に使う）
 */
export function evidenceRelevance(
  item: EvidenceItem,
  opts: {
    relatedSituations: string[];
    keywords: string[];
    situationLabel?: (sid: string) => string;
  },
): EvidenceRelevance {
  const related = new Set(opts.relatedSituations);
  const sidHits = item.situationIds.filter(sid => related.has(sid));
  if (sidHits.length > 0) {
    return {
      related: true,
      hits: sidHits.map(sid => opts.situationLabel?.(sid) ?? sid),
      by: 'situation',
    };
  }

  const haystack = `${item.title}\n${item.detail}`;
  const wordHits = opts.keywords.filter(k => k.length >= 2 && haystack.includes(k));
  if (wordHits.length > 0) {
    return { related: true, hits: wordHits.slice(0, 4), by: 'keyword' };
  }

  return { related: false, hits: [], by: null };
}
