import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Info, Plus, X, RefreshCw, Send } from "lucide-react";

interface AudienceCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceContext?: {
    type: string;
    linkedCompany?: string;
    linkedProject?: string;
    linkedCompanyId?: string;
    linkedProjectId?: string;
  };
}

interface Filter {
  field: string;
  operator: string;
  value: string;
}

export function AudienceCreateSheet({ open, onOpenChange, sourceContext }: AudienceCreateSheetProps) {
  const [searchParams] = useSearchParams();
  const fromProject = searchParams.get("fromProject");

  const [audienceName, setAudienceName] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [audienceScope, setAudienceScope] = useState("user");
  const [reusableFlag, setReusableFlag] = useState(false);
  const [linkedCompany, setLinkedCompany] = useState("");
  const [linkedProject, setLinkedProject] = useState("");
  const [filters, setFilters] = useState<Filter[]>([
    { field: "health_score", operator: "less_than", value: "50" },
  ]);

  const [targetCount, setTargetCount] = useState(1234);

  // モックデータ
  const companies = [
    { id: "1", name: "テックイノベーション株式会社" },
    { id: "2", name: "グローバルソリューションズ株式会社" },
  ];

  const projects = [
    { id: "proj_1", name: "プロジェクトA" },
    { id: "proj_2", name: "全社DX推進" },
  ];

  const sampleRecipients = [
    { id: "1", name: "田中太郎", email: "tanaka@example.com", company: "テックイノベーション", lastActive: "2026-03-10" },
    { id: "2", name: "山田花子", email: "yamada@example.com", company: "デジタルソリューション", lastActive: "2026-03-12" },
    { id: "3", name: "佐藤次郎", email: "sato@example.com", company: "グローバルテック", lastActive: "2026-03-08" },
  ];

  const getOperatorsForField = (field: string) => {
    if (field === "health_score" || field === "risk_score" || field === "l30_active") {
      return [
        { value: "equals", label: "=" },
        { value: "not_equals", label: "≠" },
        { value: "greater_than", label: ">" },
        { value: "less_than", label: "<" },
      ];
    }
    return [
      { value: "equals", label: "=" },
      { value: "not_equals", label: "≠" },
    ];
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      health_score: "Health Score",
      risk_score: "Risk Score",
      l30_active: "L30 Active",
      user_stage: "User Stage",
      permission: "Permission",
      last_active: "Last Active",
    };
    return labels[field] || field;
  };

  const getOperatorLabel = (operator: string) => {
    const labels: Record<string, string> = {
      equals: "=",
      not_equals: "≠",
      greater_than: ">",
      less_than: "<",
    };
    return labels[operator] || operator;
  };

  const addFilter = () => {
    setFilters([...filters, { field: "health_score", operator: "less_than", value: "" }]);
  };

  const removeFilter = (idx: number) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const updateFilter = (idx: number, key: keyof Filter, value: string) => {
    const newFilters = [...filters];
    newFilters[idx][key] = value;
    setFilters(newFilters);
  };

  const renderValueInput = (field: string, value: string, onChange: (val: string) => void) => {
    if (field === "user_stage") {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Engaged">Engaged</SelectItem>
            <SelectItem value="At-Risk">At-Risk</SelectItem>
            <SelectItem value="Churned">Churned</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (field === "permission") {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="値" />;
  };

  const saveDraft = () => {
    alert("下書き保存しました（モック）");
    onOpenChange(false);
  };

  const saveAsAudience = () => {
    alert("Audienceとして登録しました（モック）");
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    return dateStr;
  };

  const refreshPreview = () => {
    alert("プレビューを更新しました（モック）");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[1280px] sm:max-w-[1280px] overflow-y-auto p-0">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl">新規Audience作成</SheetTitle>
            <SheetDescription className="text-sm">対象条件を定義して、送信対象群を作成します</SheetDescription>
          </SheetHeader>

          {/* Source Context表示 */}
          {(sourceContext || fromProject) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">
                  {sourceContext?.type || "Project"}から作成
                </span>
              </div>
              {sourceContext?.linkedProject && (
                <p className="text-sm text-blue-700 mt-1">
                  Project: {sourceContext.linkedProject} の文脈を引き継いでいます
                </p>
              )}
            </div>
          )}

          <form className="space-y-8">
            {/* ステップ1: 基本情報 */}
            <div className="space-y-5">
              <div className="pb-3 border-b">
                <h3 className="text-lg font-semibold text-slate-900">基本情報</h3>
                <p className="text-sm text-slate-500 mt-1">Audienceの名前と目的を設定します</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">Audience Name *</Label>
                  <Input
                    value={audienceName}
                    onChange={(e) => setAudienceName(e.target.value)}
                    placeholder="例: At-Riskユーザー（Q1 2026）"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">Audience Scope *</Label>
                  <Select value={audienceScope} onValueChange={setAudienceScope}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="cluster">Cluster</SelectItem>
                      <SelectItem value="segment">Segment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">Description</Label>
                <Textarea
                  value={audienceDescription}
                  onChange={(e) => setAudienceDescription(e.target.value)}
                  placeholder="このAudienceの目的や背景"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Checkbox id="reusable" checked={reusableFlag} onCheckedChange={(checked) => setReusableFlag(!!checked)} />
                <Label htmlFor="reusable" className="font-normal cursor-pointer text-sm">
                  再利用可能なAudienceとして保存する
                </Label>
              </div>
            </div>

            <Separator />

            {/* ステップ2: 条件設定 */}
            <div className="space-y-5">
              <div className="pb-3 border-b">
                <h3 className="text-lg font-semibold text-slate-900">条件設定</h3>
                <p className="text-sm text-slate-500 mt-1">対象を絞り込むための条件を設定します</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">Linked Company</Label>
                  <Select value={linkedCompany} onValueChange={setLinkedCompany}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Company選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-slate-700 mb-2 block">Linked Project</Label>
                  <Select value={linkedProject} onValueChange={setLinkedProject}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Project選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filters UI */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-700">Audience条件</Label>
                  <Button variant="outline" size="sm" onClick={addFilter} type="button" className="h-9">
                    <Plus className="w-4 h-4 mr-2" />
                    条件を追加
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {filters.map((filter, idx) => (
                    <div key={idx} className="border-2 border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium text-slate-700">条件 {idx + 1}</Label>
                        <Button variant="ghost" size="sm" onClick={() => removeFilter(idx)} type="button" className="h-8 w-8 p-0">
                          <X className="w-4 h-4 text-slate-500" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs text-slate-600 mb-1.5 block">フィールド</Label>
                          <Select value={filter.field} onValueChange={(val) => updateFilter(idx, "field", val)}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="health_score">Health Score</SelectItem>
                              <SelectItem value="risk_score">Risk Score</SelectItem>
                              <SelectItem value="l30_active">L30 Active</SelectItem>
                              <SelectItem value="user_stage">User Stage</SelectItem>
                              <SelectItem value="permission">Permission</SelectItem>
                              <SelectItem value="last_active">Last Active</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-slate-600 mb-1.5 block">演算子</Label>
                          <Select value={filter.operator} onValueChange={(val) => updateFilter(idx, "operator", val)}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForField(filter.field).map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-slate-600 mb-1.5 block">値</Label>
                          {renderValueInput(filter.field, filter.value, (val) => updateFilter(idx, "value", val))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions Summary */}
              {filters.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <Label className="text-sm font-semibold text-blue-900 mb-3 block">条件サマリー</Label>
                  <ul className="space-y-2 text-sm text-blue-800">
                    {filters.map((filter, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                        <span>{getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)} <strong>{filter.value}</strong></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Separator />

            {/* ステップ3: プレビュー・保存 */}
            <div className="space-y-5">
              <div className="pb-3 border-b">
                <h3 className="text-lg font-semibold text-slate-900">プレビュー</h3>
                <p className="text-sm text-slate-500 mt-1">条件に一致する対象を確認します</p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-semibold text-slate-700">対象プレビュー</Label>
                <Button variant="outline" size="sm" onClick={refreshPreview} type="button" className="h-9">
                  <RefreshCw className="w-3 h-3 mr-2" />
                  更新
                </Button>
              </div>

              <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-slate-600 mb-2">対象件数</p>
                <p className="text-5xl font-bold text-blue-600 mb-1">{targetCount}</p>
                <p className="text-sm text-blue-700">件</p>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-3 block">代表対象（上位10件）</Label>
                <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sampleRecipients.slice(0, 10).map((recipient) => (
                        <TableRow key={recipient.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium">{recipient.name}</TableCell>
                          <TableCell className="text-sm text-slate-600">{recipient.email}</TableCell>
                          <TableCell className="text-sm text-slate-600">{recipient.company}</TableCell>
                          <TableCell className="text-sm text-slate-600">{formatDate(recipient.lastActive)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="flex gap-3 pt-6 border-t">
              <Button type="button" onClick={saveDraft} variant="outline" className="h-11 px-6">
                下書き保存
              </Button>
              <Button type="button" onClick={saveAsAudience} className="bg-green-600 hover:bg-green-700 h-11 px-6">
                Audienceとして登録
              </Button>
              <Link to="/outbound/compose?fromAudience=new">
                <Button type="button" className="bg-blue-600 hover:bg-blue-700 h-11 px-6">
                  <Send className="w-4 h-4 mr-2" />
                  Outboundで使う
                </Button>
              </Link>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-11 px-6 ml-auto">
                キャンセル
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}