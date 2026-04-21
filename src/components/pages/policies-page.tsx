"use client";

// ─── Policies & Rules 管理画面 ─────────────────────────────────────────────────
//
// ── タブ ──────────────────────────────────────────────────────────────────────
//   アラートポリシー  / サマリーポリシー
//
// ── ポリシー作成モード ──────────────────────────────────────────────────────
//   テンプレートから / フォームで作成 / 自然言語から（AI）
//
// ── 永続化 ───────────────────────────────────────────────────────────────────
//   NOCODB_POLICIES_TABLE_ID 設定済み → API 経由で NocoDB に保存
//   未設定の場合はバナーを表示し in-memory で動作（ページ離脱で消える）

import { useState, useEffect, useCallback } from "react";
import { SidebarNav }      from "@/components/layout/sidebar-nav";
import { GlobalHeader }    from "@/components/layout/global-header";
import { Button }          from "@/components/ui/button";
import { Badge }           from "@/components/ui/badge";
import { Input }           from "@/components/ui/input";
import { Textarea }        from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Copy, SlidersHorizontal, Sparkles,
  Play, Pause, Trash2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, CheckCircle, Eye, X, Info,
  FileText, Database, TrendingUp, Target,
} from "lucide-react";
import {
  ALERT_POLICY_TEMPLATES,
  SUMMARY_POLICY_TEMPLATES,
  ALERT_CONDITION_FIELDS,
} from "@/lib/policy/templates";
import type {
  AlertPolicy,
  SummaryPolicy,
  PolicyStatus,
  AlertObjectType,
  AlertSignalCategory,
  AlertScope,
  StructuredCondition,
  NlParseResponse,
  PolicyTemplate,
  PolicyPreviewResponse,
} from "@/lib/policy/types";
import type { AppPolicy, PolicyWritePayload } from "@/lib/nocodb/policy-store";

// ── 型 ───────────────────────────────────────────────────────────────────────

type CreationMode = "template" | "form" | "nl";

interface DraftAlertPolicy {
  name:                  string;
  description:           string;
  object_type:           AlertObjectType;
  signal_category:       AlertSignalCategory;
  scope:                 AlertScope;
  condition_logic:       "AND" | "OR";
  interpretation_mode:   AlertPolicy["interpretation_mode"];
  structured_conditions: StructuredCondition[];
  nl_condition:          string;
  ai_hint:               string;
  output: {
    severity:           string;
    title:              string;
    description:        string;
    recommended_action: string;
    category_tag:       string;
  };
}

