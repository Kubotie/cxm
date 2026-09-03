// ─── WHAT カタログ取得層（S1・読み取りのみ）──────────────────────────────────
//
// Notion「What管理」配下の3DBを取得し、CXM で扱える形に正規化する。
//
// 正本の分担（崩さない）:
//   語彙（状況ID）  … コード（docs-src/cxm_v2/02_Signal_Taxonomy.md）が正本。Notion A はミラー
//   カタログ（B/C） … **Notion が正本**。CXM から編集しない
//   個社の状況・準備度 … CXM / NocoDB が正本。Notion には書かない
//
// 設計の要:
//   1. リレーションは page id ではなく **状況ID の文字列配列** に解決する。
//      CXM の signal_id と文字列一致させるのが唯一の契約なので、
//      A を1回引いて pageId → 状況ID のマップを作ってから解決する。
//   2. **候補に含める条件をここでフィルタする**（状態=利用可 / 提供段階≠構想 / 逆効果が非空）。
//      逆効果が空の行を候補に入れると、全商材が全顧客にマッチしてしまう。
//   3. **黙って無視しない。** A に存在しない状況IDを参照している行は候補から外し、
//      issues に理由を積んで呼び出し側へ返す。
//   4. 0件でも落ちない。Notion 未共有・未設定でも空カタログを返して継続する。
//
// このファイルはサーバーサイド専用。

import {
  queryDatabases, isNotionConfigured, NotionUnavailableError,
  readTitle, readText, readSelect, readMultiSelect, readRelationIds, readNumber, readPeopleNames,
  normalizePageId, type NotionPage,
} from '@/lib/notion/client';

// ── データソースID（What管理ページ配下）──────────────────────────────────────

/**
 * ⚠️ ここは **database ID**（REST API `/v1/databases/{id}` が要求するもの）。
 *
 * Notion は database（ブロック）と data source（collection）を分離しており、
 * `collection://ebf66cad-…` のような data source ID を REST API に渡すと 404 になる（実測）。
 * MCP や URL 上で見える ID とは別物なので、差し替えるときは
 * `/v1/search` の結果に出る `id` を使うこと。
 *
 *   A: data source ebf66cad-… → database 1e685508-…
 *   B: data source 5d80ae0d-… → database 475d3b09-…
 *   C: data source 6a22c8fc-… → database 270bcdf3-…
 */
export const WHAT_DB = {
  /** A｜状況カタログ（WHO語彙）。状況ID が title */
  situations: '1e685508-4808-4ab7-8a96-0e49c45fa469',
  /** B｜WHATカタログ（提供できるもの） */
  solutions:  '475d3b09-fa26-4181-a8e6-a76b68198414',
  /** C｜文脈フレーム（どう語るか） */
  frames:     '270bcdf3-a7c7-4fc7-9a8b-eaabe76a4689',
  /** 活用ギャラリー（事例）。Proof の材料になる */
  cases:      'ee2cca29-eb7d-4dfb-8e25-81cea0f396f8',
  /** E｜施策・問いライブラリ。Execution / Approach の材料になる */
  playbooks:  '32eaa40c-6083-4291-a423-b6582e2120dd',
  /**
   * B1｜提案の狙い（何をしたいか）。**個社ページのカードに出るのはこれ。**
   * B（提供できるもの）をそのままカードにすると、Bundle 契約の顧客に
   * 契約済みの製品を「深化」として出してしまう（2026-08-24 実測）。
   * 狙いは「契約状態 × 前進の方向」で決まるので、層を分けている。
   */
  intents:    '2517081a-d797-48c2-a3dc-6cf2d8adf68e',
} as const;

/** キャッシュ 1時間 */
const CACHE_TTL_MS = 60 * 60 * 1000;

// ── 型 ────────────────────────────────────────────────────────────────────────

