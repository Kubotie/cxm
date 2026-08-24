// ─── 業界トレンドの取得 ───────────────────────────────────────────────────────
//
// 「市場・業界の動き」を書くための材料を Web 検索で集める。
//
// なぜ個社情報と分けるか:
//   顧客理解の「市場・業界」セクションは、**この顧客が属する業界全体**で起きていること
//   （同業他社の動向、規制、技術トレンド、市場構造の変化）を書く場所である。
//   個社の IR や議事録からは業界全体の動きは分からないため、別途集める必要がある。
//   実際、業界材料がないまま生成させると、個社の中期経営計画を「市場の動き」として
//   書いてしまう（実測）。
//
// キャッシュ:
//   業界トレンドは企業横断で共有できる（同業なら同じ内容でよい）。
//   1) 企業名キーで引く → 同じ企業の再生成では再検索しない
//   2) 特定できた業界名キーでも引く → 同業の別企業で再利用される
//   プロセスメモリなので再起動で消えるが、恒久保存が要るほどの情報ではない。
//
// このファイルはサーバーサイド専用。

import { searchWeb } from '@/lib/anthropic/web-search';
import { getAnthropicClient, getAnthropicModel } from '@/lib/anthropic/client';

/** キャッシュのTTL。業界トレンドは日単位で変わるものではない */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 出典として採用する条件。
 *
 * 「出典が開けない」「いつの情報か分からない」記述は、担当者が顧客に話せない。
 * 確認できないものは**表示しない**方針にする（少なく正確 > 多く不確か）。
 */
export const SOURCE_POLICY = {
  /** 鮮度の上限（月）。これより古い情報は採用しない */
  maxAgeMonths: 36,
  /** 時点が特定できない情報を採用するか（false = 除外） */
  allowUnknownDate: false,
  /** リンクが切れている項目を残すか（false = 記述ごと除外） */
  keepDeadLinks: false,
} as const;

export interface IndustryTrendItem {
  /** 業界で起きていること → 示唆、まで含めた1〜2文 */
  text: string;
  /**
   * 出典URL。**実際に検索でヒットしたURL（annotations）のみ**を入れる。
   * モデルが本文に書いた markdown リンクは信用しない（存在しないURLを書くため）。
   */
  sourceUrl:   string | null;
  sourceTitle: string | null;
  /** 情報の時点 "YYYY-MM" / "YYYY"。鮮度の判断に使う。不明なら null */
  asOf: string | null;
}

export interface IndustryIntel {
  /** 特定された業界名（例: "精密機器・プリンター製造"） */
  industry:  string | null;
  /** 出典ポリシーを満たしたトレンドのみ */
  trends:    IndustryTrendItem[];
  /** 参照した出典 */
  sources:   Array<{ url: string; title: string }>;
  /** ポリシーで除外した件数（UI に出して「なぜ少ないか」を伝える） */
  excluded: {
    deadLink:    number;
    tooOld:      number;
    unknownDate: number;
    noSource:    number;
  };
  costUsd:   number | null;
  fetchedAt: string;
}

// ── キャッシュ ────────────────────────────────────────────────────────────────

interface CacheEntry { data: IndustryIntel; ts: number }
const _byCompany  = new Map<string, CacheEntry>();
const _byIndustry = new Map<string, CacheEntry>();

function fresh(e: CacheEntry | undefined): IndustryIntel | null {
  if (!e) return null;
  return Date.now() - e.ts < CACHE_TTL_MS ? e.data : null;
}

/** キャッシュにあれば返す（検索しない）。profile 生成から呼ぶ用 */
export function getCachedIndustryIntel(companyName: string): IndustryIntel | null {
  return fresh(_byCompany.get(companyName));
}

// ── 段階1: 業界の特定 ─────────────────────────────────────────────────────────
//
// トレンド検索と同時に業界を特定させると、実行のたびに業界名が変わり
// （実測: 「精密機器・電子機器製造業」→「ドキュメントソリューション・オフィス機器業界」）、
// 業界名キーのキャッシュも効かなくなる。特定だけを先に短く済ませる。