function emptyDraft(): DraftAlertPolicy {
  return {
    name: "", description: "",
    object_type: "company", signal_category: "risk",
    scope: "per_entity", condition_logic: "AND",
    interpretation_mode: "structured_only",
    structured_conditions: [], nl_condition: "", ai_hint: "",
    output: { severity: "medium", title: "", description: "", recommended_action: "", category_tag: "" },
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetchPolicies(type: "alert" | "summary"): Promise<{ items: AppPolicy[]; warning?: string }> {
  const res = await fetch(`/api/ops/policies?type=${type}`);
  if (!res.ok) throw new Error(`ポリシー取得エラー (${res.status})`);
  return res.json();
}

async function apiCreatePolicy(payload: Partial<PolicyWritePayload>): Promise<AppPolicy> {
  const res = await fetch("/api/ops/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "作成エラー");
  return data as AppPolicy;
}

async function apiPatchPolicy(policyId: string, patch: object): Promise<void> {
  const res = await fetch(`/api/ops/policies/${policyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "更新エラー");
  }
}

async function apiDeletePolicy(policyId: string): Promise<void> {
  const res = await fetch(`/api/ops/policies/${policyId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("削除エラー");
}

async function apiPreview(policy: Partial<AlertPolicy>): Promise<PolicyPreviewResponse> {
  const res = await fetch("/api/ops/policies/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policy, limit: 200 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "プレビューエラー");
  return data as PolicyPreviewResponse;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PolicyStatus }) {
  if (status === "active")  return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Active</Badge>;
  if (status === "paused")  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Paused</Badge>;
  return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Draft</Badge>;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
  info:     "bg-slate-100 text-slate-600 border-slate-200",
};

function SeverityBadge({ severity }: { severity: string }) {
  return <Badge className={`text-[10px] ${SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info}`}>{severity}</Badge>;
}

// ── Preview Sheet ─────────────────────────────────────────────────────────────

function PreviewSheet({
  open,
  onClose,
  policy,
}: {
  open:    boolean;
  onClose: () => void;
  policy:  Partial<AlertPolicy> | null;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PolicyPreviewResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open || !policy) return;
    setLoading(true);
    setResult(null);
    setError(null);
    apiPreview(policy)
      .then(r => setResult(r))
      .catch(e => setError(e.message ?? "エラーが発生しました"))
      .finally(() => setLoading(false));
  }, [open, policy]);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle>プレビュー / Impact</SheetTitle>
          <SheetDescription>
            このポリシーが現在のデータに対してどう影響するかを確認します（保存は行いません）
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* サマリー統計 */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "ヒット", value: result.hit_count, sub: `/ ${result.total_evaluated}件評価`, color: "text-slate-900" },
                  { label: "マッチ率", value: `${result.match_rate_pct}%`, sub: "", color: result.match_rate_pct > 50 ? "text-amber-600" : "text-slate-900" },
                  { label: "新規アラート", value: result.new_alerts_count, sub: "見込み", color: "text-violet-700" },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
                    {s.sub && <p className="text-[10px] text-slate-400">{s.sub}</p>}
                  </div>
                ))}
              </div>

              {/* 差分バッジ */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+{result.new_alerts_count} 新規生成</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-500">
                  <span>-{result.removed_alerts_count} 解除</span>
                </div>
                <div className="text-[10px] text-slate-400 self-center ml-auto">
                  {new Date(result.preview_at).toLocaleString("ja-JP")}
                </div>
              </div>

              {/* top_hits テーブル */}
              {result.top_hits.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    ヒット企業 (上位{result.top_hits.length}件)
                  </p>
                  <div className="rounded-md border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-xs py-2">企業名</TableHead>
                          <TableHead className="text-xs py-2">重要度</TableHead>
                          <TableHead className="text-xs py-2">マッチ根拠</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.top_hits.map(hit => (
                          <TableRow key={hit.entity_id} className="text-xs">
                            <TableCell className="py-2 font-medium">{hit.entity_name}</TableCell>
                            <TableCell className="py-2"><SeverityBadge severity={hit.would_severity} /></TableCell>
                            <TableCell className="py-2">
                              <ul className="space-y-0.5">
                                {hit.match_reason.map((r, i) => (
                                  <li key={i} className="text-slate-600 text-[11px] leading-snug">{r}</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Target className="w-8 h-8 text-slate-300" />
                  <p className="text-sm text-slate-500">ヒットなし</p>
                  <p className="text-xs text-slate-400">条件を緩和するか、フィールド・演算子を確認してください</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Alert Policy Card ─────────────────────────────────────────────────────────

function AlertPolicyCard({
  policy,
  isTemplate,
  onToggleStatus,
  onDelete,
  onPreview,
  expanded,
  onExpand,
}: {
  policy:          Partial<AlertPolicy> & { id: string; name: string };
  isTemplate?:     boolean;
  onToggleStatus?: () => void;
  onDelete?:       () => void;
  onPreview?:      () => void;
  expanded?:       boolean;
  onExpand?:       () => void;
}) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-slate-900 truncate">{policy.name}</span>
              {policy.status && <StatusBadge status={policy.status} />}
              {isTemplate && <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">テンプレート</Badge>}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {policy.object_type    && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.object_type}</Badge>}
              {policy.signal_category && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.signal_category}</Badge>}
              {policy.scope          && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.scope}</Badge>}
              {policy.output?.severity && <SeverityBadge severity={policy.output.severity} />}
            </div>
            {(policy as AlertPolicy).description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{(policy as AlertPolicy).description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={onPreview}>
              <Eye className="w-3 h-3" />プレビュー
            </Button>
            {!isTemplate && onToggleStatus && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggleStatus}>
                {policy.status === "active"
                  ? <Pause className="w-3.5 h-3.5 text-amber-600" />
                  : <Play  className="w-3.5 h-3.5 text-green-600" />}
              </Button>
            )}
            {!isTemplate && onDelete && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onExpand}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          {(policy.structured_conditions?.length ?? 0) > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1.5">条件</p>
              <div className="space-y-1">
                {policy.structured_conditions!.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                    {i > 0 && <span className="text-[10px] font-semibold text-slate-400 w-6 text-right">{policy.condition_logic}</span>}
                    {i === 0 && <span className="w-6" />}
                    <code className="bg-slate-100 rounded px-1 py-px text-[11px]">{c.field}</code>
                    <span className="text-slate-400">{c.operator}</span>
                    <code className="bg-slate-100 rounded px-1 py-px text-[11px]">{String(c.value)}</code>
                    {c.label && <span className="text-slate-500">— {c.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {policy.output && (
            <div className="bg-slate-50 rounded-md p-3 text-xs space-y-1.5">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">出力</p>
              <p className="text-slate-700"><span className="font-medium">タイトル:</span> {policy.output.title}</p>
              <p className="text-slate-700"><span className="font-medium">説明:</span> {policy.output.description}</p>
              {policy.output.recommended_action && (
                <p className="text-slate-700"><span className="font-medium">推奨:</span> {policy.output.recommended_action}</p>
              )}
            </div>
          )}
          {(policy as AlertPolicy).ai_hint && (
            <div className="mt-2 flex gap-1.5 items-start">
              <Info className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-600">{(policy as AlertPolicy).ai_hint}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Template Picker ───────────────────────────────────────────────────────────

function TemplatePicker({ templates, onSelect }: { templates: PolicyTemplate[]; onSelect: (t: PolicyTemplate) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map(t => (
        <button key={t.id} className="text-left p-3 rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors" onClick={() => onSelect(t)}>
          <div className="flex items-start gap-2">
            <span className="text-lg leading-none">{t.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 leading-tight">{t.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Condition Builder ─────────────────────────────────────────────────────────

function ConditionBuilder({ conditions, objectType, onChange }: {
  conditions: StructuredCondition[];
  objectType: AlertObjectType;
  onChange: (c: StructuredCondition[]) => void;
}) {
  const availableFields = Object.entries(ALERT_CONDITION_FIELDS).filter(([, v]) => v.objectTypes.includes(objectType));

  function add() {
    onChange([...conditions, { id: `c${Date.now()}`, field: availableFields[0]?.[0] ?? "", operator: "gte", value: 0, label: "" }]);
  }
  function update(idx: number, patch: Partial<StructuredCondition>) {
    onChange(conditions.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }
  function remove(idx: number) { onChange(conditions.filter((_, i) => i !== idx)); }

  return (
    <div className="space-y-2">
      {conditions.map((c, i) => (
        <div key={c.id} className="flex gap-2 items-center">
          <Select value={c.field} onValueChange={v => update(i, { field: v })}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableFields.map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={c.operator} onValueChange={v => update(i, { operator: v as StructuredCondition["operator"] })}>
            <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["gt","gte","lt","lte","eq","neq"].map(op => <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="h-8 text-xs w-20" value={String(c.value ?? "")}
            onChange={e => { const n = parseFloat(e.target.value); update(i, { value: isNaN(n) ? e.target.value : n }); }} />
          <Input className="h-8 text-xs flex-1" placeholder="ラベル" value={c.label ?? ""}
            onChange={e => update(i, { label: e.target.value })} />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => remove(i)}>
            <X className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs border-dashed" onClick={add} disabled={availableFields.length === 0}>
        <Plus className="w-3 h-3 mr-1" />条件を追加
      </Button>
    </div>
  );
}

// ── NL Parse Panel ────────────────────────────────────────────────────────────

function NlParsePanel({ objectType, signalCategory, onApply }: {
  objectType:      AlertObjectType;
  signalCategory:  AlertSignalCategory;
  onApply:         (r: NlParseResponse) => void;
}) {
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<NlParseResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function parse() {
    if (!input.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/ops/policies/nl-parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nl_input: input, object_type: objectType, signal_category: signalCategory }),
      });
      const data = await res.json();
      res.ok ? setResult(data) : setError(data.error ?? "解析エラー");
    } catch { setError("ネットワークエラー"); }
    finally { setLoading(false); }
  }

  const confColor = result?.confidence === "high" ? "text-green-600" : result?.confidence === "medium" ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">アラートの意図を自然言語で入力</label>
        <Textarea rows={3} className="text-sm resize-none" placeholder="例: 45日以上連絡のない会社を high リスクとしてアラートを出す"
          value={input} onChange={e => setInput(e.target.value)} />
      </div>
      <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={parse} disabled={loading || !input.trim()}>
        {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />解析中...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />AI で解析</>}
      </Button>
      {error && <div className="flex gap-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{error}</div>}
      {result && (
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">解析結果</p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${confColor}`}>信頼度: {result.confidence}</span>
              <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white px-2" onClick={() => onApply(result)}>
                <CheckCircle className="w-3 h-3 mr-1" />適用
              </Button>
            </div>
          </div>
          {result.interpretation_note && <p className="text-[11px] text-slate-500 italic">{result.interpretation_note}</p>}
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">条件 ({result.condition_logic})</p>
            {result.proposed_conditions.map(c => (
              <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                <code className="bg-white border border-slate-200 rounded px-1 py-px text-[11px]">{c.field}</code>
                <span className="text-slate-400">{c.operator}</span>
                <code className="bg-white border border-slate-200 rounded px-1 py-px text-[11px]">{String(c.value)}</code>
                {c.label && <span className="text-slate-500">— {c.label}</span>}
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded p-2 space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={result.proposed_output.severity} />
              <span className="text-slate-700 font-medium">{result.proposed_output.title}</span>
            </div>
            <p className="text-slate-600">{result.proposed_output.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Dialog ─────────────────────────────────────────────────────────────

function CreateAlertPolicyDialog({ open, onClose, onCreated, saving }: {
  open:      boolean;
  onClose:   () => void;
  onCreated: (draft: DraftAlertPolicy) => void;
  saving:    boolean;
}) {
  const [mode, setMode]               = useState<CreationMode>("template");
  const [draft, setDraft]             = useState<DraftAlertPolicy>(emptyDraft());
  const [templateApplied, setTemplateApplied] = useState(false);

  function handleTemplateSelect(t: PolicyTemplate) {
    const p = t.policy as Partial<AlertPolicy>;
    setDraft({
      name: t.name, description: t.description,
      object_type: p.object_type ?? "company",
      signal_category: p.signal_category ?? "risk",
      scope: p.scope ?? "per_entity",
      condition_logic: p.condition_logic ?? "AND",
      interpretation_mode: p.interpretation_mode ?? "structured_only",
      structured_conditions: p.structured_conditions ?? [],
      nl_condition: "", ai_hint: p.ai_hint ?? "",
      output: {
        severity:           p.output?.severity           ?? "medium",
        title:              p.output?.title              ?? "",
        description:        p.output?.description        ?? "",
        recommended_action: p.output?.recommended_action ?? "",
        category_tag:       p.output?.category_tag       ?? "",
      },
    });
    setTemplateApplied(true);
    setMode("form");
  }

  function handleNlApply(r: NlParseResponse) {
    setDraft(d => ({
      ...d,
      structured_conditions: r.proposed_conditions,
      condition_logic: r.condition_logic,
      output: { ...d.output, severity: r.proposed_output.severity, title: r.proposed_output.title, description: r.proposed_output.description, recommended_action: r.proposed_output.recommended_action, category_tag: r.proposed_output.category_tag },
    }));
    setMode("form");
  }

  function handleClose() {
    setDraft(emptyDraft()); setMode("template"); setTemplateApplied(false); onClose();
  }

  const patchOutput = useCallback((p: Partial<DraftAlertPolicy["output"]>) => {
    setDraft(d => ({ ...d, output: { ...d.output, ...p } }));
  }, []);

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>アラートポリシーを作成</DialogTitle>
          <DialogDescription>3つのモードからポリシーを定義できます</DialogDescription>
        </DialogHeader>

        {/* Mode selector */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg flex-shrink-0">
          {([
            { id: "template", icon: Copy,              label: "テンプレートから" },
            { id: "nl",       icon: Sparkles,           label: "自然言語から" },
            { id: "form",     icon: SlidersHorizontal,  label: "フォームで作成" },
          ] as { id: CreationMode; icon: React.ComponentType<{ className?: string }>; label: string }[]).map(m => {
            const Icon = m.icon;
            return (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === m.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Icon className="w-3.5 h-3.5" />{m.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4 py-1">
            {mode === "template" && (
              <div>
                <p className="text-xs text-slate-500 mb-2">テンプレートを選択すると条件が自動入力されます。</p>
                <TemplatePicker templates={ALERT_POLICY_TEMPLATES} onSelect={handleTemplateSelect} />
              </div>
            )}
            {mode === "nl" && (
              <div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">対象タイプ</label>
                    <Select value={draft.object_type} onValueChange={v => setDraft(d => ({ ...d, object_type: v as AlertObjectType }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["company","support_case","support_queue"].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">シグナル分類</label>
                    <Select value={draft.signal_category} onValueChange={v => setDraft(d => ({ ...d, signal_category: v as AlertSignalCategory }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="risk" className="text-xs">risk</SelectItem>
                        <SelectItem value="opportunity" className="text-xs">opportunity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <NlParsePanel objectType={draft.object_type} signalCategory={draft.signal_category} onApply={handleNlApply} />
              </div>
            )}
            {mode === "form" && (
              <div className="space-y-4">
                {templateApplied && (
                  <div className="flex items-center gap-2 p-2 bg-violet-50 border border-violet-200 rounded-md text-xs text-violet-700">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />テンプレートから初期値が入力されました。
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-1">ポリシー名 *</label>
                    <Input className="h-8 text-sm" placeholder="例: チャーンリスク検出" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-slate-600 block mb-1">説明</label>
                    <Input className="h-8 text-sm" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
                  </div>
                  {[
                    { label: "対象タイプ", key: "object_type", options: ["company","support_case","support_queue"] },
                    { label: "シグナル分類", key: "signal_category", options: ["risk","opportunity"] },
                    { label: "スコープ", key: "scope", options: ["per_entity","aggregate"] },
                    { label: "条件結合", key: "condition_logic", options: ["AND","OR"] },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-medium text-slate-600 block mb-1">{f.label}</label>
                      <Select value={String((draft as unknown as Record<string, string>)[f.key])} onValueChange={v => setDraft(d => ({ ...d, [f.key]: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{f.options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">構造化条件</label>
                  <ConditionBuilder conditions={draft.structured_conditions} objectType={draft.object_type}
                    onChange={c => setDraft(d => ({ ...d, structured_conditions: c }))} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">出力設定</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">重要度</label>
                      <Select value={draft.output.severity} onValueChange={v => patchOutput({ severity: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["critical","high","medium","low","info"].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">カテゴリタグ</label>
                      <Input className="h-8 text-xs" placeholder="churn_risk" value={draft.output.category_tag} onChange={e => patchOutput({ category_tag: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 block mb-1">タイトルテンプレート</label>
                      <Input className="h-8 text-sm" placeholder="{{company_name}} のリスク" value={draft.output.title} onChange={e => patchOutput({ title: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 block mb-1">説明テンプレート</label>
                      <Textarea rows={2} className="text-xs resize-none" value={draft.output.description} onChange={e => patchOutput({ description: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 block mb-1">推奨アクション</label>
                      <Input className="h-8 text-sm" value={draft.output.recommended_action} onChange={e => patchOutput({ recommended_action: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">AI ヒント（任意）</label>
                  <Input className="h-8 text-sm" value={draft.ai_hint} onChange={e => setDraft(d => ({ ...d, ai_hint: e.target.value }))} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>キャンセル</Button>
          {mode !== "template" && (
            <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => onCreated(draft)} disabled={!draft.name.trim() || saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />保存中...</> : <><FileText className="w-3.5 h-3.5 mr-1.5" />Draft として作成</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Summary Policy Card ───────────────────────────────────────────────────────

function SummaryPolicyCard({ policy, expanded, onExpand }: {
  policy:    Partial<SummaryPolicy> & { id: string; name: string; description?: string; _isTemplate?: boolean };
  expanded?: boolean;
  onExpand?: () => void;
}) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="py-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-slate-900">{policy.name}</span>
              {policy._isTemplate && <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">テンプレート</Badge>}
              {policy.status && <StatusBadge status={policy.status} />}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {policy.target              && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.target}</Badge>}
              {policy.generation_trigger  && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.generation_trigger}</Badge>}
              {policy.approval_rule       && <Badge variant="outline" className="text-[10px] text-slate-500">{policy.approval_rule}</Badge>}
            </div>
            {policy.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{policy.description}</p>}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={onExpand}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          <div className="space-y-2.5 text-xs">
            {policy.summary_focus && (
              <div><p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">フォーカス</p><p className="text-slate-700">{policy.summary_focus}</p></div>
            )}
            {(policy.output_schema?.length ?? 0) > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">出力スキーマ</p>
                <div className="space-y-1">
                  {policy.output_schema!.map(f => (
                    <div key={f.key} className="flex items-center gap-1.5">
                      <code className="bg-slate-100 rounded px-1 py-px text-[11px]">{f.key}</code>
                      <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                      {f.required && <Badge className="bg-blue-50 text-blue-600 border-blue-200 text-[10px]">required</Badge>}
                      {f.max_length && <span className="text-slate-400">max:{f.max_length}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {policy.freshness_rule && (
              <div className="bg-slate-50 rounded p-2">
                <p className="text-[11px] font-medium text-slate-500 mb-1">フレッシュネスルール</p>
                <p className="text-slate-700">
                  {policy.freshness_rule.stale_after_days}日後に stale
                  {policy.freshness_rule.auto_regenerate_on_stale && " / stale 時に自動再生成"}
                  {policy.freshness_rule.force_on_critical_alert && " / critical アラート時即時再生成"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function PoliciesPage() {
  // ── API-backed policies state ─────────────────────────────────────────────
  const [alertPolicies,   setAlertPolicies]   = useState<AppPolicy[]>([]);
  const [loadingList,     setLoadingList]      = useState(true);
  const [listError,       setListError]        = useState<string | null>(null);
  const [persistWarning,  setPersistWarning]   = useState<string | null>(null);
  const [savingNew,       setSavingNew]        = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());
  const [createOpen,   setCreateOpen]   = useState(false);
  const [previewPolicy, setPreviewPolicy] = useState<Partial<AlertPolicy> | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingList(true);
    apiFetchPolicies("alert")
      .then(({ items, warning }) => {
        setAlertPolicies(items);
        if (warning) setPersistWarning(warning);
      })
      .catch(e => setListError(e.message))
      .finally(() => setLoadingList(false));
  }, []);

  // ── Toggle expand ─────────────────────────────────────────────────────────
  function toggleExpand(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(draft: DraftAlertPolicy) {
    setSavingNew(true);
    const now     = new Date().toISOString();
    const payload: Partial<PolicyWritePayload> = {
      policy_type:          "alert",
      name:                 draft.name,
      description:          draft.description || undefined,
      status:               "draft",
      version:              1,
      object_type:          draft.object_type,
      signal_category:      draft.signal_category,
      scope:                draft.scope,
      condition_logic:      draft.condition_logic,
      interpretation_mode:  draft.interpretation_mode,
      structured_conditions: JSON.stringify(draft.structured_conditions),
      nl_condition:         draft.nl_condition || undefined,
      ai_hint:              draft.ai_hint      || undefined,
      output:               JSON.stringify(draft.output),
      created_at:           now,
      updated_at:           now,
    };

    try {
      const created = await apiCreatePolicy(payload);
      setAlertPolicies(prev => [created, ...prev]);
      setCreateOpen(false);
    } catch (e) {
      // TABLE 未設定の場合は in-memory フォールバック
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('NOCODB_POLICIES_TABLE_ID')) {
        const localPolicy: AppPolicy = {
          rowId:     Date.now(),
          policyId:  `pol_${Date.now()}`,
          policyType: "alert",
          name:      draft.name,
          description: draft.description,
          status:    "draft",
          version:   1,
          createdAt: now,
          updatedAt: now,
          alertPolicy: {
            id: `pol_${Date.now()}`, name: draft.name, description: draft.description,
            status: "draft", version: 1, created_at: now, updated_at: now,
            object_type: draft.object_type, signal_category: draft.signal_category,
            scope: draft.scope, condition_logic: draft.condition_logic,
            interpretation_mode: draft.interpretation_mode,
            structured_conditions: draft.structured_conditions,
            nl_condition: draft.nl_condition || undefined,
            ai_hint: draft.ai_hint || undefined,
            output: draft.output as AlertPolicy["output"],
          },
        };
        setAlertPolicies(prev => [localPolicy, ...prev]);
        setCreateOpen(false);
      } else {
        alert(`作成エラー: ${msg}`);
      }
    } finally {
      setSavingNew(false);
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────
  async function handleToggleStatus(policy: AppPolicy) {
    const nextStatus = policy.status === "active" ? "paused" : "active";
    // Optimistic update
    setAlertPolicies(prev => prev.map(p => p.policyId === policy.policyId ? { ...p, status: nextStatus } : p));
    try {
      await apiPatchPolicy(policy.policyId, { status: nextStatus });
    } catch {
      // Revert on error
      setAlertPolicies(prev => prev.map(p => p.policyId === policy.policyId ? { ...p, status: policy.status } : p));
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(policy: AppPolicy) {
    setAlertPolicies(prev => prev.filter(p => p.policyId !== policy.policyId));
    try {
      await apiDeletePolicy(policy.policyId);
    } catch {
      // Revert
      setAlertPolicies(prev => [policy, ...prev]);
    }
  }

  // ── Template items ────────────────────────────────────────────────────────
  const templateAlertPolicies = ALERT_POLICY_TEMPLATES.map(t => ({
    ...(t.policy as Partial<AlertPolicy>),
    id: t.id, name: t.name, description: t.description,
    status: "draft" as PolicyStatus, version: 1, created_at: "", updated_at: "",
    structured_conditions: (t.policy as Partial<AlertPolicy>).structured_conditions ?? [],
    output: (t.policy as Partial<AlertPolicy>).output ?? { severity: "medium" as const, title: "", description: "" },
  }));

  const templateSummaryPolicies = SUMMARY_POLICY_TEMPLATES.map(t => ({
    ...t.policy, id: t.id, name: t.name, description: t.description, _isTemplate: true,
  }));

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <GlobalHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6">

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Policies & Rules</h2>
              <p className="text-sm text-slate-500 mt-0.5">アラート生成条件・AI サマリーポリシーを管理します</p>
            </div>

            {/* 永続化未設定バナー */}
            {persistWarning && (
              <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
                <Database className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">In-memory モードで動作中</p>
                  <p className="mt-0.5 text-amber-600">NOCODB_POLICIES_TABLE_ID が未設定のため、変更はページ再読み込みで消えます。NocoDB に `policies` テーブルを作成後、環境変数を設定してください。</p>
                </div>
              </div>
            )}

            <Tabs defaultValue="alert">
              <TabsList className="mb-4">
                <TabsTrigger value="alert" className="text-sm">
                  アラートポリシー
                  <Badge className="ml-1.5 bg-slate-200 text-slate-700 text-[10px]">{alertPolicies.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="summary" className="text-sm">サマリーポリシー</TabsTrigger>
              </TabsList>

              {/* ── Alert tab ── */}
              <TabsContent value="alert">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500">
                    {alertPolicies.length > 0
                      ? `${alertPolicies.filter(p => p.status === "active").length} / ${alertPolicies.length} アクティブ`
                      : "ユーザー定義ポリシーなし"}
                  </p>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800" onClick={() => setCreateOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />新規作成
                  </Button>
                </div>

                {loadingList && <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
                {listError && (
                  <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 mb-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{listError}
                  </div>
                )}

                {/* User-defined policies */}
                {!loadingList && alertPolicies.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">ユーザー定義</p>
                    {alertPolicies.map(p => {
                      const alertPolicy = p.alertPolicy ?? { id: p.policyId, name: p.name, status: p.status };
                      return (
                        <AlertPolicyCard
                          key={p.policyId}
                          policy={{ ...alertPolicy, id: p.policyId, name: p.name, status: p.status }}
                          expanded={expandedIds.has(p.policyId)}
                          onExpand={() => toggleExpand(p.policyId)}
                          onToggleStatus={() => handleToggleStatus(p)}
                          onDelete={() => handleDelete(p)}
                          onPreview={() => setPreviewPolicy(alertPolicy as Partial<AlertPolicy>)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Templates */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">組み込みテンプレート</p>
                  {templateAlertPolicies.map(p => (
                    <AlertPolicyCard
                      key={p.id}
                      policy={p}
                      isTemplate
                      expanded={expandedIds.has(p.id)}
                      onExpand={() => toggleExpand(p.id)}
                      onPreview={() => setPreviewPolicy(p as Partial<AlertPolicy>)}
                    />
                  ))}
                </div>
              </TabsContent>

              {/* ── Summary tab ── */}
              <TabsContent value="summary">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">組み込みテンプレート</p>
                  {templateSummaryPolicies.map(p => (
                    <SummaryPolicyCard key={p.id} policy={p}
                      expanded={expandedIds.has(p.id)} onExpand={() => toggleExpand(p.id)} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <CreateAlertPolicyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreate}
        saving={savingNew}
      />

      <PreviewSheet
        open={previewPolicy !== null}
        onClose={() => setPreviewPolicy(null)}
        policy={previewPolicy}
      />
    </div>
  );
}