export interface SituationRef {
  /** 状況ID（CXM の signal_id と文字列一致する） */
  id:       string;
  labelJa:  string;
  layer:    string | null;
  kind:     string | null;
  /** 自動（実装済）/ 半自動 / 手動（診断・登録）など */
  detection: string | null;
  detectionSource: string;
  meaning:  string;
  source:   string | null;
}

export interface SolutionCatalogEntry {
  pageId:      string;
  name:        string;
  kind:        string | null;
  /** 主役WHAT / 補助WHAT（部品・証跡） */
  role:        string | null;
  stage:       string | null;
  status:      string | null;
  valueLine:   string;
  /** 以下はすべて「状況ID の文字列配列」に解決済み */
  effectiveFor:   string[];
  prerequisites:  string[];
  antiPatterns:   string[];
  /** 必ず組む相手（B 自己参照）。WHAT 名の配列に解決済み */
  mustPairWith:   string[];
  maturityStep:   string | null;
  targetIndustries:      string[];
  targetBusinessModels:  string[];
  expectedEffect: string;
  evidence:       string;
  /** 対外呼称ルール。顧客向け文面の生成時に必ず適用する */
  namingRule:     string;
  owner:          string[];
  proposedCount:  number | null;
  meetingCount:   number | null;
}

/**
 * 契約前提。**この狙いが成立する契約状態。**
 * Bundle 契約に「Bundle化」を出さないための判定に使う。
 */
export type ContractPrecondition =
  | 'any'            // 問わない
  | 'contracted'     // 契約済み（プラン不問）
  | 'insight_only'   // Insight のみ
  | 'experience_only'// Experience のみ
  | 'none';          // 未契約

export interface ProposalIntentEntry {
  pageId:      string;
  name:        string;
  order:       number;
  valueLine:   string;
  contract:    ContractPrecondition;
  /** 以下はすべて「状況ID の文字列配列」に解決済み */
  effectiveFor:  string[];
  prerequisites: string[];
  antiPatterns:  string[];
  /** 骨子を書くのに要る材料。利用活性化以外はほぼ業界情報が要る */
  requiredInputs: string[];
  /** 誰に語るか。部長・決裁者なら機能ではなく組織と事業の話にする */
  audiences:   string[];
  /** 組織の何を変えるか（骨子の Goal / Gap の素材） */
  changeTarget: string;
  /** その変化が何につながるか（決裁者向けの芯） */
  businessImpact: string;
  /** この狙いの中で使う提供物（B の名称） */
  whatNames:   string[];
  /** 文脈フレーム（C の名称） */
  frameNames:  string[];
}

export interface NarrativeFrame {
  pageId:     string;
  name:       string;
  status:     string | null;
  /** 起動する状況（状況ID の配列） */
  triggeredBy: string[];
  /** 対象WHAT（WHAT 名の配列） */
  targetWhat:  string[];
  reframe:        string;
  talkingPoints:  string;
  avoidWhen:      string;
  proposedCount:  number | null;
  meetingCount:   number | null;
}

/**
 * 事例（活用ギャラリー）。Proof の材料。
 *
 * ⚠️ `sharing` は引用ガードの要。NG は**カードにも出さない**（数値も文章も）。
 *   ぼかしでOK は社名を伏せてから渡す。
 */
export interface CaseEntry {
  pageId:      string;
  /** 事例名。ぼかし対象なら伏せた表現に置換済み */
  name:        string;
  /** 伏せる前の原文名。画面には出さない（社内での突き合わせ用） */
  rawName:     string;
  issue:       string;
  hypothesis:  string;
  effect:      string;
  /** 同課題の打ち手と変化 / 数値ファクト / 業界の先行例 / 失敗と教訓 */
  proofKind:   string | null;
  /** OK / ぼかしでOK（NG は取り込み時に除外） */
  sharing:     string | null;
  purposes:        string[];
  productTypes:    string[];
  siteTypes:       string[];
  /** 効く状況（状況IDに解決済み） */
  effectiveFor:    string[];
  /** Notion ページURL（出所） */
  url:         string | null;
}