const IDENTIFY_SYSTEM_PROMPT = `あなたは企業調査のアナリストです。指定された企業が属する業界を1つだけ特定します。

## 出力形式（厳守）
業界名だけを1行で出力してください。説明・前置き・記号を一切付けないこと。

## 粒度の基準
- 「製造業」のような大分類では広すぎます
- 「インクジェットプリンター製造」のような製品単位では狭すぎます
- **同業他社が10社程度思い浮かぶ粒度**にしてください
- 例: 「精密機器・プリンター製造」「化粧品・パーソナルケア」「アパレル小売」「医薬品」「証券・資産運用」`;

/** 業界名だけを短く特定する（トレンド検索の前段） */
async function identifyIndustry(companyName: string, domain?: string | null): Promise<string | null> {
  try {
    const res = await searchWeb({
      systemPrompt: IDENTIFY_SYSTEM_PROMPT,
      userPrompt:   `企業名: ${companyName}${domain ? `\nドメイン: ${domain}` : ''}\n\nこの企業が属する業界を1つ、業界名だけ答えてください。`,
      maxResults:   2,
      maxTokens:    100,
    });
    const line = res.text.split('\n').map(l => l.trim()).find(l => l.length >= 2 && l.length <= 40);
    return line ? line.replace(/[*_`#。.]/g, '').trim() : null;
  } catch {
    return null;
  }
}

// ── 段階2: 業界トレンドの取得 ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `あなたは BtoB SaaS（Webサイト分析・Web接客ツール Ptengine）のカスタマーサクセスを支援するアナリストです。
**指定された業界の企業に共通して起きていること**のうち、**当社の支援領域と重なるもの**を調べて報告します。

## 当社（Ptengine）の支援領域

Webサイト行動分析（ヒートマップ・回遊・ファネル）／Web接客・ポップアップ／ABテスト・LP最適化／
フォーム最適化（EFO）／ユーザーセグメント分析／コンテンツの効果測定／AI による分析と改善提案。

**この領域に重なるトレンドを優先してください。** 重なるかどうかが、報告する価値の判断基準です。

## 調べること

指定業界で起きている**事業構造の変化**と、それが**Web・デジタル顧客接点に与える影響**:
- 市場の構造変化（需要の増減、収益源のシフト、成長領域の移動）
- その業界に固有の顧客行動・購買プロセスの変化
- 同業他社のWeb/デジタル活用の動き
- その業界に効く規制・制度・商習慣の変化

**業界の話であればどんな内容でもよいわけではありません。**
最終的に「その業界の企業がWebサイト・顧客接点に何を求めるようになるか」に接続する内容を選んでください。

## 除外すること（最重要）

次のものは**業界トレンドではありません。書かないでください。**

1. **ツール・SaaS市場そのものの動向**
   ✗「国内デジタルマーケティング市場が4,190億円規模に成長」
   ✗「マーケティングツールベンダーがAI機能を拡充」
   → これは我々（ツール提供側）の業界の話であって、顧客の業界の話ではありません

2. **顧客接点にも業界にも接続しない一般論**
   ✗「人手不足で業務効率化が経営課題」（顧客接点に接続しない）
   ✗「DX推進が急務」（具体性がなく、どの業界でも同じ）

3. 指定企業個社の決算・中計・組織の話

## 業界横断のトレンドの扱い（重要）

業界横断で起きているトレンドでも、**当社の支援領域と重なり、その業界での現れ方を具体的に書ける**なら
**採用してください**。業種を問わないからといって捨てないでください。

採用すべき横断トレンドの例:
- **AI検索・生成AI経由の情報収集（AIO / GEO / LLMO）** — 検索流入の構造が変わり、
  サイトの情報設計・構造化・引用されやすさが競争要因になる。当社の支援領域と直結する
- 購買プロセスのデジタル化（比較検討がWeb上で完結する、営業接触前に候補が絞られる）
- ゼロパーティ/ファーストパーティデータへの移行

ただし**その業界での現れ方まで書くこと**が条件です。
- ✗「BtoB企業の65%がAI検索を利用している」（数字だけで業界の話になっていない）
- ○「〈業界〉では製品スペックや導入事例の比較検討がAI検索経由に移りつつあり、
     技術仕様の構造化とAIに引用される形での情報提供が流入確保の条件になっている」

## 自己チェック（各項目について必ず行う）

**チェック1（必須）: 当社の支援領域に接続するか**
その事実から「だからこの業界の企業はWebサイト・顧客接点・データ活用で〜を求めるようになる」が言えるか。
言えない場合（製造技術の話、部材調達の話、財務指標だけの話）は**削除**してください。

**チェック2（必須）: その業界の話として書けているか**
業界特有のトレンドなら「〈業界〉では〜」で始められること。
業界横断のトレンドなら「〈業界〉ではこう現れている」まで書けていること。
どちらでもなく一般論で終わっているものは**削除**してください。

例:
- ○「複合機市場が縮小し商業・産業機器へシフト → 新しい顧客層への認知獲得とリード獲得がWeb上の課題」
  （支援領域に接続 ○ / 業界の話 ○）
- ○「〈業界〉では技術仕様の比較検討がAI検索経由に移り、構造化と引用されやすさが流入確保の条件に」
  （支援領域に接続 ○ / 横断トレンドだが業界での現れ方を書けている ○）
- ✗「医療機器分野が高齢化で成長市場 → 安定収益源として期待されている」
  （支援領域に接続 ✗ → 削除）
- ✗「BtoB企業の65%がAI検索を利用している」
  （業界での現れ方がない ✗ → 削除。ただし業界文脈に落とせるなら採用）

## 情報の鮮度（重要）

**3年以内（直近36か月）に公開・更新された情報だけを使ってください。**
それより古い情報は、業界の現状として使えないため報告しないでください。
古い統計しか見つからない項目は、その項目自体を落としてください。

該当する情報が3件も見つからなければ、無理に埋めず見つかった分だけ書いてください。0件でも構いません。
日本市場の話を優先します。

## 出力

調べた内容を箇条書きで報告してください。各項目は
「〈業界〉では〜が起きている → だからこの業界の企業はWeb・顧客接点において〜を求めるようになっている」
の形にしてください。

事実・数値・日付は検索結果に書かれているものだけを使ってください。`;

// ── 段階3: 構造化（出典と時点を確実に紐付ける）──────────────────────────────
//
// 検索の応答テキストから箇条書きを正規表現で拾い、URL を推定する方式は失敗した:
//   - モデルが本文に書いた URL は存在しないページを指す（実測で 404 が並んだ）
//   - URL を書かせないようにすると、今度は文面と検索結果本文が一致せず出典が全滅した
// そこで検索結果に**番号を振って**渡し、各項目にその番号を必須で書かせる。
// これで出典は必ず実在する URL になる。

const STRUCTURE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'report_industry_trends',
    description: '業界トレンドを、出典番号と情報の時点つきで構造化する',
    parameters: {
      type: 'object',
      properties: {
        trends: {
          type: 'array',
          description: '業界トレンド。該当がなければ空配列',
          items: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description:
                  '「〈業界〉では〜が起きている → だからこの業界の企業はWeb・顧客接点において〜を求めるようになっている」の形。' +
                  '数値・固有名詞は出典に書かれているものだけを使う',
              },
              source_index: {
                type: 'integer',
                description: '根拠にした出典の番号（渡された一覧の番号）。**必須**。複数あれば最も直接的なもの1つ',
              },
              as_of: {
                type: ['string', 'null'],
                description:
                  '情報の時点。"YYYY-MM" または "YYYY"。' +
                  '出典本文の中にある公開日・投稿日・調査実施時期・「◯年◯月時点」「◯年版」などの記載を探して書く。' +
                  '本文に年月が全く出てこない場合のみ null（推測で作らない）',
              },
            },
            required: ['text', 'source_index', 'as_of'],
          },
        },
      },
      required: ['trends'],
    },
  },
} as const;

const STRUCTURE_SYSTEM_PROMPT = `あなたは調査結果を構造化するアシスタントです。

渡された出典（番号付き）と調査メモから、業界トレンドを構造化してください。

## 厳守すること
- **各項目に source_index を必ず付ける。** どの出典にも根拠がない記述は出力しないでください
- 数値・固有名詞・日付は**出典本文に書かれているもの**だけを使う。調査メモにあっても出典で確認できないものは書かない
- URL は書かないでください（番号で指定してください）

## as_of（情報の時点）の探し方

出典本文から次のような記載を探してください:
- 記事の公開日・更新日（「2025年3月12日」「2026/01/15」など）
- 調査・集計の時期（「2025年10月実施の調査」「2024年度データ」など）
- 「◯年◯月時点」「◯年版」といった明示
- 統計の対象期間（「2023年の出荷台数」など。この場合はそのデータ年を書く）

本文に年の記載が全く見つからない場合のみ null にしてください。**推測で年月を作らないこと。**`;

/** 検索結果に番号を振って構造化する */
async function structureTrends(
  industryName: string,
  memo: string,
  citations: Array<{ url: string; title: string; content: string }>,
): Promise<IndustryTrendItem[]> {
  if (citations.length === 0) return [];

  const list = citations
    .map((c, i) => `[${i + 1}] ${c.title}\nURL: ${c.url}\n本文: ${c.content.slice(0, 3000)}`)
    .join('\n\n---\n\n');

  try {
    const client = getAnthropicClient();
    const completion = await client.chat.completions.create({
      model: getAnthropicModel(),
      max_tokens: 3000,
      tools: [STRUCTURE_TOOL],
      tool_choice: { type: 'function', function: { name: 'report_industry_trends' } },
      messages: [
        { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
        {
          role: 'user',
          content:
            `## 対象業界\n${industryName}\n\n` +
            `## 調査メモ\n${memo.slice(0, 6000)}\n\n` +
            `## 出典（この番号で参照すること）\n${list}`,
        },
      ],
    });

    const toolCall = completion.choices[0]?.message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') return [];

    const parsed = JSON.parse(toolCall.function.arguments) as {
      trends?: Array<{ text?: string; source_index?: number; as_of?: string | null }>;
    };

    const out: IndustryTrendItem[] = [];
    for (const t of parsed.trends ?? []) {
      const idx = Number(t.source_index) - 1;
      const cite = citations[idx];
      // 出典が特定できない項目は捨てる（出典なしの記述を残さない）
      if (!cite || !t.text || t.text.length < 20) continue;
      out.push({
        text:        t.text,
        sourceUrl:   cite.url,
        sourceTitle: cite.title,
        asOf:        normalizeAsOf(t.as_of ?? ''),
      });
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

// ── 出典ページの検証（生存確認 + 公開日の取得）─────────────────────────────
//
// 検索インデックスに残っていてもページが消えていることがあり、そのまま出すと
// 担当者が 404 を踏む（実測で発生）。同時に公開日も取れると鮮度が判断できる。
// どちらも1回の GET で済むのでまとめて行う。

interface PageMeta { alive: boolean; publishedAt: string | null }

export interface VerifyResult {
  kept:     IndustryTrendItem[];
  excluded: IndustryIntel['excluded'];
}

/**
 * 出典を検証し、ポリシーを満たさない項目を**記述ごと除外**する。
 *
 * 除外する理由:
 *   - リンク切れ（404/410）… 担当者が顧客に出典を示せない
 *   - 3年より古い          … 業界の状況として古すぎる
 *   - 時点不明             … 鮮度を判断できない
 *   - 出典なし             … 根拠を辿れない
 * 403 / 429 は Bot 対策でブラウザなら開けるため生存扱いにする。
 */
async function verifySources(items: IndustryTrendItem[]): Promise<VerifyResult> {
  const excluded = { deadLink: 0, tooOld: 0, unknownDate: 0, noSource: 0 };

  const urls = [...new Set(items.map(i => i.sourceUrl).filter((u): u is string => !!u))];
  const meta = new Map<string, PageMeta>();

  await Promise.all(urls.map(async url => {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'ja,en-US;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      });

      if (res.status === 404 || res.status === 410) {
        meta.set(url, { alive: false, publishedAt: null });
        return;
      }
      const html = res.ok ? (await res.text()).slice(0, 120_000) : '';
      meta.set(url, { alive: true, publishedAt: extractPublishedAt(html, url) });
    } catch {
      // 判定できない場合は生存扱い（誤って消さない）。日付は URL から推定する
      meta.set(url, { alive: true, publishedAt: extractPublishedAtFromUrl(url) });
    }
  }));

  const kept: IndustryTrendItem[] = [];

  for (const item of items) {
    if (!item.sourceUrl) { excluded.noSource++; continue; }

    const m = meta.get(item.sourceUrl);
    if (m && !m.alive && !SOURCE_POLICY.keepDeadLinks) { excluded.deadLink++; continue; }

    // LLM が取れなかった時点をページのメタデータで補う
    const asOf = item.asOf ?? m?.publishedAt ?? null;

    if (!asOf) {
      if (!SOURCE_POLICY.allowUnknownDate) { excluded.unknownDate++; continue; }
      kept.push({ ...item, asOf: null });
      continue;
    }

    if (ageInMonths(asOf) > SOURCE_POLICY.maxAgeMonths) { excluded.tooOld++; continue; }

    kept.push({ ...item, asOf });
  }

  return { kept, excluded };
}

