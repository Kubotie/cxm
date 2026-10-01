"use client";

// ─── Twenty Ops 疎通画面（**PtAI Pipeline の移行用**）────────────────────────
//
// GET /api/ops/twenty/health と /api/ops/twenty/raw-diff を呼んで状態を出す。
// **API キー・Authorization・顧客名・商談名・Note 本文・生レスポンスは表示しない。**
// 表示するのは接続状態・件数・スキーマ検証・集計ベースの警告だけ。
// Salesforce Ops 画面（salesforce-ops.tsx）の構成に合わせている。
//
// ⚠️ この画面は `src/app/(cxm)/ops/twenty/` に置いてあるが、**CXM のデータ機能ではない。**
//    共通の管理 UI レイアウト（SidebarNav / GlobalHeader）を間借りしているだけで、
//    読むのは Twenty と PtAI Pipeline の移行元だけ。CXM のテーブルには触れない。

import { useState, useCallback, useEffect } from "react";
import { SidebarNav }   from "@/components/layout/sidebar-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { Button }       from "@/components/ui/button";
import { Badge }        from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Plug, Database, GitCompare, KeyRound, Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TwentyHealthResult } from "@/app/api/ops/twenty/health/route";
import type { RawDiffResult }      from "@/app/api/ops/twenty/raw-diff/route";


/* ── API キーの設定（admin / ops のみ）──────────────────────────────────────
   **キーそのものは画面に出さない。** 出すのは末尾 4 文字・更新者・更新日時だけ。
   保存先は PtAI 専用の ptai_settings（AES-256-GCM で暗号化）。 */
interface KeyStatus {
  stored: boolean; hint: string | null; updatedBy: string | null;
  updatedAt: string | null; envFallback: boolean; secretKeyReady: boolean;
  error?: string; message?: string;
}

function ApiKeyPanel({ onSaved }: { onSaved: () => void }) {
  const [st, setSt] = useState<KeyStatus | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/ops/ptai/twenty-key", { cache: "no-store" });
      setSt(await r.json());
    } catch { setSt(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/ops/ptai/twenty-key", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: value }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.message ?? "保存できませんでした"); }
      else { setSt(j); setValue(""); setMsg("保存しました"); onSaved(); }
    } catch { setMsg("保存できませんでした"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/ops/ptai/twenty-key", { method: "DELETE" });
      const j = await r.json();
      if (r.ok) { setSt(j); setMsg("削除しました。環境変数の値に戻ります"); onSaved(); }
      else setMsg(j.message ?? "削除できませんでした");
    } catch { setMsg("削除できませんでした"); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-[13px] font-bold mb-1 flex items-center gap-1.5">
        <KeyRound className="w-3.5 h-3.5 text-slate-500" /> Twenty API キー
      </h2>
      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
        PtAI 専用のテーブルに<strong>暗号化して</strong>保存します（共通認証の staff_identify には置きません）。
        <strong>保存後は画面から読み出せません。</strong>末尾や長さも表示しません。
        どのキーが入っているかは、下の疎通確認の結果で判断してください。忘れたら Twenty 側で再発行します。
      </p>

      {st && !st.secretKeyReady && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          暗号鍵（<span className="font-mono">PTAI_SECRET_KEY</span>）が未設定です。設定するまで保存できません。
        </div>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] mb-3">
        <dt className="text-slate-500">状態</dt>
        <dd>{st?.stored
          ? <span className="text-green-700">保存済み</span>
          : st?.envFallback
            ? <span className="text-slate-700">未保存（環境変数の値を使用中）</span>
            : <span className="text-red-700">未設定</span>}</dd>
        {st?.updatedBy && (<>
          <dt className="text-slate-500">更新</dt>
          <dd>{st.updatedBy}
            {st.updatedAt ? `（${new Date(st.updatedAt).toLocaleString("ja-JP")}）` : ""}</dd>
        </>)}
      </dl>

      <div className="flex gap-2 items-center">
        <Input type="password" autoComplete="off" value={value} placeholder="新しいキーを貼り付け"
          onChange={e => setValue(e.target.value)} className="max-w-md font-mono text-[12px]" />
        <Button size="sm" onClick={() => void save()}
          disabled={busy || value.trim().length < 20 || !st?.secretKeyReady}>保存</Button>
        {st?.stored && (
          <Button size="sm" variant="outline" onClick={() => void remove()} disabled={busy}>削除</Button>
        )}
      </div>
      {msg && <p className="mt-2 text-[12px] text-slate-600">{msg}</p>}
    </section>
  );
}

type Status = TwentyHealthResult["status"];

function StatusBanner({ status, baseUrl }: { status: Status; baseUrl: string }) {
  const map: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    ok:       { label: "接続 OK — Twenty から読み取れています",              cls: "bg-green-50 border-green-200 text-green-800", Icon: CheckCircle2 },
    degraded: { label: "一部取得できず — 接続はできていますが補助情報が欠けています", cls: "bg-amber-50 border-amber-200 text-amber-800", Icon: AlertTriangle },
    error:    { label: "接続エラー — Twenty から読み取れていません",            cls: "bg-red-50   border-red-200   text-red-800",   Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium flex items-start gap-2 ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-none" />
      <div>
        <div>{label}</div>
        {baseUrl && <div className="mt-0.5 font-mono text-[11px] opacity-70">{baseUrl}</div>}
      </div>
    </div>
  );
}

function CountCard({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value ?? "—"}</div>
        {note && <div className="mt-1 text-[10.5px] text-slate-500 leading-relaxed">{note}</div>}
      </CardContent>
    </Card>
  );
}