/** E｜施策・問いライブラリ。Approach / Execution の材料 */
export interface PlaybookEntry {
  pageId:      string;
  name:        string;
  /** 施策 / 自然言語クエリ */
  kind:        string | null;
  status:      string | null;
  /** 分かること／使うデータ。**注意書き（※ / ⚠）を落とさない** */
  knowledge:   string;
  effort:      string | null;
  maturityStep: string | null;
  /** 効く状況（状況IDに解決済み） */
  effectiveFor: string[];
  /** 出典（B の WHAT 名に解決済み） */
  sources:     string[];
  url:         string | null;
}

/** 取り込み時に検出した問題。黙って捨てず必ず呼び出し側へ返す */
export interface CatalogIssue {
  target:   'B' | 'C' | 'CASE' | 'E';
  rowName:  string;
  reason:
    | 'unknown_situation_id'      // A に存在しない状況IDを参照している
    | 'anti_patterns_empty'       // 逆効果になる状況が空（候補に含めない）
    | 'not_available'             // 状態 ≠ 利用可
    | 'stage_concept'             // 提供段階 = 構想
    | 'sharing_ng';               // 展開可否 = NG（外部に出せない）
  detail:   string;
}

export interface WhatCatalog {
  situations: SituationRef[];
  /** B1｜提案の狙い。状態 = 利用可 のみ。**カードに出るのはこれ** */
  intents:    ProposalIntentEntry[];
  /** 候補条件を満たした主役/補助WHAT のみ */
  solutions:  SolutionCatalogEntry[];
  /** 状態 = 利用可 のフレームのみ */
  frames:     NarrativeFrame[];
  /** 展開可否 ≠ NG の事例のみ。ぼかし対象は社名を伏せてある */
  cases:      CaseEntry[];
  /** 状態 = 利用可 の施策・問いのみ */
  playbooks:  PlaybookEntry[];
  issues:     CatalogIssue[];
  /** 各DBの総行数（フィルタ前）。UI で「なぜ候補が少ないか」を説明するのに使う */
  counts: {
    situations:      number;
    intentsTotal:    number;
    intentsUsable:   number;
    solutionsTotal:  number;
    solutionsUsable: number;
    framesTotal:     number;
    framesUsable:    number;
    casesTotal:      number;
    casesUsable:     number;
    playbooksTotal:  number;
    playbooksUsable: number;
  };
  /** Notion が使えない場合の理由。null = 正常 */
  unavailable: string | null;
  fetchedAt:   string;
}

export const EMPTY_CATALOG: WhatCatalog = {
  situations: [], intents: [], solutions: [], frames: [], cases: [], playbooks: [], issues: [],
  counts: {
    situations: 0, intentsTotal: 0, intentsUsable: 0,
    solutionsTotal: 0, solutionsUsable: 0, framesTotal: 0, framesUsable: 0,
    casesTotal: 0, casesUsable: 0, playbooksTotal: 0, playbooksUsable: 0,
  },
  unavailable: 'Notion 未取得',
  fetchedAt: new Date(0).toISOString(),
};

// ── 候補条件 ──────────────────────────────────────────────────────────────────

/**
 * 提案候補に含める条件。
 *
 * `requireAntiPatterns` を外してはいけない。逆効果が空の行を候補に入れると
 * 「効く条件」だけで判定され、全商材が全顧客にマッチしてレコメンドが機能しなくなる。
 */
export const CANDIDATE_RULE = {
  status: '利用可',
  excludedStage: '構想',
  requireAntiPatterns: true,
  /** 事例: 展開可否 = NG は取り込まない（数値も文章も外に出さない） */
  caseExcludedSharing: 'NG',
  /** 事例: 社名を伏せてから渡す */
  caseMaskSharing: 'ぼかしでOK',
  /** 施策・問い: 状態 = 利用可 のみ */
  playbookStatus: '利用可',
} as const;

// ── キャッシュ ────────────────────────────────────────────────────────────────