/** "YYYY" / "YYYY-MM" から現在までの経過月数。判定不能なら Infinity（＝古いものとして扱う） */
function ageInMonths(asOf: string): number {
  const m = asOf.match(/^(\d{4})(?:-(\d{1,2}))?$/);
  if (!m) return Number.POSITIVE_INFINITY;
  const y = Number(m[1]);
  // 月が無い場合は年末（12月）とみなし、年単位の情報を不利にしすぎない
  const mo = m[2] ? Number(m[2]) : 12;
  const now = new Date();
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
}

/** HTML のメタデータ / JSON-LD から公開日を拾う。無ければ URL から推定 */
function extractPublishedAt(html: string, url: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+name=["'](?:date|pubdate|publish[-_]?date|DC\.date)["'][^>]+content=["']([^"']+)["']/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const raw = html.match(re)?.[1];
    const norm = raw ? normalizeAsOf(raw) : null;
    if (norm) return norm;
  }
  return extractPublishedAtFromUrl(url);
}

/** URL に埋まっている日付（/2026/03/ や /20260313/ など）から推定する */
function extractPublishedAtFromUrl(url: string): string | null {
  const ymd = url.match(/\/(20\d{2})[\/-]?(\d{2})[\/-]?(\d{2})(?:[\/._-]|$)/);
  if (ymd) return `${ymd[1]}-${ymd[2]}`;
  const ym = url.match(/\/(20\d{2})[\/-](\d{1,2})(?:[\/._-]|$)/);
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
  const y = url.match(/(?:\/|-)(20\d{2})(?:\/|-|\.|$)/);
  return y ? y[1] : null;
}


// ── 取得（3段階 + 検証）───────────────────────────────────────────────────────

/**
 * 業界を特定し、その業界のトレンドを出典付きで取得する。
 *
 * 段階1 業界の特定（独立させて名称をぶらさない）
 * 段階2 Web 検索（事業構造の変化 / AI検索の影響 の2観点）
 * 段階3 出典番号つきで構造化（URL を実在するものに限定する）
 * 段階4 出典ページの検証（消えたリンクを外し、公開日で鮮度を補う）
 *
 * キャッシュがあれば検索しない（force で強制取得）。
 */
export async function fetchIndustryIntel(input: {
  companyName: string;
  /** 企業ドメイン。業界特定の精度を上げるために渡す */
  domain?: string | null;
  /** 既に業界が分かっている場合に指定（キャッシュヒット率が上がる） */
  knownIndustry?: string | null;
  force?: boolean;
}): Promise<IndustryIntel> {
  const { companyName, domain, knownIndustry, force } = input;

  if (!force) {
    const byCompany = fresh(_byCompany.get(companyName));
    if (byCompany) return byCompany;
    if (knownIndustry) {
      const byIndustry = fresh(_byIndustry.get(knownIndustry));
      if (byIndustry) return byIndustry;
    }
  }

  // 段階1: 業界を確定させる（毎回ぶれないよう独立して行う）
  const industryName = knownIndustry ?? await identifyIndustry(companyName, domain);

  // 段階2: 確定した業界名でトレンドを検索する
  const search = await searchWeb({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildTrendQuery(industryName ?? `${companyName} が属する業界`, companyName, domain),
    // 2つの観点（構造変化 / AI検索）を両方カバーするため検索件数を多めに取る
    maxResults: 8,
    maxTokens:  2200,
  });

  // 段階3: 出典番号つきで構造化する（URL を確実に実在するものにする）
  const structured = await structureTrends(
    industryName ?? `${companyName} が属する業界`,
    search.text,
    search.citations,
  );

  // 段階4: 出典を検証し、ポリシーを満たさない項目を除外する
  const { kept, excluded } = await verifySources(structured);

  const data: IndustryIntel = {
    industry:  industryName ?? extractIndustry(search.text) ?? null,
    trends:    kept,
    sources:   search.citations.map(c => ({ url: c.url, title: c.title })),
    excluded,
    costUsd:   search.costUsd,
    fetchedAt: new Date().toISOString(),
  };

  const entry: CacheEntry = { data, ts: Date.now() };
  _byCompany.set(companyName, entry);
  if (data.industry) _byIndustry.set(data.industry, entry);

  return data;
}

/**
 * トレンド検索のクエリ。
 *
 * 「業界に共通して起きていること」だけを聞くと事業構造の話に寄り、
 * AI検索（AIO / GEO / LLMO）のような**当社の支援領域と直結する横断トレンド**が
 * 検索結果に入ってこない（実測）。観点を明示して両方を必ず拾わせる。
 */
function buildTrendQuery(industryName: string, companyName: string, domain?: string | null): string {
  return `## 対象業界
${industryName}

## 参考（この企業個社の話は書かないこと）
${companyName}${domain ? `（${domain}）` : ''}

## 調べてほしい2つの観点

**観点1: ${industryName}の事業構造の変化**
市場の需要・収益源のシフト、顧客層の変化、競争環境の変化。
それが Web サイト・顧客接点に何を求めるようになっているか。

**観点2: ${industryName}における AI 検索・生成AI経由の情報収集（AIO / GEO / LLMO）の影響**
検索流入の構造がどう変わっているか、AI に引用されるための情報設計・構造化が
競争要因になっているか、この業界の購買検討プロセスでどう現れているか。

**観点2は当社の支援領域（Webサイトの情報設計・コンテンツ効果測定・流入分析）と直結するため、必ず調べてください。**
ただし「BtoB企業の○%がAI検索を利用」のような数字だけで終わらせず、
**${industryName}での現れ方**まで書いてください。

ツール・SaaS市場そのものの動向は書かないでください。`;
}

// ── パース ────────────────────────────────────────────────────────────────────

/**
 * 応答から業界名を拾う。
 * プロンプトで1行目を「業界: 〇〇」に固定しているが、
 * 表記ゆれ（**業界**: / ## 業界 など）にも耐えるようにしておく。
 */
function extractIndustry(text: string): string | null {
  const patterns = [
    /(?:^|\n)\s*(?:#+\s*)?\*{0,2}(?:業界|所属業界|業種)\*{0,2}\s*[:：]\s*(.+)/,
    /(?:^|\n)\s*(?:#+\s*)?(.+?(?:業界|業|メーカー|産業))\s*$/,
  ];
  for (const re of patterns) {
    const raw = text.match(re)?.[1]?.trim();
    if (!raw) continue;
    const cleaned = raw.replace(/[*_`#]/g, '').split(/[、,（(]/)[0].trim();
    if (cleaned.length >= 2 && cleaned.length <= 40) return cleaned;
  }
  return null;
}




/** "2025-03" / "2025年3月" / "2025" などを "YYYY-MM" or "YYYY" に寄せる */
function normalizeAsOf(raw: string): string | null {
  const s = raw.trim();
  if (/unknown|不明/i.test(s)) return null;
  const ym = s.match(/(\d{4})\s*[-/年]\s*(\d{1,2})/);
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`;
  const y = s.match(/(\d{4})/);
  return y ? y[1] : null;
}
