"use client";

// ─── 提案骨子をAIと作る ──────────────────────────────────────────────────────
//
//   「何をしたいか」をカードで選ぶ → 提案骨子（メインビュー）
//                                  → 参考にした情報はサイドカラムで外して再生成
//
// 設計の要:
//   1. **材料を先に選ばせない。** 15枚のチェックボックスを最初に見せても、
//      何を選ぶべきか判断できない。まず骨子を出し、外したいものを外す順にする。
//   2. **カードはおすすめ順。** 並びは算出で決まる（LLMを挟むと表示が20秒遅れる）。
//   3. **サイドのチェックを外して再生成すると、そのコンテキストが実際に抜ける。**
//      効かない操作を置くと、担当者は再生成を信じなくなる。
//   4. 骨子の章立ては固定。Context → Why Now → Goal → Gap → Approach
//      → Solution → Proof → Execution → Decision。案件で変わるのは比重だけ。

import { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertCircle, AlertTriangle, Check, Square, CheckSquare,
  Sparkles, ChevronLeft, ChevronDown, Copy, RefreshCw, Wand2, Info, Plus, X,
  Download, Save, FileText, Trash2, Clock, PenLine, ChevronRight, Target,
} from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { outlineToMarkdown, outlineFileName } from "@/lib/company/outline-markdown";
import type { ProposalIntentsResponse, ProposalIntent, IntentFit } from "@/app/api/company/[companyUid]/proposal-intents/route";
import type { SituationCandidatesResponse, SituationCandidate } from "@/app/api/company/[companyUid]/situations/route";
import type { ProposalOutlineResponse, CustomIntent } from "@/app/api/company/[companyUid]/proposal-outline/route";
import type { EvidenceItem, EvidenceGroup, EvidenceConfidence, EvidenceRelevance } from "@/lib/company/proposal-inputs";
import { intentKeywords, pruneCommonKeywords, evidenceRelevance } from "@/lib/company/proposal-inputs";
import type { CompanyProfileResponse } from "@/app/api/company/[companyUid]/profile/route";
import type { ProposalRecordsResponse } from "@/app/api/company/[companyUid]/proposal-records/route";
import type { SavedOutlineSummary, SavedOutlineDetail } from "@/lib/nocodb/proposal-outlines";

/**
 * 観測された状況の、**選んだ狙いにおける役割**の表示。
 * 同じシグナルでも狙いによって反転する（習慣化は Bundle化 では追い風、
 * FDE伴走では「自走できている」という断り材料）。
 */
const ROLE_BADGE: Record<string, { label: string; cls: string; hint: string }> = {
  tailwind:     { label: "追い風",     cls: "bg-emerald-100 text-emerald-800", hint: "この狙いを後押しする材料" },
  blocker:      { label: "先に解消",   cls: "bg-red-100 text-red-800",         hint: "放置して提案すると通らない。先に手当てが要る" },
  prerequisite: { label: "前提",       cls: "bg-amber-100 text-amber-800",     hint: "この狙いが成立する前提" },
  related:      { label: "狙いに関連", cls: "bg-blue-100 text-blue-800",       hint: "狙いに関係する材料" },
};

/**
 * B1（提案の狙い）由来のフィールドの既定値。
 * カタログ外の狙い（担当者が立てたもの・保存済み記録の復元）で使う。
 */
const EMPTY_INTENT_FIELDS = {
  contract: "any" as const,
  contractOk: true,
  requiredInputs: [] as string[],
  audiences: [] as string[],
  changeTarget: "",
  businessImpact: "",
  signals: [] as ProposalIntent["signals"],
};


// ── 表示メタ ──────────────────────────────────────────────────────────────────

const CONFIDENCE_META: Record<EvidenceConfidence, { label: string; chip: string; hint: string }> = {
  measured: { label: "観測", chip: "bg-emerald-50 text-emerald-700", hint: "実測値。骨子では断定して書かれます" },
  inferred: { label: "推論", chip: "bg-amber-50 text-amber-700",   hint: "LLM抽出・推定。骨子では出所付きで、断定せずに書かれます" },
  stated:   { label: "申告", chip: "bg-slate-100 text-slate-600",  hint: "相手の発言・担当者の記述。事実としてではなく「伺っている」として書かれます" },
};

const FIT_META: Record<IntentFit, { label: string; chip: string; hint: string }> = {
  recommended: {
    label: "おすすめ", chip: "bg-emerald-100 text-emerald-800",
    hint: "今の状況に効く条件が一致しています",
  },
  possible: {
    label: "選べる", chip: "bg-slate-100 text-slate-600",
    hint: "効く条件は一致していませんが、妨げる状況もありません。担当者の判断で選べます",
  },
  not_advised: {
    label: "非推奨", chip: "bg-red-50 text-red-700",
    hint: "逆効果になる状況が立っています。当てるなら理由が必要です",
  },
};