let _cache: { data: WhatCatalog; ts: number } | null = null;
let _inflight: Promise<WhatCatalog> | null = null;

export function getCachedWhatCatalog(): WhatCatalog | null {
  if (!_cache) return null;
  return Date.now() - _cache.ts < CACHE_TTL_MS ? _cache.data : null;
}

// ── 本体 ──────────────────────────────────────────────────────────────────────

export async function fetchWhatCatalog(opts: { force?: boolean } = {}): Promise<WhatCatalog> {
  if (!opts.force) {
    const cached = getCachedWhatCatalog();
    if (cached) return cached;
    if (_inflight) return _inflight;
  }

  _inflight = loadCatalog().finally(() => { _inflight = null; });
  return _inflight;
}

async function loadCatalog(): Promise<WhatCatalog> {
  if (!isNotionConfigured()) {
    return { ...EMPTY_CATALOG, unavailable: 'TOKEN_NOTION が未設定です', fetchedAt: new Date().toISOString() };
  }

  let pages: Map<string, NotionPage[]>;
  try {
    pages = await queryDatabases([
      WHAT_DB.situations, WHAT_DB.intents, WHAT_DB.solutions, WHAT_DB.frames,
      WHAT_DB.cases, WHAT_DB.playbooks,
    ]);
  } catch (e) {
    const msg = e instanceof NotionUnavailableError
      ? e.message
      : `Notion 取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`;
    console.warn('[what-catalog]', msg);
    return { ...EMPTY_CATALOG, unavailable: msg, fetchedAt: new Date().toISOString() };
  }

  const rawA  = pages.get(WHAT_DB.situations) ?? [];
  const rawB1 = pages.get(WHAT_DB.intents)   ?? [];
  const rawB = pages.get(WHAT_DB.solutions)  ?? [];
  const rawC = pages.get(WHAT_DB.frames)     ?? [];
  const rawCase = pages.get(WHAT_DB.cases)     ?? [];
  const rawE    = pages.get(WHAT_DB.playbooks) ?? [];

  // ── A: 状況カタログ。pageId → 状況ID のマップを先に作る ──────────────────
  const situations: SituationRef[] = [];
  const idByPage = new Map<string, string>();   // normalizedPageId → 状況ID

  for (const p of rawA) {
    const id = readTitle(p.properties['状況ID']);
    if (!id) continue;
    idByPage.set(normalizePageId(p.id), id);
    situations.push({
      id,
      labelJa:  readText(p.properties['日本語名']),
      layer:    readSelect(p.properties['層']),
      kind:     readSelect(p.properties['種別']),
      detection: readSelect(p.properties['検出']),
      detectionSource: readText(p.properties['検出元']),
      meaning:  readText(p.properties['この状況の意味']),
      source:   readSelect(p.properties['正本']),
    });
  }

  // ── B の pageId → 名称（自己参照リレーションの解決用）──────────────────
  const solutionNameByPage = new Map<string, string>();
  for (const p of rawB) {
    const name = readTitle(p.properties['名称']);
    if (name) solutionNameByPage.set(normalizePageId(p.id), name);
  }

  const issues: CatalogIssue[] = [];

  /** リレーションを状況IDの配列に解決する。未知の参照は issues に積む */
  const resolveSituations = (
    p: NotionProperty_ | undefined, rowName: string, target: CatalogIssue['target'], propLabel: string,
  ): { ids: string[]; hasUnknown: boolean } => {
    const ids: string[] = [];
    let hasUnknown = false;
    for (const pid of readRelationIds(p)) {
      const sid = idByPage.get(normalizePageId(pid));
      if (sid) { ids.push(sid); continue; }
      hasUnknown = true;
      issues.push({
        target, rowName, reason: 'unknown_situation_id',
        detail: `${propLabel} が A に存在しない行を参照しています（page ${pid.slice(0, 8)}…）`,
      });
    }
    return { ids, hasUnknown };
  };

  // ── B: WHAT カタログ ────────────────────────────────────────────────────
  const solutions: SolutionCatalogEntry[] = [];

  for (const p of rawB) {
    const name = readTitle(p.properties['名称']);
    if (!name) continue;

    const status = readSelect(p.properties['状態']);
    const stage  = readSelect(p.properties['提供段階']);

    const eff  = resolveSituations(p.properties['効く状況'], name, 'B', '効く状況');
    const pre  = resolveSituations(p.properties['前提条件'], name, 'B', '前提条件');
    const anti = resolveSituations(p.properties['逆効果になる状況'], name, 'B', '逆効果になる状況');

    // 候補条件のフィルタ（理由を issues に残す）
    if (status !== CANDIDATE_RULE.status) {
      issues.push({ target: 'B', rowName: name, reason: 'not_available', detail: `状態 = ${status ?? '未設定'}` });
      continue;
    }
    if (stage === CANDIDATE_RULE.excludedStage) {
      issues.push({ target: 'B', rowName: name, reason: 'stage_concept', detail: `提供段階 = ${stage}` });
      continue;
    }
    if (CANDIDATE_RULE.requireAntiPatterns && anti.ids.length === 0) {
      issues.push({
        target: 'B', rowName: name, reason: 'anti_patterns_empty',
        detail: '逆効果になる状況が空のため候補に含めません（空欄禁止）',
      });
      continue;
    }
    // 未知の状況IDを参照している行は候補から外す（誤ったマッチを防ぐ）
    if (eff.hasUnknown || pre.hasUnknown || anti.hasUnknown) continue;

    solutions.push({
      pageId: p.id,
      name,
      kind:   readSelect(p.properties['種別']),
      role:   readSelect(p.properties['役割']),
      stage,
      status,
      valueLine:     readText(p.properties['一言価値']),
      effectiveFor:  eff.ids,
      prerequisites: pre.ids,
      antiPatterns:  anti.ids,
      mustPairWith: readRelationIds(p.properties['必ず組む相手'])
        .map(pid => solutionNameByPage.get(normalizePageId(pid)))
        .filter((v): v is string => Boolean(v)),
      maturityStep:  readSelect(p.properties['必要な成熟度ステップ']),
      targetIndustries:     readMultiSelect(p.properties['対象業種']),
      targetBusinessModels: readMultiSelect(p.properties['対象ビジネスモデル']),
      expectedEffect: readText(p.properties['期待効果・実績']),
      evidence:       readText(p.properties['証跡・出典']),
      namingRule:     readText(p.properties['対外呼称ルール']),
      owner:          readPeopleNames(p.properties['記述責任者']),
      proposedCount:  readNumber(p.properties['提案数']),
      meetingCount:   readNumber(p.properties['打合せ設定数']),
    });
  }

  // ── B1: 提案の狙い ──────────────────────────────────────────────────────
  //   C（フレーム名）の解決に使うため、frames より先に名前だけ引いておく
  const frameNameByPage = new Map<string, string>();
  for (const p of rawC) {
    const name = readTitle(p.properties['フレーム名']);
    if (name) frameNameByPage.set(normalizePageId(p.id), name);
  }

  const intents: ProposalIntentEntry[] = [];

  for (const p of rawB1) {
    const name = readTitle(p.properties['名称']);
    if (!name) continue;

    const status = readSelect(p.properties['状態']);
    if (status !== CANDIDATE_RULE.status) {
      issues.push({ target: 'B', rowName: name, reason: 'not_available', detail: `B1 状態 = ${status ?? '未設定'}` });
      continue;
    }

    const eff  = resolveSituations(p.properties['効く状況'], name, 'B', 'B1 効く状況');
    const pre  = resolveSituations(p.properties['前提条件'], name, 'B', 'B1 前提条件');
    const anti = resolveSituations(p.properties['逆効果になる状況'], name, 'B', 'B1 逆効果になる状況');

    // 逆効果が空だと全顧客にマッチする（B と同じ理由で候補に入れない）
    if (CANDIDATE_RULE.requireAntiPatterns && anti.ids.length === 0) {
      issues.push({
        target: 'B', rowName: name, reason: 'anti_patterns_empty',
        detail: 'B1 の逆効果になる状況が空のため候補に含めません（空欄禁止）',
      });
      continue;
    }
    if (eff.hasUnknown || pre.hasUnknown || anti.hasUnknown) continue;

    intents.push({
      pageId: p.id,
      name,
      order:     readNumber(p.properties['並び順']) ?? 99,
      valueLine: readText(p.properties['一言価値']),
      contract:  toContractPrecondition(readSelect(p.properties['契約前提'])),
      effectiveFor:  eff.ids,
      prerequisites: pre.ids,
      antiPatterns:  anti.ids,
      requiredInputs: readMultiSelect(p.properties['必要な材料']),
      audiences:      readMultiSelect(p.properties['対象レイヤー']),
      changeTarget:   readText(p.properties['変える対象']),
      businessImpact: readText(p.properties['事業インパクト']),
      whatNames: readRelationIds(p.properties['使うWHAT'])
        .map(pid => solutionNameByPage.get(normalizePageId(pid)))
        .filter((v): v is string => Boolean(v)),
      frameNames: readRelationIds(p.properties['語り口'])
        .map(pid => frameNameByPage.get(normalizePageId(pid)))
        .filter((v): v is string => Boolean(v)),
    });
  }
  intents.sort((a, b) => a.order - b.order);

  // ── C: 文脈フレーム ────────────────────────────────────────────────────
  const frames: NarrativeFrame[] = [];

  for (const p of rawC) {
    const name = readTitle(p.properties['フレーム名']);
    if (!name) continue;

    const status = readSelect(p.properties['状態']);
    if (status !== CANDIDATE_RULE.status) {
      issues.push({ target: 'C', rowName: name, reason: 'not_available', detail: `状態 = ${status ?? '未設定'}` });
      continue;
    }

    const trig = resolveSituations(p.properties['起動する状況'], name, 'C', '起動する状況');
    if (trig.hasUnknown) continue;

    frames.push({
      pageId: p.id,
      name,
      status,
      triggeredBy: trig.ids,
      targetWhat: readRelationIds(p.properties['対象WHAT'])
        .map(pid => solutionNameByPage.get(normalizePageId(pid)))
        .filter((v): v is string => Boolean(v)),
      reframe:       readText(p.properties['言い換え（1〜2文）']),
      talkingPoints: readText(p.properties['トーキングポイント']),
      avoidWhen:     readText(p.properties['使わない場面']),
      proposedCount: readNumber(p.properties['提案数']),
      meetingCount:  readNumber(p.properties['打合せ設定数']),
    });
  }

  // ── 事例（活用ギャラリー）────────────────────────────────────────────────
  // 引用ガード: 展開可否 = NG は**取り込まない**。取り込んでから画面で隠す方式にすると、
  // どこかの経路で漏れる。ここで落とすのが唯一安全。
  const cases: CaseEntry[] = [];
  for (const p of rawCase) {
    const rawName = readTitle(p.properties['名前']);
    if (!rawName) continue;

    const sharing = readSelect(p.properties['展開可否']);
    if (sharing === CANDIDATE_RULE.caseExcludedSharing) {
      issues.push({ target: 'CASE', rowName: rawName, reason: 'sharing_ng', detail: '展開可否 = NG' });
      continue;
    }

    const eff = resolveSituations(p.properties['効く状況'], rawName, 'CASE', '効く状況');
    if (eff.hasUnknown) continue;

    const productTypes = readMultiSelect(p.properties['商材・サービス種類']);
    const siteTypes    = readMultiSelect(p.properties['サイト種類']);

    cases.push({
      pageId: p.id,
      // ぼかしでOK は社名を伏せる。原文名は rawName に残して社内で突き合わせられるようにする
      name: sharing === CANDIDATE_RULE.caseMaskSharing
        ? maskCompanyName(productTypes, siteTypes)
        : rawName,
      rawName,
      issue:      readText(p.properties['課題']),
      hypothesis: readText(p.properties['仮説']),
      effect:     readText(p.properties['実行後の効果']),
      proofKind:  readSelect(p.properties['Proof形式']),
      sharing,
      purposes:   readMultiSelect(p.properties['目的']),
      productTypes,
      siteTypes,
      effectiveFor: eff.ids,
      url: p.url ?? null,
    });
  }

  // ── E｜施策・問いライブラリ ──────────────────────────────────────────────
  const playbooks: PlaybookEntry[] = [];
  for (const p of rawE) {
    const name = readTitle(p.properties['名称']);
    if (!name) continue;

    const status = readSelect(p.properties['状態']);
    if (status !== CANDIDATE_RULE.playbookStatus) {
      issues.push({ target: 'E', rowName: name, reason: 'not_available', detail: `状態 = ${status ?? '空'}` });
      continue;
    }

    const eff = resolveSituations(p.properties['効く状況'], name, 'E', '効く状況');
    if (eff.hasUnknown) continue;

    playbooks.push({
      pageId: p.id,
      name,
      kind:   readSelect(p.properties['種別']),
      status,
      // 注意書き（※ / ⚠）を含む原文をそのまま持つ。要約して落とすと制約が消える
      knowledge: readText(p.properties['分かること／使うデータ']),
      effort:       readSelect(p.properties['想定工数']),
      maturityStep: readSelect(p.properties['必要な成熟度ステップ']),
      effectiveFor: eff.ids,
      sources: readRelationIds(p.properties['出典'])
        .map(pid => solutionNameByPage.get(normalizePageId(pid)))
        .filter((v): v is string => Boolean(v)),
      url: p.url ?? null,
    });
  }

  const data: WhatCatalog = {
    situations,
    intents,
    solutions,
    frames,
    cases,
    playbooks,
    issues,
    counts: {
      situations:      situations.length,
      intentsTotal:    rawB1.length,
      intentsUsable:   intents.length,
      solutionsTotal:  rawB.length,
      solutionsUsable: solutions.length,
      framesTotal:     rawC.length,
      framesUsable:    frames.length,
      casesTotal:      rawCase.length,
      casesUsable:     cases.length,
      playbooksTotal:  rawE.length,
      playbooksUsable: playbooks.length,
    },
    unavailable: null,
    fetchedAt: new Date().toISOString(),
  };

  _cache = { data, ts: Date.now() };
  return data;
}