export function TwentyOpsPage() {
  const [health, setHealth]   = useState<TwentyHealthResult | null>(null);
  const [diff, setDiff]       = useState<RawDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const check = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/ops/twenty/health", { cache: "no-store", credentials: "same-origin" });
      if (res.status === 403) { setError("この画面の権限がありません（admin / ops のみ）"); return; }
      if (!res.ok)            { setError(`確認に失敗しました（HTTP ${res.status}）`); return; }
      setHealth(await res.json() as TwentyHealthResult);
    } catch {
      setError("確認に失敗しました（ネットワーク）");
    } finally { setLoading(false); }
  }, []);

  const runDiff = useCallback(async () => {
    setDiffLoading(true);
    try {
      const res = await fetch("/api/ops/twenty/raw-diff", { cache: "no-store", credentials: "same-origin" });
      if (res.ok) setDiff(await res.json() as RawDiffResult);
    } finally { setDiffLoading(false); }
  }, []);

  useEffect(() => { void check(); }, [check]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 min-w-0 flex flex-col">
        <GlobalHeader />
        <main className="flex-1 px-6 py-6 space-y-5 max-w-5xl">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Plug className="w-5 h-5 text-slate-500" />
                Twenty CRM 疎通確認
              </h1>
              <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
                Phase 1（読み取り専用）。<strong>PtAI Pipeline の業務データは Twenty を唯一の正本</strong>とし、
                ダッシュボードは Twenty を操作する UI です。
                <strong>対象は PtAI Pipeline のみで、CXM は引き続き NocoDB を利用します。</strong>
                この画面は共通の管理 UI レイアウトを使っているだけで、CXM のデータには触れていません。
                表示するのは件数と接続状態だけで、API キー・顧客名・商談名・議事録の本文は取得も表示もしていません。
              </p>
            </div>
            <Button onClick={() => void check()} disabled={loading} size="sm" variant="outline">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              再確認
            </Button>
          </header>

          <ApiKeyPanel onSaved={() => void check()} />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {health && (
            <>
              <StatusBanner status={health.status} baseUrl={health.resolvedBaseUrl} />
              <p className="text-[11px] text-slate-500">
                最終確認 <span className="font-mono">{new Date(health.checkedAt).toLocaleString("ja-JP")}</span>
              </p>

              <section>
                <h2 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-500" /> Pipeline の業務データ（test*）
                </h2>
                <p className="mb-2 text-[11px] text-slate-500">
                  ダッシュボードが実際に読み書きしているオブジェクトです。
                  取得元は <span className="font-mono">{health.dataSource}</span>
                  {health.dataSource === "legacy_nocodb" && "（まだ移行元の pga_docs を読んでいます）"}。
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <CountCard label="商談"           value={health.testCounts.opportunity} />
                  <CountCard label="アクション"       value={health.testCounts.action} note="ネクストアクション・サクセス Todo" />
                  <CountCard label="活動ログ"        value={health.testCounts.activity} />
                  <CountCard label="人物（組織図）"    value={health.testCounts.person} />
                  <CountCard label="サクセス計画"     value={health.testCounts.accountPlan} />
                  <CountCard label="コメント"        value={health.testCounts.comment} />
                  <CountCard label="操作ログ"        value={health.testCounts.operationLog} note="誰が何を変えたか" />
                  <CountCard
                    label="目標（Notion 正本）"
                    value={health.notionTargets.rows}
                    note={health.notionTargets.ok ? "チーム目標＋メンバー別目標" : (health.notionTargets.message ?? "読めていません")}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-500" /> Salesforce（商談・金額の正本）
                </h2>
                <Card>
                  <CardContent className="pt-4 text-[12px] leading-relaxed space-y-1.5">
                    <p>
                      PtAI の商談は<strong>商談名</strong>で見分けます
                      （<span className="font-mono">PtAI</span> /
                       <span className="font-mono"> Ptengine AI</span> /
                       <span className="font-mono"> PtengineAI</span>。大文字小文字は区別しません）。
                      Salesforce 側に PtAI 専用の製品カテゴリーも RecordType も無いためです。
                      <strong>金額と見積もりは Salesforce でしか入れられません</strong>
                      （<span className="font-mono">Opportunity.Amount</span> は作成不可・更新不可）。
                    </p>
                    {!health.salesforce.configured ? (
                      <p className="text-red-700">未接続です{health.salesforce.message ? `（${health.salesforce.message}）` : ''}</p>
                    ) : (
                      <>
                        <p className="tabular-nums">
                          PtAI 商談 <strong>{health.salesforce.ptaiOpportunities}</strong> 件
                          （未クローズ {health.salesforce.open} 件
                          {health.salesforce.withoutAccount > 0 && `／取引先未設定 ${health.salesforce.withoutAccount} 件`}）
                        </p>
                        {Object.keys(health.salesforce.byStage).length > 0 && (
                          <p className="text-slate-600">
                            {Object.entries(health.salesforce.byStage)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k, v]) => `${k} ${v}`).join('／')}
                          </p>
                        )}
                        {health.salesforce.message && (
                          <p className="text-slate-500">{health.salesforce.message}</p>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section>
                <h2 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" /> 操作者の記録
                </h2>
                <Card>
                  <CardContent className="pt-4 text-[12px] leading-relaxed space-y-1.5">
                    <p>
                      Twenty の <span className="font-mono">createdBy</span> は、API キー認証だと
                      <strong>キーに付けた名前</strong>が入り本人に紐付きません。
                      そこで <strong>CXM のログインで本人を特定し</strong>、作成時に
                      <span className="font-mono">workspaceMemberId</span> を明示しています。
                      更新時は Twenty が <span className="font-mono">updatedBy</span> を上書きするため、
                      自前の <span className="font-mono">updatedByName2</span> に残します。
                      <strong>メンバーごとの API キーは発行しません。</strong>
                    </p>
                    <p className="tabular-nums">
                      利用者 {health.identity.staff} 名のうち{" "}
                      <strong>{health.identity.linkedToTwenty} 名</strong>が Twenty の本人レコードに紐付きます
                      {health.identity.unlinked.length > 0 && (
                        <>（未紐付: {health.identity.unlinked.join("、")}）</>
                      )}
                      。
                    </p>
                  </CardContent>
                </Card>
              </section>

              <section>
                <details className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <summary className="text-[13px] font-bold cursor-pointer select-none">
                    参考: Twenty の既存オブジェクト（Pipeline は使っていません）
                  </summary>
                  <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                    Phase 1 で調べた既存の Company / Opportunity / Note です。
                    Pipeline は上の test* 側だけを読み書きするので、ここが空でも実害はありません。
                    既存 Opportunity へ書き戻す段階になったら、改めてこの数字を見ます。
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3 mt-3">
                    <CountCard label="Company（PtAI 対象）" value={health.counts.pgaCompanies} note="フィルタ適用後。全社は 5,000 件超" />
                    <CountCard label="Opportunity"   value={health.counts.opportunities} />
                    <CountCard label="Note"          value={health.counts.notes} note="Mii 由来" />
                    <CountCard label="ワークスペースメンバー" value={health.counts.workspaceMembers} />
                    <CountCard label="Task"          value={health.counts.tasks} note="運用実績なし" />
                    <CountCard label="noteTargets"   value={health.counts.noteTargets} note="Note との紐付け。カバー率が低い" />
                  </div>
                  {health.legacyNotes.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {health.legacyNotes.map((w, i) => (
                        <li key={i} className="text-[11.5px] leading-relaxed text-slate-600 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          {w}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </section>

              <section>
                <h2 className="text-[13px] font-bold mb-2">既存オブジェクトのスキーマ確認（参考）</h2>
                <div className="flex gap-2">
                  <Badge variant="outline" className={health.schema.companyFieldsVerified
                    ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}>
                    Company {health.schema.companyFieldsVerified ? "OK" : "不一致"}
                  </Badge>
                  <Badge variant="outline" className={health.schema.opportunityFieldsVerified
                    ? "bg-green-100 text-green-700 border-green-300" : "bg-red-100 text-red-700 border-red-300"}>
                    Opportunity {health.schema.opportunityFieldsVerified ? "OK" : "不一致"}
                  </Badge>
                </div>
              </section>

              {health.warnings.length > 0 && (
                <section>
                  <h2 className="text-[13px] font-bold mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> 対処が要ること（集計のみ）
                  </h2>
                  <ul className="space-y-1.5">
                    {health.warnings.map((w, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-slate-700 rounded border border-amber-200 bg-amber-50/60 px-3 py-2">
                        {w}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <section>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[13px] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5 text-slate-500" /> 移行元スナップショット（Pipeline の pga_docs/_raw）との差分（移行確認用・一時）
                  </span>
                  <Button onClick={() => void runDiff()} disabled={diffLoading} size="sm" variant="outline">
                    {diffLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                    集計する
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!diff && <p className="text-[12px] text-slate-500">件数だけを数えます。取り込みも保存も行いません。移行が済んだらこのパネルごと削除します。</p>}
                {diff && (
                  <div className="space-y-3 text-[12px]">
                    <div>
                      <div className="font-bold mb-1">企業</div>
                      <table className="w-full text-[11.5px]">
                        <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums">
                          <tr><td>Twenty（PtAI 対象）</td><td>{diff.companies.twenty}</td></tr>
                          <tr><td>移行元スナップショット</td><td>{diff.companies.raw}</td></tr>
                          <tr><td>ID で一致</td><td>{diff.companies.matchedById}</td></tr>
                          <tr><td>Twenty にのみ存在</td><td>{diff.companies.onlyInTwenty}</td></tr>
                          <tr><td>移行元にのみ存在</td><td>{diff.companies.onlyInRaw}</td></tr>
                          <tr><td>社名フォールバックで一致</td><td>{diff.companies.matchedByNameFallback}</td></tr>
                          <tr><td>どちらでも一致しない</td><td>{diff.companies.unmatched}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Opportunity の紐付け方法</div>
                      <table className="w-full text-[11.5px]">
                        <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums">
                          <tr><td>合計</td><td>{diff.opportunities.total}</td></tr>
                          <tr><td>リレーション</td><td>{diff.opportunities.linkedByRelation}</td></tr>
                          <tr><td>社名（完全一致）</td><td>{diff.opportunities.linkedByExactName}</td></tr>
                          <tr><td>社名（部分一致）</td><td>{diff.opportunities.linkedByPartialName}</td></tr>
                          <tr><td>紐付かない</td><td>{diff.opportunities.unlinked}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div>
                      <div className="font-bold mb-1">Note の紐付け方法</div>
                      <table className="w-full text-[11.5px]">
                        <tbody className="[&_td]:py-0.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums">
                          <tr><td>合計</td><td>{diff.notes.total}</td></tr>
                          <tr><td>noteTargets</td><td>{diff.notes.linkedByNoteTargets}</td></tr>
                          <tr><td>タイトル照合</td><td>{diff.notes.linkedByTitle}</td></tr>
                          <tr><td>紐付かない</td><td>{diff.notes.unlinked}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    {diff.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-slate-600 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">{w}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