const TYPE_META = {
  fde:     { label: "FDE型", chip: "bg-indigo-100 text-indigo-800", hint: "一緒に解をつくる提案。課題定義とPoCに比重が寄ります" },
  product: { label: "製品型", chip: "bg-sky-100 text-sky-800",      hint: "すでにある解を早く使う提案。導入と定着に比重が寄ります" },
} as const;

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[10px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] ${className}`}>{children}</section>;
}

interface CustomContext { title: string; detail: string }

// ── 本体 ──────────────────────────────────────────────────────────────────────

export function ProposalFlow({ companyUid, profile }: {
  companyUid: string;
  /** 顧客情報タブで生成済みならコンテキストに加える */
  profile: CompanyProfileResponse | null;
}) {
  const [data, setData] = useState<ProposalIntentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [intent, setIntent] = useState<ProposalIntent | null>(null);
  const [outline, setOutline] = useState<ProposalOutlineResponse | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState<string | null>(null);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<CustomContext[]>([]);
  const [instruction, setInstruction] = useState("");

  // 記録（保存済みの骨子）
  const [records, setRecords] = useState<SavedOutlineSummary[]>([]);
  const [saveEnabled, setSaveEnabled] = useState(false);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  /**
   * 狙いを決めた後、生成前に情報を選ぶ段。
   * 生成すると false に戻り、骨子＋サイドカラムの画面になる。
   */
  const [picking, setPicking] = useState(false);
  /** カスタムの狙い（カタログ外）。null = カタログの狙いを使っている */
  const [customIntent, setCustomIntent] = useState<CustomIntent | null>(null);

  // 顧客理解はコンテキストに混ぜる（状況IDは持たないのでカード選定には影響しない）
  const groups: EvidenceGroup[] = useMemo(() => {
    if (!data) return [];
    const items: EvidenceItem[] = (profile?.sections ?? [])
      .filter(s => s.bullets.length > 0)
      .map(s => ({
        id: `profile:${s.key}`,
        kind: "profile" as const,
        title: s.title,
        detail: s.bullets.map(b => `・${b.text}`).join("\n"),
        situationIds: [],
        source: "顧客理解プロファイル（顧客情報タブで生成）",
        asOf: null,
        confidence: "inferred" as const,
        approximate: false,
        defaultSelected: true,
      }));
    if (items.length === 0) return data.groups;
    return [...data.groups, {
      kind: "profile" as const,
      label: "顧客理解",
      affectsWhat: false,
      note: "顧客情報タブで生成した内容。前提認識の記述に使います。",
      items,
    }];
  }, [data, profile]);

  const context: EvidenceItem[] = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // ── 記録 ────────────────────────────────────────────────────────────────
  async function loadRecords() {
    try {
      const r = await fetch(`/api/company/${companyUid}/proposal-records`);
      if (!r.ok) return;
      const j = await r.json() as ProposalRecordsResponse;
      setRecords(j.records);
      setSaveEnabled(j.enabled);
    } catch {
      // 記録が読めなくても骨子は作れる。黙って続行する
    }
  }

  async function saveRecord() {
    if (!outline || !data || !intent) return;
    setSaving(true); setSaveMsg(null);
    try {
      const r = await fetch(`/api/company/${companyUid}/proposal-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: recordId,
          companyName: data.companyName,
          title: outline.title,
          intentName: intent.name,
          proposalType: outline.proposalType,
          frameName: outline.frame,
          instruction,
          outline,
          contextIds: outline.usedContextIds,
          customContext: custom,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      if (j.rowId) setRecordId(j.rowId);
      setSaveMsg(recordId ? "記録を更新しました" : "記録に保存しました");
      loadRecords();
    } catch (e) {
      setSaveMsg(`保存できませんでした: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }

  /** 記録を開き直す。材料一覧が必要なので先に load() を通す */
  async function restoreRecord(rowId: number) {
    setRestoring(true); setError(null);
    try {
      const [detailRes, base] = await Promise.all([
        fetch(`/api/company/${companyUid}/proposal-records?id=${rowId}`).then(r => r.json()),
        data ? Promise.resolve(data) : loadIntents(),
      ]);
      if (detailRes?.error) throw new Error(detailRes.error);
      const detail = detailRes as SavedOutlineDetail;
      const saved = detail.outline as ProposalOutlineResponse | null;
      if (!saved) throw new Error("保存された骨子を読めませんでした");

      // 選んだ狙いを一覧から引き当てる（カタログが変わっていれば見つからない）
      const target = base.intents.find(i => i.name === detail.intentName) ?? null;
      setIntent(target ?? {
        ...EMPTY_INTENT_FIELDS,
        name: detail.intentName,
        displayName: saved.intent.displayName,
        nameSafe: saved.intent.nameSafe,
        kind: saved.intent.kind,
        proposalType: saved.proposalType,
        valueLine: "",
        expectedEffect: "",
        fit: "possible",
        relatedSituations: [],
        reasons: [],
        cautions: [],
        matchedSituations: [],
        meetingRate: null,
        supporting: [],
        frameName: saved.frame,
      });
      setOutline(saved);
      setChecked(new Set(detail.contextIds));
      setCustom(detail.customContext);
      setInstruction(detail.instruction);
      setRecordId(rowId);
      setPicking(false);
      // 保存された骨子がカスタムの狙いなら、その狙いを復元して再生成できるようにする
      setCustomIntent(saved.intent.custom
        ? { displayName: saved.intent.displayName, valueLine: "", proposalType: saved.proposalType }
        : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoring(false);
    }
  }

  async function deleteRecord(rowId: number) {
    try {
      await fetch(`/api/company/${companyUid}/proposal-records?id=${rowId}`, { method: "DELETE" });
      if (recordId === rowId) setRecordId(null);
      loadRecords();
    } catch {
      // 失敗しても一覧は再読込で復帰する
    }
  }

  /**
   * 材料と候補を取得して state に入れ、取得結果を返す。
   * @param refreshCatalog true = Notion のカタログも取り直す（1時間キャッシュを無視）
   */
  async function loadIntents(refreshCatalog = false): Promise<ProposalIntentsResponse> {
    const qs = refreshCatalog ? '?refreshCatalog=1' : '';
    const r = await fetch(`/api/company/${companyUid}/proposal-intents${qs}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    const d = j as ProposalIntentsResponse;
    setData(d);
    return d;
  }

  async function load(refreshCatalog = false) {
    setLoading(true); setError(null);
    try {
      const d = await loadIntents(refreshCatalog);
      setChecked(new Set<string>());
      setIntent(null); setOutline(null); setCustom([]); setRecordId(null);
      setPicking(false); setCustomIntent(null);
      loadRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  /**
   * 狙いを決めたときの既定選択。
   *
   * **狙いに関係する材料を優先する。** 全件チェックだと議事録100件が全部入り、
   * 「選ばれる情報が狙いに沿っていない」状態になる（実測114件中13件しか
   * 意味を持たなかった）。関連の判定は状況IDの重なりで機械的に行う。
   */
  function defaultSelectionFor(target: ProposalIntent | null): Set<string> {
    const rel = relevanceFor(target);
    const ids = new Set<string>();

    // 会話・議事録は件数が多い（実測114件の企業がある）。
    // 関連ありと、関連が無ければ直近2件だけに絞る。全部入れると狙いから外れる。
    const talks = context
      .filter(i => i.kind === "communication")
      .sort((a, b) => (b.asOf ?? "").localeCompare(a.asOf ?? ""));
    let fallback = 0;
    for (const t of talks) {
      if (rel(t).related) { ids.add(t.id); continue; }
      if (fallback < 2) { ids.add(t.id); fallback++; }
    }

    for (const i of context) {
      if (i.kind === "communication") continue;
      // 基礎事実（準備度・提案の型・更新・利用実態・顧客理解）は常に入れる。
      // どの狙いでも Context / Why Now を書くのに必要になる。
      if (["readiness", "play", "renewal", "usage", "profile"].includes(i.kind)) { ids.add(i.id); continue; }
      // 行動シグナル・外部情報・手動登録は顧客の事実なので、関連が無くても入れる
      if (["behavior", "external", "manual"].includes(i.kind)) { ids.add(i.id); continue; }
      if (rel(i).related) ids.add(i.id);
    }
    return ids;
  }

  /** 狙いへの関連判定。状況IDの重なり → 語句の一致 の順に見る */
  function relevanceFor(target: ProposalIntent | null): (item: EvidenceItem) => EvidenceRelevance {
    const relatedSituations = target?.relatedSituations ?? [];
    // 材料の半分以上に当たる語句は情報量が無いので落とす
    const keywords = pruneCommonKeywords(
      intentKeywords(target?.displayName, target?.valueLine),
      context,
    );
    // **狙いごとの役割表。** 同じ状況が狙いによって追い風にも障害にもなる
    const roleBySid = new Map(
      (target?.signals ?? []).map(sg => [sg.id, sg.role === "unrelated" ? null : sg.role]),
    );
    return (item: EvidenceItem) => evidenceRelevance(item, {
      relatedSituations, keywords, situationLabel: label,
      roleOf: sid => roleBySid.get(sid) ?? null,
    });
  }

  /** 狙いを選ぶ → 情報選択の段へ */
  function pickIntent(target: ProposalIntent, custom: CustomIntent | null = null) {
    setIntent(target);
    setCustomIntent(custom);
    setOutline(null); setOutlineError(null); setRecordId(null);
    setChecked(defaultSelectionFor(target));
    setPicking(true);
  }

  async function generate(target: ProposalIntent, ctxIds: Set<string>, customCtx: CustomContext[]) {
    if (!data) return;
    setOutlineLoading(true); setOutlineError(null);
    try {
      const r = await fetch(`/api/company/${companyUid}/proposal-outline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          intentName: target.name,
          customIntent,
          context: context.filter(c => ctxIds.has(c.id)),
          customContext: customCtx.filter(c => c.detail.trim()),
          frameName: target.frameName,
          instruction: instruction.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setOutline(j as ProposalOutlineResponse);
      setPicking(false);
    } catch (e) {
      setOutlineError(e instanceof Error ? e.message : String(e));
    } finally {
      setOutlineLoading(false);
    }
  }

  const label = (sid: string) => data?.situationLabels[sid] || sid;

  // ── 未開始（＝提案準備Top）──────────────────────────────────────────────
  // 記録一覧は RecordList の onMount で読む（骨子を作る前から見えている必要がある）
  if (!data) {
    return (
      <div className="space-y-3">
      <Card className="px-5 py-6">
        <div className="flex items-start gap-3">
          <Wand2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-slate-900">提案骨子を作る</h2>
            <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
              この企業の状況から「何をしたいか」の候補をおすすめ順に出します。
              選ぶと9章構成の提案骨子ができ、参考にした情報を外して作り直せます。
            </p>
            {error && (
              <div className="flex items-center gap-1.5 text-[12px] text-red-600 mt-2">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}
            <button
              onClick={() => load()}
              disabled={loading || restoring}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-700 disabled:opacity-50"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />候補を出しています…</>
                : <><Sparkles className="w-4 h-4" />候補を出す</>}
            </button>
          </div>
        </div>
      </Card>

      <RecordList
        records={records}
        busy={restoring}
        activeId={recordId}
        onOpen={restoreRecord}
        onDelete={deleteRecord}
        onMount={loadRecords}
      />
      </div>
    );
  }

  // ── 狙いを選ぶ ──────────────────────────────────────────────────────────
  if (!intent) {
    return (
      <div className="space-y-3">
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-bold text-slate-900">何をしたいか</h2>
            <span className="text-[11px] text-slate-400">おすすめ順・{data.intents.length}件</span>
            <button
              onClick={() => load(true)}
              disabled={loading}
              title="Notion のカタログ（WHAT・事例・施策）を取り直します"
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Notionを取り直す
            </button>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-1">
            提供できるもの全部を、今の状況への合い方でおすすめ順に並べています。
            「選べる」「非推奨」も選択できます。選ぶと骨子ができ、参考にした情報は後から外せます。
          </p>
          {data.catalog.unavailable && (
            <div className="flex items-start gap-1.5 text-[11.5px] text-amber-700 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              WHATカタログ（Notion）が読めていません: {data.catalog.unavailable}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
            <span>事例 {data.catalog.counts.casesUsable}/{data.catalog.counts.casesTotal}件</span>
            <span>施策・問い {data.catalog.counts.playbooksUsable}/{data.catalog.counts.playbooksTotal}件</span>
            <span className={data.noMatchingCase.applied ? "text-amber-700" : ""}>
              事例の一致判定: {data.noMatchingCase.applied ? "0件のため状況を追加" : data.noMatchingCase.reason}
            </span>
            <span title="Notion は1時間キャッシュしています。更新直後は「Notionを取り直す」を押してください">
              Notion取得 {new Date(data.catalog.fetchedAt).toLocaleString("ja-JP", {
                month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
              })}
              {data.catalog.refreshed && "（取り直し済み）"}
            </span>
          </div>
          {/* **なぜ出ていないか**を出す。契約前提で外した狙いは順位を下げるのでなく返していない */}
          {data.hiddenByContract.length > 0 && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              契約が
              <span className="font-bold text-slate-600">
                {data.contractPlan === "bundle" ? "Bundle" : data.contractPlan === "insight" ? "Insight" : data.contractPlan === "experience" ? "Experience" : "未取得"}
              </span>
              のため出していない狙い: {data.hiddenByContract.map(h => h.name).join("、")}
            </p>
          )}
        </Card>

        {/* 議事録から状況を拾う。**登録すると上の並びが変わる** */}
        <SituationCandidates companyUid={companyUid} onRegistered={() => load()} />

        {data.intents.length === 0 ? (
          <div className="space-y-3">
            <Card className="px-5 py-6 text-center">
              <p className="text-[12.5px] text-slate-500">
                カタログからの候補はありません。逆効果になる状況が立っているか、
                カタログの利用可が0件の可能性があります。自分で狙いを立てることもできます。
              </p>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <CustomIntentCard onPick={(ci, target) => pickIntent(target, ci)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.intents.map((it, i) => (
              <IntentCard
                key={it.name}
                intent={it}
                rank={i + 1}
                onPick={() => pickIntent(it)}
              />
            ))}
            <CustomIntentCard onPick={(ci, target) => pickIntent(target, ci)} />
          </div>
        )}

        <RecordList
          records={records}
          busy={restoring}
          activeId={recordId}
          onOpen={restoreRecord}
          onDelete={deleteRecord}
        />

        {/* 当てなかった理由 */}
        {data.excluded.length > 0 && (
          <Card className="px-5 py-4">
            <h3 className="text-[12.5px] font-bold text-slate-800 flex items-center gap-1.5">
              候補から外したもの
              <InfoTip text="逆効果になる状況が立っているため外したものです。ここを見ないと「なぜ出てこないか」がわかりません。" />
            </h3>
            <ul className="mt-1.5 space-y-0.5">
              {data.excluded.map((e, i) => (
                <li key={i} className="text-[11.5px] text-slate-600">
                  <span className="text-slate-400">✗</span> {e.whatName}
                  <span className="text-slate-400"> — {e.reason}: </span>
                  {e.situationIds.map(s => label(s)).join("、")}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  // ── 情報を選ぶ（狙いを決めた直後）────────────────────────────────────────
  if (picking) {
    return (
      <InfoPicker
        intent={intent}
        isCustom={customIntent !== null}
        relevance={relevanceFor(intent)}
        groups={groups}
        checked={checked}
        setChecked={setChecked}
        custom={custom}
        setCustom={setCustom}
        instruction={instruction}
        setInstruction={setInstruction}
        busy={outlineLoading}
        error={outlineError}
        label={label}
        onBack={() => { setPicking(false); setIntent(null); setCustomIntent(null); }}
        onReset={() => setChecked(defaultSelectionFor(intent))}
        onGenerate={() => generate(intent, checked, custom)}
      />
    );
  }

  // ── 骨子（メイン）＋ コンテキスト（サイド）──────────────────────────────
  return (
    <div className="space-y-3">
      <Card className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setIntent(null); setOutline(null); setOutlineError(null); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />別の狙いを選ぶ
          </button>
          <button
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            <Target className="w-3.5 h-3.5" />情報を選び直す
          </button>
          <span className="text-[13px] font-bold text-slate-900">{intent.displayName}</span>
          {customIntent && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">カスタム</span>
          )}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[intent.proposalType].chip}`}
                title={TYPE_META[intent.proposalType].hint}>
            {TYPE_META[intent.proposalType].label}
          </span>
          {!intent.nameSafe && (
            <span className="text-[10.5px] text-amber-700 font-semibold">呼称未確定（顧客向けに出せません）</span>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
        {/* ── メイン: 骨子 ── */}
        <div className="min-w-0">
          {outlineLoading && !outline && (
            <Card className="px-5 py-10">
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[12.5px]">提案骨子を書いています…（1分ほどかかります）</span>
              </div>
            </Card>
          )}
          {outlineError && (
            <Card className="px-5 py-4">
              <div className="flex items-start gap-1.5 text-[12px] text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />{outlineError}
              </div>
            </Card>
          )}
          {outline && (
            <OutlineView
              outline={outline}
              busy={outlineLoading}
              companyName={data.companyName}
              instruction={instruction}
              saveEnabled={saveEnabled}
              saving={saving}
              saveMsg={saveMsg}
              isSaved={recordId !== null}
              onSave={saveRecord}
            />
          )}
        </div>

        {/* ── サイド: コンテキスト ── */}
        <ContextPanel
          context={context}
          checked={checked}
          setChecked={setChecked}
          custom={custom}
          setCustom={setCustom}
          instruction={instruction}
          setInstruction={setInstruction}
          busy={outlineLoading}
          usedIds={outline?.usedContextIds ?? null}
          unevaluated={data.unevaluated}
          label={label}
          onRegenerate={() => generate(intent, checked, custom)}
          onRepick={() => setPicking(true)}
        />
      </div>
    </div>
  );
}

// ── 記録（保存済みの骨子）──────────────────────────────────────────────────────
//
// 提案準備タブの先頭に置く。ここが「これまで何を組み立てたか」の入口になる。
// 開き直すと、そのときのコンテキスト選択・追記・指示まで復元する。

function RecordList({ records, busy, activeId, onOpen, onDelete, onMount }: {
  records: SavedOutlineSummary[];
  busy: boolean;
  activeId: number | null;
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  /** 初回マウント時に一覧を読む（未開始画面用） */
  onMount?: () => void;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => { onMount?.(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (records.length === 0) return null;

  return (
    <Card className="px-5 py-4">
      <div className="flex items-center gap-1.5">
        <FileText className="w-4 h-4 text-slate-400" />
        <h3 className="text-[12.5px] font-bold text-slate-900">これまでの提案骨子</h3>
        <span className="text-[11px] text-slate-400 tabular-nums">{records.length}件</span>
        <InfoTip text="保存した骨子です。開くと、そのときの参考情報の選択・追記・指示まで戻ります。そこから作り直せます。" />
      </div>

      <div className="mt-2 space-y-1">
        {records.map(r => (
          <div
            key={r.id}
            className={`rounded-[8px] border px-3 py-2 ${
              activeId === r.id ? "border-slate-400 bg-slate-50" : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-start gap-2">
              <button
                onClick={() => onOpen(r.id)}
                disabled={busy}
                className="text-left min-w-0 flex-1 group disabled:opacity-50"
              >
                <div className="text-[12.5px] font-semibold text-slate-900 group-hover:underline decoration-dotted leading-snug">
                  {r.title}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                    r.proposalType === "fde" ? "bg-indigo-100 text-indigo-800" : "bg-sky-100 text-sky-800"
                  }`}>
                    {r.proposalType === "fde" ? "FDE型" : "製品型"}
                  </span>
                  <span className="text-[10.5px] text-slate-500">{r.intentName}</span>
                  <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5 tabular-nums">
                    <Clock className="w-2.5 h-2.5" />
                    {r.updatedAt ?? r.createdAt ?? "日時不明"}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">参考情報 {r.contextCount}件</span>
                  {activeId === r.id && (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">編集中</span>
                  )}
                </div>
              </button>

              {confirming === r.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { onDelete(r.id); setConfirming(null); }}
                    className="px-2 py-1 rounded-[6px] bg-red-600 text-white text-[11px] font-bold"
                  >
                    削除する
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    className="px-2 py-1 rounded-[6px] border border-slate-200 text-[11px] text-slate-600"
                  >
                    やめる
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(r.id)}
                  className="text-slate-300 hover:text-red-600 shrink-0 mt-0.5"
                  aria-label="この記録を削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 狙いカード ────────────────────────────────────────────────────────────────

function IntentCard({ intent, rank, onPick }: { intent: ProposalIntent; rank: number; onPick: () => void }) {
  const t = TYPE_META[intent.proposalType];
  const f = FIT_META[intent.fit];
  const dim = intent.fit !== "recommended";
  return (
    <button
      onClick={onPick}
      className={`text-left rounded-[10px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,.06)] hover:border-slate-400 hover:shadow-[0_2px_8px_rgba(15,23,42,.08)] transition-all px-4 py-3.5 flex flex-col gap-2 ${
        intent.fit === "not_advised" ? "border-red-200" : dim ? "border-slate-150" : "border-slate-300"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded tabular-nums shrink-0 ${
          dim ? "bg-slate-200 text-slate-600" : "bg-slate-900 text-white"
        }`}>
          {rank}
        </span>
        <span className={`text-[13px] font-bold leading-snug min-w-0 ${dim ? "text-slate-600" : "text-slate-900"}`}>
          {intent.displayName}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${f.chip}`} title={f.hint}>{f.label}</span>
        <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${t.chip}`}>{t.label}</span>
        {/* **誰に語るか。** 部長・決裁者なら機能でなく組織と事業の話にする */}
        {intent.audiences.map(a => (
          <span key={a} className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
            a === "決裁者" ? "bg-red-50 text-red-700" : a === "部長" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
          }`} title="この狙いを持ち込む相手のレイヤー">{a}</span>
        ))}
        {intent.kind && (
          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{intent.kind}</span>
        )}
        {intent.meetingRate !== null && (
          <span className="text-[9.5px] text-slate-400 tabular-nums">打合せ率 {Math.round(intent.meetingRate * 100)}%</span>
        )}
        {!intent.nameSafe && (
          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">呼称未確定</span>
        )}
      </div>

      {intent.valueLine && (
        <p className="text-[11.5px] text-slate-600 leading-relaxed">{intent.valueLine}</p>
      )}

      {/* **組織の何を変えるか。** 決裁者・部長には機能でなくここを話す */}
      {intent.changeTarget && (
        <p className="text-[11px] text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-2">
          <span className="font-bold text-slate-600">変えるもの: </span>{intent.changeTarget}
        </p>
      )}

      {/* 骨子に要る材料。業界情報が要る狙いは、無いまま書くと Why Now が空になる */}
      {intent.requiredInputs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9.5px] text-slate-400">要る材料</span>
          {intent.requiredInputs.map(r => (
            <span key={r} className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r}</span>
          ))}
        </div>
      )}

      {intent.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {intent.reasons.map((r, i) => (
            <span key={i} className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
              {r}
            </span>
          ))}
        </div>
      )}

      {intent.cautions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
          {intent.cautions.map((c, i) => (
            <span key={i} className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-700">
              {c}
            </span>
          ))}
        </div>
      )}

      {intent.fit === "possible" && intent.reasons.length === 0 && (
        <p className="text-[10px] text-slate-400">今の状況に効く条件は一致していません</p>
      )}

      {intent.frameName && (
        <p className="text-[10.5px] text-slate-400">語り口: {intent.frameName}</p>
      )}
    </button>
  );
}

// ── カスタムの狙い ────────────────────────────────────────────────────────────
//
// カタログに無い狙いを担当者が立てられるようにする。
// カタログ（Notion）が正本という原則は崩さないので、**カタログには保存しない。**
// その場の骨子を書くためだけに使う。

function CustomIntentCard({ onPick }: {
  onPick: (custom: CustomIntent, target: ProposalIntent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<"fde" | "product">("fde");

  function submit() {
    if (!name.trim()) return;
    const custom: CustomIntent = {
      displayName: name.trim(),
      valueLine: value.trim(),
      proposalType: type,
    };
    onPick(custom, {
      ...EMPTY_INTENT_FIELDS,
      name: name.trim(),
      displayName: name.trim(),
      nameSafe: true,
      kind: "担当者が立てた狙い",
      proposalType: type,
      valueLine: value.trim(),
      expectedEffect: "",
      fit: "possible",
      // カタログ外なので関連状況が無い。情報選択は基礎事実＋直近の会話が既定になる
      relatedSituations: [],
      reasons: [],
      cautions: [],
      matchedSituations: [],
      meetingRate: null,
      supporting: [],
      frameName: null,
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-left rounded-[10px] border border-dashed border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50 transition-all px-4 py-3.5 flex flex-col items-center justify-center gap-1.5 min-h-[9rem]"
      >
        <PenLine className="w-5 h-5 text-slate-400" />
        <span className="text-[12.5px] font-bold text-slate-700">自分で狙いを立てる</span>
        <span className="text-[11px] text-slate-500 text-center leading-relaxed">
          カタログに無い切り口で骨子を作ります
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-[10px] border border-slate-400 bg-white px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <PenLine className="w-4 h-4 text-slate-500" />
        <h3 className="text-[12.5px] font-bold text-slate-900">自分で狙いを立てる</h3>
        <InfoTip text="カタログ（Notion）には保存されません。この骨子を書くためだけに使います。カタログに残したい狙いはNotion側で追加してください。" />
      </div>

      <label className="block mt-2">
        <span className="text-[11px] font-bold text-slate-500">狙いの名称</span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例: 代理店経由の案件で検証サイクルを作る"
          className="w-full mt-0.5 text-[12px] px-2.5 py-1.5 rounded-[7px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <label className="block mt-2">
        <span className="text-[11px] font-bold text-slate-500">何を変えるか（任意）</span>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="例: 制作待ちを挟まずに、代理店側で仮説検証を回せる状態にする"
          rows={2}
          className="w-full mt-0.5 text-[12px] px-2.5 py-1.5 rounded-[7px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-y"
        />
      </label>

      <div className="mt-2">
        <span className="text-[11px] font-bold text-slate-500">提案の型</span>
        <div className="flex gap-1.5 mt-0.5">
          {([
            ["fde", "FDE型", "一緒に解をつくる。課題定義とPoCに寄る"],
            ["product", "製品型", "すでにある解を早く使う。導入と定着に寄る"],
          ] as const).map(([v, lab, hint]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              title={hint}
              className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-bold border ${
                type === v ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[7px] bg-slate-900 text-white text-[12px] font-bold disabled:opacity-40"
        >
          情報を選ぶ<ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-2.5 py-1.5 rounded-[7px] border border-slate-200 text-[12px] text-slate-600"
        >
          やめる
        </button>
      </div>
    </div>
  );
}

// ── 情報を選ぶ（狙いを決めた直後）────────────────────────────────────────────
//
// 種別ごとに横スクロール（カルーセル）で並べる。
// **狙いに関係する材料を先頭に置き、既定で選択する。**
// 全件を縦に並べると議事録100件に埋もれて、狙いに沿った選択ができない。

function InfoPicker({
  intent, isCustom, relevance, groups, checked, setChecked, custom, setCustom,
  instruction, setInstruction, busy, error, label, onBack, onReset, onGenerate,
}: {
  intent: ProposalIntent;
  isCustom: boolean;
  /** 狙いへの関連判定（状況IDの重なり or 語句の一致） */
  relevance: (item: EvidenceItem) => EvidenceRelevance;
  groups: EvidenceGroup[];
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  custom: CustomContext[];
  setCustom: (c: CustomContext[]) => void;
  instruction: string;
  setInstruction: (v: string) => void;
  busy: boolean;
  error: string | null;
  label: (sid: string) => string;
  onBack: () => void;
  onReset: () => void;
  onGenerate: () => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };
  const setGroup = (g: EvidenceGroup, on: boolean) => {
    const next = new Set(checked);
    for (const i of g.items) { if (on) next.add(i.id); else next.delete(i.id); }
    setChecked(next);
  };

  const total = groups.reduce((n, g) => n + g.items.filter(i => checked.has(i.id)).length, 0)
    + custom.filter(c => c.detail.trim()).length;

  return (
    <div className="space-y-3">
      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="w-3.5 h-3.5" />狙いを選び直す
          </button>
          <span className="text-[13.5px] font-bold text-slate-900">{intent.displayName}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_META[intent.proposalType].chip}`}>
            {TYPE_META[intent.proposalType].label}
          </span>
          {isCustom && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">カスタム</span>
          )}
        </div>
        <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
          この狙いに使う情報を種別ごとに選んでください。
          <span className="font-semibold text-blue-700">「狙いに関連」</span>が付いたものと基礎的な事実を既定で選んでいます。
          {intent.valueLine && <><br />{intent.valueLine}</>}
        </p>
      </Card>

      {groups.map(g => {
        const items = [...g.items].sort((a, b) => {
          const ra = relevance(a).related ? 0 : 1, rb = relevance(b).related ? 0 : 1;
          if (ra !== rb) return ra - rb;
          const ca = checked.has(a.id) ? 0 : 1, cb = checked.has(b.id) ? 0 : 1;
          if (ca !== cb) return ca - cb;
          return (b.asOf ?? "").localeCompare(a.asOf ?? "");
        });
        const on = g.items.filter(i => checked.has(i.id)).length;
        const relCount = g.items.filter(i => relevance(i).related).length;
        return (
          <Card key={g.kind} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[12.5px] font-bold text-slate-800">{g.label}</h3>
              <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                g.affectsWhat ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
              }`}>
                {g.affectsWhat ? "状況を運ぶ" : "文章の材料"}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums">{on}/{g.items.length}</span>
              {relCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 tabular-nums">
                  狙いに関連 {relCount}件
                </span>
              )}
              <button
                onClick={() => setGroup(g, on < g.items.length)}
                className="text-[11px] text-slate-500 hover:text-slate-900 underline decoration-dotted"
              >
                {on < g.items.length ? "全選択" : "全解除"}
              </button>
              <InfoTip text={g.note} />
              {/* 絞った件数は必ず出す。黙って切り捨てると「事例が少ない」と誤解される */}
              {g.truncated && (
                <span className="text-[10px] text-amber-700">
                  {g.truncated.total}件中{g.truncated.shown}件を表示（{g.truncated.reason}）
                </span>
              )}
            </div>

            {/* カルーセル: 横スクロールで種別ごとに見比べる */}
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1.5 snap-x">
              {items.map(item => (
                <InfoCard
                  key={item.id}
                  item={item}
                  on={checked.has(item.id)}
                  relevance={relevance(item)}
                  label={label}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
          </Card>
        );
      })}

      {/* 追記と生成 */}
      <Card className="px-5 py-4">
        <CustomContextEditor custom={custom} setCustom={setCustom} />

        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          placeholder="AIへの指示（任意）例: 更新確保を優先する前提で書いて"
          rows={2}
          className="w-full mt-2.5 text-[12px] px-3 py-2 rounded-[8px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-y"
        />

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <button
            onClick={onGenerate}
            disabled={busy || total === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-slate-900 text-white text-[12.5px] font-bold hover:bg-slate-700 disabled:opacity-50"
          >
            {busy
              ? <><Loader2 className="w-4 h-4 animate-spin" />骨子を書いています…（1分ほど）</>
              : <><Wand2 className="w-4 h-4" />この情報で骨子を作る</>}
          </button>
          <button
            onClick={onReset}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />おすすめの選択に戻す
          </button>
          <span className="text-[11.5px] text-slate-400 tabular-nums">{total}件を使います</span>
        </div>
        {error && (
          <div className="flex items-start gap-1.5 text-[12px] text-red-600 mt-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />{error}
          </div>
        )}
      </Card>
    </div>
  );
}

/** カルーセルの1枚 */
function InfoCard({ item, on, relevance, label, onToggle }: {
  item: EvidenceItem;
  on: boolean;
  relevance: EvidenceRelevance;
  label: (sid: string) => string;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const conf = CONFIDENCE_META[item.confidence];
  const long = item.detail.length > 120;

  return (
    <div
      className={`shrink-0 w-[16.5rem] snap-start rounded-[8px] border px-3 py-2 ${
        on ? "border-slate-400 bg-white" : "border-slate-150 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <button onClick={onToggle} className="shrink-0 mt-0.5" aria-label="この情報を使うか">
          {on ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-300" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1">
            {relevance.related && (() => {
              // **狙いによって同じシグナルの意味が変わる。**
              // 「関連あり」だけだと、追い風なのか先に潰すべき障害なのかが読めない。
              const m = ROLE_BADGE[relevance.role ?? "related"];
              return (
                <span
                  className={`text-[9px] font-bold px-1 py-px rounded ${m.cls}`}
                  title={`${m.hint}｜${relevance.by === "situation" ? "状況が一致" : "語句が一致"}: ${relevance.hits.join("、")}`}
                >
                  {m.label}{relevance.by === "keyword" ? "（語句）" : ""}
                </span>
              );
            })()}
            <span className={`text-[9px] font-bold px-1 py-px rounded ${conf.chip}`} title={conf.hint}>
              {conf.label}
            </span>
            {item.approximate && (
              <span className="text-[9px] font-bold px-1 py-px rounded bg-slate-100 text-slate-500" title="近似で判定">≈</span>
            )}
            {item.asOf && <span className="text-[9.5px] text-slate-400 tabular-nums">{item.asOf}</span>}
          </div>
          <div className={`text-[11.5px] font-semibold leading-snug mt-0.5 ${on ? "text-slate-900" : "text-slate-400"}`}>
            {item.title}
          </div>
          <p className={`text-[10.5px] mt-0.5 whitespace-pre-wrap leading-relaxed ${on ? "text-slate-600" : "text-slate-400"}`}>
            {expanded || !long ? item.detail : `${item.detail.slice(0, 120)}…`}
          </p>
          {long && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5"
            >
              {expanded ? "折りたたむ" : "全文"}
              <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
          {item.situationIds.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {item.situationIds.map(sid => (
                <span key={sid} className="text-[9px] font-semibold px-1 py-px rounded bg-blue-50 text-blue-700" title={sid}>
                  {label(sid)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 担当者の追記。情報選択とサイドカラムの両方で使う */
function CustomContextEditor({ custom, setCustom }: {
  custom: CustomContext[];
  setCustom: (c: CustomContext[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<CustomContext>({ title: "", detail: "" });

  return (
    <div>
      {custom.map((c, i) => (
        <div key={i} className="rounded-[7px] border border-indigo-200 bg-indigo-50/50 px-2.5 py-1.5 mb-1.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-semibold text-slate-800">
                {c.title || `担当者の追記 ${i + 1}`}
              </div>
              <p className="text-[11px] text-slate-600 whitespace-pre-wrap mt-0.5">{c.detail}</p>
            </div>
            <button
              onClick={() => setCustom(custom.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-600 shrink-0"
              aria-label="追記を削除"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="rounded-[7px] border border-slate-200 px-2.5 py-2">
          <input
            value={draft.title}
            onChange={e => setDraft({ ...draft, title: e.target.value })}
            placeholder="見出し（例: 予算の状況）"
            className="w-full text-[11.5px] px-2 py-1 rounded-[6px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
          <textarea
            value={draft.detail}
            onChange={e => setDraft({ ...draft, detail: e.target.value })}
            placeholder="骨子に反映したい前提・事実を書いてください"
            rows={3}
            className="w-full mt-1.5 text-[11.5px] px-2 py-1 rounded-[6px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-y"
          />
          <div className="flex items-center gap-1.5 mt-1.5">
            <button
              onClick={() => {
                if (!draft.detail.trim()) return;
                setCustom([...custom, draft]);
                setDraft({ title: "", detail: "" });
                setAdding(false);
              }}
              disabled={!draft.detail.trim()}
              className="px-2.5 py-1 rounded-[6px] bg-slate-900 text-white text-[11.5px] font-bold disabled:opacity-40"
            >
              追加
            </button>
            <button
              onClick={() => { setAdding(false); setDraft({ title: "", detail: "" }); }}
              className="px-2.5 py-1 rounded-[6px] border border-slate-200 text-[11.5px] text-slate-600"
            >
              やめる
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[7px] border border-dashed border-slate-300 text-[11.5px] text-slate-500 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" />コンテキストを追加
        </button>
      )}
    </div>
  );
}

// ── サイド: コンテキスト ──────────────────────────────────────────────────────

function ContextPanel({
  context, checked, setChecked, custom, setCustom,
  instruction, setInstruction, busy, usedIds, unevaluated, label, onRegenerate, onRepick,
}: {
  context: EvidenceItem[];
  checked: Set<string>;
  setChecked: (s: Set<string>) => void;
  custom: CustomContext[];
  setCustom: (c: CustomContext[]) => void;
  instruction: string;
  setInstruction: (v: string) => void;
  busy: boolean;
  usedIds: string[] | null;
  unevaluated: Array<{ id: string; reason: string }>;
  label: (sid: string) => string;
  onRegenerate: () => void;
  /** 種別ごとのカルーセルに戻る */
  onRepick: () => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const used = usedIds ? new Set(usedIds) : null;
  // 生成後にチェックが変わったか（作り直しが必要かを示す）
  const dirty = used
    ? context.some(c => checked.has(c.id) !== used.has(c.id)) ||
      custom.some((_, i) => !used.has(`custom:${i + 1}`))
    : false;

  // **選択しているものを上に置く。** 外したカードが混ざると、
  // いま何を根拠にしているのかが読めない。
  const sorted = useMemo(() => {
    return [...context].sort((a, b) => {
      const ca = checked.has(a.id) ? 0 : 1, cb = checked.has(b.id) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const ka = KIND_ORDER.indexOf(a.kind), kb = KIND_ORDER.indexOf(b.kind);
      if (ka !== kb) return ka - kb;
      return (b.asOf ?? "").localeCompare(a.asOf ?? "");
    });
  }, [context, checked]);

  const usingCount = checked.size + custom.filter(c => c.detail.trim()).length;

  return (
    <Card className="px-4 py-3.5 lg:sticky lg:top-3">
      <div className="flex items-start gap-1.5">
        <h3 className="text-[12.5px] font-bold text-slate-900 flex-1">参考にした情報</h3>
        <InfoTip text="骨子の根拠に使った情報です。上が使用中、下が使っていないものです。チェックを変えて作り直すと反映されます。" />
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
        {usingCount}件を使用中 / 全{context.length}件
      </p>

      <button
        onClick={onRepick}
        className="w-full mt-2 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-[7px] border border-slate-200 text-[11.5px] text-slate-600 hover:bg-slate-50"
      >
        <Target className="w-3.5 h-3.5" />種別ごとに選び直す
      </button>

      <textarea
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        placeholder="作り直しの指示（任意）例: 更新確保を優先する前提で書いて"
        rows={2}
        className="w-full mt-2 text-[11.5px] px-2.5 py-1.5 rounded-[7px] border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-y"
      />

      <button
        onClick={onRegenerate}
        disabled={busy}
        className={`w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-bold disabled:opacity-50 ${
          dirty ? "bg-slate-900 text-white hover:bg-slate-700" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        {busy
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />書いています…</>
          : <><RefreshCw className="w-3.5 h-3.5" />この情報で作り直す</>}
      </button>
      {dirty && !busy && (
        <p className="text-[10.5px] text-amber-700 mt-1">選択が変わっています。作り直すと反映されます。</p>
      )}

      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <CustomContextEditor custom={custom} setCustom={setCustom} />
      </div>

      <div className="mt-3 space-y-1 max-h-[60vh] overflow-y-auto pr-0.5">
        {sorted.map((item, idx) => {
          const on = checked.has(item.id);
          const prevOn = idx > 0 ? checked.has(sorted[idx - 1].id) : true;
          const expanded = open.has(item.id);
          const long = item.detail.length > 110;
          const conf = CONFIDENCE_META[item.confidence];
          const wasUsed = used?.has(item.id) ?? false;

          return (
            <div key={item.id}>
              {/* 使用中と未使用の境目 */}
              {idx > 0 && prevOn && !on && (
                <div className="flex items-center gap-2 py-1.5">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] text-slate-400">使っていない情報</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}

              <div className={`rounded-[7px] border px-2.5 py-1.5 ${
                on ? "border-slate-300 bg-white" : "border-slate-100 bg-slate-50/60"
              }`}>
                <div className="flex items-start gap-1.5">
                  <button onClick={() => toggle(item.id)} className="shrink-0 mt-0.5" aria-label="この情報を使うか">
                    {on ? <CheckSquare className="w-3.5 h-3.5 text-slate-900" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`text-[11.5px] font-semibold leading-snug ${on ? "text-slate-900" : "text-slate-400"}`}>
                        {item.title}
                      </span>
                      <span className={`text-[9px] font-bold px-1 py-px rounded ${conf.chip}`} title={conf.hint}>
                        {conf.label}
                      </span>
                      {item.approximate && (
                        <span className="text-[9px] font-bold px-1 py-px rounded bg-slate-100 text-slate-500" title="近似で判定">≈</span>
                      )}
                      {used && !wasUsed && on && (
                        <span className="text-[9px] font-bold px-1 py-px rounded bg-amber-50 text-amber-700" title="この情報は前回の生成には使われていません">未反映</span>
                      )}
                    </div>
                    <p className={`text-[10.5px] mt-0.5 whitespace-pre-wrap leading-relaxed ${on ? "text-slate-600" : "text-slate-400"}`}>
                      {expanded || !long ? item.detail : `${item.detail.slice(0, 110)}…`}
                    </p>
                    {long && (
                      <button
                        onClick={() => {
                          const next = new Set(open);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          setOpen(next);
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5"
                      >
                        {expanded ? "折りたたむ" : "全文"}
                        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                    )}
                    {item.situationIds.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {item.situationIds.map(sid => (
                          <span key={sid} className="text-[9px] font-semibold px-1 py-px rounded bg-blue-50 text-blue-700" title={sid}>
                            {label(sid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {unevaluated.length > 0 && (
        <details className="mt-2.5 border-t border-slate-100 pt-2">
          <summary className="text-[10.5px] text-slate-500 cursor-pointer flex items-center gap-1">
            <Info className="w-3 h-3" />未取得の情報 {unevaluated.length}件
          </summary>
          <ul className="mt-1 space-y-0.5">
            {unevaluated.map(u => (
              <li key={u.id} className="text-[10px] text-slate-500">{u.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

/** サイドカラムでの種別の並び順（使用中グループ内の副次ソート） */
const KIND_ORDER = [
  "behavior", "readiness", "play", "renewal", "external", "manual",
  "usage", "communication", "profile",
];

// ── メイン: 骨子 ──────────────────────────────────────────────────────────────

function OutlineView({
  outline, busy, companyName, instruction,
  saveEnabled, saving, saveMsg, isSaved, onSave,
}: {
  outline: ProposalOutlineResponse;
  busy: boolean;
  companyName: string;
  instruction: string;
  saveEnabled: boolean;
  saving: boolean;
  saveMsg: string | null;
  isSaved: boolean;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const s = outline.executiveSummary;
  /** 空章は出さない。線の引き方（最後だけ引かない）に件数が要るので先に確定させる */
  const chapters = outline.chapters.filter(c => c.text.trim() || c.unsourced);

  /** 表示と .md で内容がずれないよう、変換は outline-markdown.ts に閉じている */
  function buildMarkdown(): { text: string; name: string } {
    const now = new Date();
    const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString().replace("T", " ").slice(0, 16);
    return {
      text: outlineToMarkdown({ outline, companyName, generatedAt: stamp, instruction }),
      name: outlineFileName(companyName, outline.intent.displayName, stamp),
    };
  }

  function downloadMd() {
    const { text, name } = buildMarkdown();
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    // revoke を即座に行うと Safari でダウンロードが落ちるため遅らせる
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // コピーも .md と同じ本文にする（貼り先で体裁が崩れない）
  const asText = useMemo(() => {
    const now = new Date();
    const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString().replace("T", " ").slice(0, 16);
    return outlineToMarkdown({ outline, companyName, generatedAt: stamp, instruction });
  }, [outline, companyName, instruction]);

  return (
    <div className={`space-y-2.5 ${busy ? "opacity-60" : ""}`}>
      {/* 警告は最上部 */}
      {outline.warnings.length > 0 && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-3.5 py-2.5">
          {outline.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11.5px] text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{w}
            </div>
          ))}
        </div>
      )}

      {/* Executive Summary — 提案全体の結論を先出し */}
      <div className="rounded-[6px] bg-[#2e5f7e] text-white px-5 py-4">
        <div className="flex items-start gap-2">
          <h2 className="text-[15px] font-bold leading-snug flex-1 min-w-0">{outline.title}</h2>
          <div className="flex items-center gap-1 shrink-0">
            {saveEnabled && (
              <button
                onClick={onSave}
                disabled={saving || busy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] bg-white/15 hover:bg-white/25 text-[11px] disabled:opacity-50"
              >
                {saving
                  ? <><Loader2 className="w-3 h-3 animate-spin" />保存中</>
                  : <><Save className="w-3 h-3" />{isSaved ? "記録を更新" : "記録に保存"}</>}
              </button>
            )}
            <button
              onClick={downloadMd}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] bg-white/15 hover:bg-white/25 text-[11px]"
            >
              <Download className="w-3 h-3" />.md
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(asText).then(() => {
                  setCopied(true); setTimeout(() => setCopied(false), 1800);
                });
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] bg-white/15 hover:bg-white/25 text-[11px]"
            >
              {copied ? <><Check className="w-3 h-3" />コピー済</> : <><Copy className="w-3 h-3" />コピー</>}
            </button>
          </div>
        </div>
        {saveMsg && <p className="text-[11px] text-white/80 mt-1.5">{saveMsg}</p>}

        {/* 状況→打ち手の4点。ラベルは小さく、中身を読ませる */}
        <dl className="mt-3.5 space-y-2.5">
          {([
            ["何が問題か", s.problem],
            ["何を目指すか", s.goal],
            ["何を提案するか", s.proposal],
            ["期待できる成果", s.outcome],
          ] as const).map(([k, v]) => v ? (
            <div key={k}>
              <dt className="text-[10px] font-bold tracking-wide text-white/50 uppercase">{k}</dt>
              <dd className="text-[13px] leading-[1.75] mt-0.5">{v}</dd>
            </div>
          ) : null)}
        </dl>

        {/* **唯一のアクション。** 4点と同じ書式に並べると埋もれるので切り離す */}
        {s.decision && (
          <div className="mt-4 pt-3.5 border-t border-white/20">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-white/70" />
              <span className="text-[10px] font-bold tracking-wide text-white/70 uppercase">次に決めてほしいこと</span>
            </div>
            <p className="text-[13.5px] font-semibold leading-[1.75] mt-1">{s.decision}</p>
          </div>
        )}
      </div>

      {/* ── 9章 ──────────────────────────────────────────────────────
          Context → Why Now → Goal → … は**1本の論理の流れ**。
          章ごとに独立したカードを並べると、9個の島に見えて繋がりが消える（実測で指摘あり）。
          番号バッジを縦線でつなぎ、上から下へ読む形にする。 */}
      <ol className="mt-4">
        {chapters.map((c, idx) => (
          <li key={c.key} className="relative pl-11 pb-7 last:pb-0">
            {/* 次の章へ続く線。最後の章では引かない */}
            {idx < chapters.length - 1 && (
              <span aria-hidden className="absolute left-[13.5px] top-8 bottom-0 w-px bg-slate-200" />
            )}
            <span className="absolute left-0 top-0 w-7 h-7 rounded-full bg-[#2e5f7e] text-white grid place-items-center text-[11.5px] font-bold tabular-nums">
              {c.no}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-[13.5px] font-bold text-slate-900">{c.label}</h3>
                <span className="text-[10.5px] font-semibold text-slate-400">{c.en}</span>
                {c.unsourced && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700"
                    title="顧客の事実を述べる章なのに、根拠となる情報が挙がっていません。そのまま使わないでください"
                  >
                    <AlertTriangle className="w-3 h-3" />根拠なし
                  </span>
                )}
              </div>

              {/* ここが読ませたい本文。いちばん大きく、行間も広く取る */}
              <p className="text-[13.5px] text-slate-800 leading-[1.9] mt-2 whitespace-pre-wrap">
                {c.text}
              </p>

              {/* 具体。本文より一段落とす */}
              {c.bullets.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {c.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-slate-600 leading-[1.75]">
                      <span aria-hidden className="mt-[7px] w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                      <span className="min-w-0">{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {c.assumptions.length > 0 && (
                <div className="mt-2.5 rounded-[7px] bg-amber-50/70 border border-amber-100 px-2.5 py-2">
                  <div className="text-[10px] font-bold text-amber-800">この章で置いた仮定</div>
                  <ul className="mt-1 space-y-1">
                    {c.assumptions.map((a, i) => (
                      <li key={i} className="text-[11.5px] text-amber-900/85 leading-relaxed flex gap-1.5">
                        <span aria-hidden className="text-amber-400 shrink-0">・</span><span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* **根拠は畳む。** 常時展開すると本文より目立ち、章の切れ目が消える */}
              {c.evidence.length > 0 && (
                <details className="mt-2.5 group">
                  <summary className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer select-none list-none">
                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    この章の根拠 {c.evidence.length}件
                  </summary>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.evidence.map(e => (
                      <span
                        key={e.id}
                        title={`${e.id}（${CONFIDENCE_META[e.confidence as EvidenceConfidence]?.label ?? e.confidence}）`}
                        className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                      >
                        {e.title}{e.asOf ? `・${e.asOf}` : ""}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* 触れない方がよいこと */}
      {outline.avoid.length > 0 && (
        <Card className="px-5 py-4">
          <h3 className="text-[12px] font-bold text-slate-700">触れない方がよいこと</h3>
          <ul className="mt-1 space-y-1">
            {outline.avoid.map((a, i) => (
              <li key={i} className="text-[11.5px] text-slate-700">
                <span className="text-amber-600">・</span>{a.text}
                <span className="text-slate-400"> — {a.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 材料不足 */}
      {outline.missingEvidence.length > 0 && (
        <Card className="px-5 py-4">
          <h3 className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
            材料が足りず書けなかったこと
            <InfoTip text="ここを埋めると骨子の精度が上がります。サイドカラムの「コンテキストを追加」で補って作り直してください。" />
          </h3>
          <ul className="mt-1 space-y-0.5">
            {outline.missingEvidence.map((m, i) => (
              <li key={i} className="text-[11.5px] text-slate-600"><span className="text-slate-300">・</span>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[10.5px] text-slate-400 px-1">
        生成: {outline.model}／{TYPE_META[outline.proposalType].label}
        {outline.frame ? `／語り口: ${outline.frame}` : ""}
        ／狙い: {outline.intent.displayName}
      </p>
    </div>
  );
}

// ─── 議事録から状況を拾う ──────────────────────────────────────────────────
//
// A（状況カタログ）の「手動（診断・登録）」の語彙は、誰かが登録しないと一件も立たない。
// だが実際には議事録に書かれている。LLM に拾わせて、**採用は人が押す**。
//
// ⚠️ 自動登録しない理由: 議事録948件の横断実測（2026-08-24）で、
//   「担当が変わると知見が引き継がれない」の大半が **Ptmind 側の説明文**だった
//   （「他のお客様からも伺う声」という枕）。自社のトークを顧客の状況として
//   登録すると、提案が「相手が言っていないこと」を根拠にし始める。
function SituationCandidates({ companyUid, onRegistered }: {
  companyUid: string;
  onRegistered: () => void;
}) {
  const [open, setOpen]       = useState(false);
  const [data, setData]       = useState<SituationCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState<string | null>(null);
  const [saved, setSaved]     = useState<Set<string>>(new Set());

  async function find() {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`/api/company/${companyUid}/situations`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setData(j as SituationCandidatesResponse);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function adopt(c: SituationCandidate) {
    setSaving(c.situationId);
    try {
      const r = await fetch(`/api/company/${companyUid}/situations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situationId: c.situationId,
          note: `${c.speaker ? `${c.speaker}: ` : ""}${c.quote}`,
          observedAt: c.observedAt,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
      setSaved(prev => new Set(prev).add(c.situationId));
      onRegistered();   // 狙いの並びが変わるので取り直す
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
        <h3 className="text-[13px] font-bold text-slate-800">議事録から状況を拾う</h3>
        <InfoTip text="組織・体制まわりの状況は自動では取れません。議事録から候補を出し、確認して登録すると上の並びが変わります。自社（Ptmind）の説明文は候補から除いています。" />
        <button onClick={find} disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] border border-slate-300 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {loading
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />議事録を読んでいます…</>
            : <><Sparkles className="w-3.5 h-3.5" />{data ? "もう一度探す" : "候補を探す"}</>}
        </button>
      </div>

      {!open && !loading && (
        <p className="text-[11.5px] text-slate-500 mt-1.5">
          「分析できる人がいない」「担当者単独では決裁できない」といった、
          利用ログには出ない状況を議事録から拾います。
        </p>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-[12px] text-red-600 mt-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {open && data && (
        <div className="mt-2.5">
          <p className="text-[11px] text-slate-400">
            議事録{data.minutesRead}件を読み、候補{data.candidates.length}件
            {data.droppedAsOurTalk > 0 && (
              <span title="「他のお客様からも伺う声」のような自社の説明文は、顧客の状況ではないので候補にしません">
                （自社の説明として除外 {data.droppedAsOurTalk}件）
              </span>
            )}
          </p>

          {data.candidates.length === 0 ? (
            <p className="text-[12px] text-slate-500 mt-2">
              {data.note || "議事録から拾える状況はありませんでした。"}
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.candidates.map(c => {
                const done = saved.has(c.situationId) || c.alreadyRegistered;
                return (
                  <li key={c.situationId} className="rounded-[8px] border border-slate-200 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] font-bold text-slate-800">{c.labelJa}</span>
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 tabular-nums">
                        確度 {Math.round(c.confidence * 100)}%
                      </span>
                      {c.speaker && (
                        <span className="text-[10px] text-slate-400">{c.speaker}</span>
                      )}
                      {c.observedAt && (
                        <span className="text-[10px] text-slate-400 tabular-nums">{c.observedAt}</span>
                      )}
                      <button
                        onClick={() => adopt(c)}
                        disabled={done || saving === c.situationId}
                        className={`ml-auto text-[11.5px] font-bold px-2.5 py-1 rounded-[6px] transition ${
                          done
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50"
                        }`}
                      >
                        {done ? "登録済み" : saving === c.situationId ? "登録中…" : "登録する"}
                      </button>
                    </div>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed mt-1 border-l-2 border-slate-200 pl-2">
                      「{c.quote}」
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {data.registered.length > 0 && (
            <p className="text-[10.5px] text-slate-400 mt-2">
              登録済み: {data.registered.map(r => r.labelJa).join("、")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