/**
 * 契約前提の日本語 → コード上の値。
 * Notion 側の選択肢名を変えたらここも直す（IDでなく文字列で結んでいる）。
 */
function toContractPrecondition(v: string | null): ContractPrecondition {
  switch (v) {
    case '契約済み（プラン不問）': return 'contracted';
    case 'Insight のみ':          return 'insight_only';
    case 'Experience のみ':       return 'experience_only';
    case '未契約':                return 'none';
    default:                      return 'any';
  }
}

/** client.ts の NotionProperty を再輸出せずに使うためのローカル別名 */
type NotionProperty_ = Parameters<typeof readRelationIds>[0];

/**
 * 「ぼかしでOK」の事例名。社名を出さず、業種とサイト種類で言い換える。
 *
 * 「同業のEC事業者」のように、提案文でそのまま話せる表現にする。
 * 材料が無ければ「他社事例」に落とす（推測で業種を作らない）。
 */
function maskCompanyName(productTypes: string[], siteTypes: string[]): string {
  const product = productTypes[0];
  const site    = siteTypes[0];
  if (product && site) return `${product}の${site}事例（社名非公開）`;
  if (product)         return `${product}の事例（社名非公開）`;
  if (site)            return `${site}の事例（社名非公開）`;
  return '他社事例（社名非公開）';
}
