import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Users,
  Sparkles,
  Target,
  Send,
  Database,
  AlertCircle,
  Zap,
  CheckCircle2,
  ArrowLeft,
  Search,
  CheckSquare,
  FileText,
  Edit3,
  Eye,
  Save,
  Plus,
  X,
  RefreshCw,
} from "lucide-react";

interface Filter {
  field: string;
  operator: string;
  value: string;
}

// モックデータ - Audience詳細
const mockAudienceDetail = {
  id: "aud_1",
  status: "active" as const,
  name: "At-Riskユーザー（Q1 2026）",
  description: "過去30日でアクティビティが急激に低下したユーザー群",
  scope: "user" as const,
  targetCount: 1234,
  sourceContext: "Project" as const,
  linkedCompany: "テックイノベーション株式会社",
  linkedCompanyId: "1",
  linkedProject: "プロジェクトA",
  linkedProjectId: "proj_1",
  owner: "佐藤 太郎",
  lastUsed: "2026-03-10",
  updatedAt: "2026-03-12",
  createdAt: "2026-02-28",
  reusableFlag: true,
  tags: ["at-risk", "engagement", "q1-2026"],
  filters: [
    { field: "l30_active", operator: "less_than", value: "5" },
    { field: "user_stage", operator: "equals", value: "At-Risk" },
  ],
};

const audienceInsights = [
  {
    id: "ins_1",
    type: "risk" as const,
    title: "過去30日でアクティビティが急激に低下",
    description: "このクラスターの78%のProjectで、l30_activeが前月比50%以上低下しています。",
    evidenceCount: 1423,
    affectedProjects: 1439,
    affectedUsers: 8923,
  },
  {
    id: "ins_2",
    type: "risk" as const,
    title: "定着スコアの継続的な悪化傾向",
    description: "habituation_statusが3ヶ月連続で悪化しているProjectが多数確認されています。",
    evidenceCount: 987,
    affectedProjects: 1124,
    affectedUsers: 6234,
  },
  {
    id: "ins_3",
    type: "opportunity" as const,
    title: "管理者の関心度は維持されている",
    description: "適切な支援で回復可能性があります。",
    evidenceCount: 234,
    affectedProjects: 876,
    affectedUsers: 2345,
  },
];

const targetUsers = [
  {
    id: "u1",
    name: "田中太郎",
    email: "tanaka@tech-innov.jp",
    project: "プロジェクトA",
    company: "テックイノベーション株式会社",
    companyId: "1",
    permission: "admin",
    status: "inactive",
    lastActive: "2026-02-15",
    userStage: "At-Risk",
    companyLinked: true,
    l30_active: 2,
  },
  {
    id: "u2",
    name: "山田花子",
    email: "yamada@tech-innov.jp",
    project: "プロジェクトA",
    company: "テックイノベーション株式会社",
    companyId: "1",
    permission: "member",
    status: "active",
    lastActive: "2026-03-10",
    userStage: "Engaged",
    companyLinked: true,
    l30_active: 15,
  },
  {
    id: "u3",
    name: "佐藤次郎",
    email: "sato@digital-mkt.jp",
    project: "データ分析基盤構築",
    company: "デジタルマーケティング株式会社",
    companyId: "2",
    permission: "admin",
    status: "inactive",
    lastActive: "2026-02-20",
    userStage: "At-Risk",
    companyLinked: true,
    l30_active: 1,
  },
  {
    id: "u4",
    name: "鈴木三郎",
    email: "suzuki@cloud-infra.jp",
    project: "全社DX推進",
    company: "クラウドインフラ株式会社",
    companyId: "5",
    permission: "admin",
    status: "inactive",
    lastActive: "2026-02-25",
    userStage: "At-Risk",
    companyLinked: true,
    l30_active: 3,
  },
  {
    id: "u5",
    name: "高橋美咲",
    email: "takahashi@global-sol.jp",
    project: "マーケティング施策最適化",
    company: "グローバルソリューションズ株式会社",
    companyId: "2",
    permission: "member",
    status: "inactive",
    lastActive: "2026-03-01",
    userStage: "At-Risk",
    companyLinked: true,
    l30_active: 4,
  },
];

export function AudienceDetail() {
  const [searchParams] = useSearchParams();
  const audienceId = searchParams.get("id");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "users">("overview");

  // 編集用のstate
  const [audienceName, setAudienceName] = useState(mockAudienceDetail.name);
  const [audienceDescription, setAudienceDescription] = useState(mockAudienceDetail.description);
  const [audienceScope, setAudienceScope] = useState(mockAudienceDetail.scope);
  const [reusableFlag, setReusableFlag] = useState(mockAudienceDetail.reusableFlag);
  const [linkedCompany, setLinkedCompany] = useState(mockAudienceDetail.linkedCompanyId || "");
  const [linkedProject, setLinkedProject] = useState(mockAudienceDetail.linkedProjectId || "");
  const [owner, setOwner] = useState(mockAudienceDetail.owner);
  const [tags, setTags] = useState(mockAudienceDetail.tags.join(", "));
  const [filters, setFilters] = useState<Filter[]>(mockAudienceDetail.filters);

  // モックデータ
  const companies = [
    { id: "1", name: "テックイノベーション株式会社" },
    { id: "2", name: "グローバルソリューションズ株式会社" },
    { id: "3", name: "デジタルマーケティング株式会社" },
  ];

  const projects = [
    { id: "proj_1", name: "プロジェクトA" },
    { id: "proj_2", name: "全社DX推進" },
  ];

  const handleSelectAll = () => {
    if (selectedUsers.length === targetUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(targetUsers.map((u) => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

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
          <SelectTrigger className="h-8 text-xs">
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
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="値" className="h-8 text-xs" />;
  };

  const handleSave = () => {
    alert("保存しました（モック）");
    setIsEditing(false);
  };

  const refreshPreview = () => {
    alert("プレビューを更新しました（モック）");
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col overflow-hidden">
        <GlobalHeader currentView="Cross-scope" />
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1800px] mx-auto p-6">
            {/* Page Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Link to="/audience">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    一覧に戻る
                  </Button>
                </Link>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isEditing ? (
                      <Input
                        value={audienceName}
                        onChange={(e) => setAudienceName(e.target.value)}
                        className="text-2xl font-semibold h-auto py-1 px-2 max-w-lg"
                      />
                    ) : (
                      <h1 className="text-2xl font-semibold text-slate-900">
                        {audienceName}
                      </h1>
                    )}
                    <Badge variant={mockAudienceDetail.status === "active" ? "default" : "secondary"}>
                      {mockAudienceDetail.status}
                    </Badge>
                    {reusableFlag && (
                      <Badge variant="outline" className="text-xs">
                        再利用可
                      </Badge>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={audienceDescription}
                      onChange={(e) => setAudienceDescription(e.target.value)}
                      className="text-sm max-w-2xl"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm text-slate-600">
                      {audienceDescription}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {isEditing && (
                    <Button size="sm" onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      保存
                    </Button>
                  )}
                  <Button
                    variant={isEditing ? "outline" : "default"}
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        表示モード
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 mr-2" />
                        編集モード
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "users")}>
              <TabsList className="mb-6">
                <TabsTrigger value="overview">概要・設定</TabsTrigger>
                <TabsTrigger value="users">対象User一覧</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  {/* Left Column - Basic Info */}
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-4">基本情報</h3>
                      
                      {isEditing ? (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Scope</Label>
                            <Select value={audienceScope} onValueChange={setAudienceScope}>
                              <SelectTrigger className="mt-1 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="company">Company</SelectItem>
                                <SelectItem value="project">Project</SelectItem>
                                <SelectItem value="cluster">Cluster</SelectItem>
                                <SelectItem value="segment">Segment</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Owner</Label>
                            <Select value={owner} onValueChange={setOwner}>
                              <SelectTrigger className="mt-1 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="佐藤 太郎">佐藤 太郎</SelectItem>
                                <SelectItem value="田中 花子">田中 花子</SelectItem>
                                <SelectItem value="鈴木 次郎">鈴木 次郎</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Tags</Label>
                            <Input
                              value={tags}
                              onChange={(e) => setTags(e.target.value)}
                              className="mt-1 text-sm"
                              placeholder="カンマ区切りでタグを入力"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="reusable" 
                              checked={reusableFlag} 
                              onCheckedChange={(checked) => setReusableFlag(!!checked)} 
                            />
                            <Label htmlFor="reusable" className="text-xs font-normal cursor-pointer">
                              再利用可能なAudience
                            </Label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 text-sm">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-slate-500">Scope</div>
                              <Badge variant="outline" className="mt-1 text-xs">
                                {audienceScope}
                              </Badge>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Source</div>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {mockAudienceDetail.sourceContext}
                              </Badge>
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <div className="text-xs text-slate-500">Owner</div>
                            <div className="mt-1 text-slate-900">{owner}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">対象数</div>
                            <div className="mt-1 text-xl font-bold text-blue-600">
                              {mockAudienceDetail.targetCount.toLocaleString()}件
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <div className="text-xs text-slate-500">作成日</div>
                            <div className="mt-1 text-slate-900">{mockAudienceDetail.createdAt}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">最終更新</div>
                            <div className="mt-1 text-slate-900">{mockAudienceDetail.updatedAt}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">最終使用</div>
                            <div className="mt-1 text-slate-900">{mockAudienceDetail.lastUsed}</div>
                          </div>
                          <Separator />
                          <div>
                            <div className="text-xs text-slate-500 mb-2">Tags</div>
                            <div className="flex flex-wrap gap-1">
                              {tags.split(",").map((tag, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {tag.trim()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Insights */}
                    <div className="bg-white border rounded-lg">
                      <div className="p-4 border-b">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          <h3 className="font-semibold text-slate-900">共通インサイト</h3>
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        {audienceInsights.map((insight) => (
                          <div
                            key={insight.id}
                            className={`border rounded-lg p-3 ${
                              insight.type === "risk"
                                ? "border-red-200 bg-red-50"
                                : "border-emerald-200 bg-emerald-50"
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              {insight.type === "risk" ? (
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-900 mb-1">
                                  {insight.title}
                                </div>
                                <p className="text-xs text-slate-700">{insight.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span>Evidence: {insight.evidenceCount}</span>
                              <span>User: {insight.affectedUsers}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Center & Right Columns - Conditions & Preview */}
                  <div className="col-span-2 space-y-6">
                    {/* Linked Context */}
                    <div className="bg-white border rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-4">紐付けコンテキスト</h3>
                      {isEditing ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Linked Company</Label>
                            <Select value={linkedCompany} onValueChange={setLinkedCompany}>
                              <SelectTrigger className="mt-1 h-8 text-xs">
                                <SelectValue placeholder="Company選択" />
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
                            <Label className="text-xs font-semibold text-slate-700">Linked Project</Label>
                            <Select value={linkedProject} onValueChange={setLinkedProject}>
                              <SelectTrigger className="mt-1 h-8 text-xs">
                                <SelectValue placeholder="Project選択" />
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
                      ) : (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Company</div>
                            {mockAudienceDetail.linkedCompany ? (
                              <Link
                                to={`/company/${mockAudienceDetail.linkedCompanyId}`}
                                className="text-blue-600 hover:underline"
                              >
                                {mockAudienceDetail.linkedCompany}
                              </Link>
                            ) : (
                              <span className="text-slate-400">未設定</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Project</div>
                            {mockAudienceDetail.linkedProject ? (
                              <Link
                                to={`/project/${mockAudienceDetail.linkedProjectId}`}
                                className="text-blue-600 hover:underline"
                              >
                                {mockAudienceDetail.linkedProject}
                              </Link>
                            ) : (
                              <span className="text-slate-400">未設定</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Filters */}
                    <div className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">Audience条件</h3>
                        {isEditing && (
                          <Button variant="outline" size="sm" onClick={addFilter}>
                            <Plus className="w-3 h-3 mr-1" />
                            条件追加
                          </Button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-3">
                          {filters.map((filter, idx) => (
                            <div key={idx} className="border rounded p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">条件 {idx + 1}</Label>
                                <Button variant="ghost" size="sm" onClick={() => removeFilter(idx)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <Select value={filter.field} onValueChange={(val) => updateFilter(idx, "field", val)}>
                                  <SelectTrigger className="h-8 text-xs">
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

                                <Select value={filter.operator} onValueChange={(val) => updateFilter(idx, "operator", val)}>
                                  <SelectTrigger className="h-8 text-xs">
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

                                {renderValueInput(filter.field, filter.value, (val) => updateFilter(idx, "value", val))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filters.map((filter, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded">
                              <Badge variant="outline" className="text-xs">
                                {getFieldLabel(filter.field)}
                              </Badge>
                              <span className="text-slate-600">{getOperatorLabel(filter.operator)}</span>
                              <Badge className="text-xs">{filter.value}</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Conditions Summary */}
                      {!isEditing && filters.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-4">
                          <Label className="text-xs font-medium text-blue-900">条件サマリー</Label>
                          <ul className="mt-2 space-y-1 text-sm text-blue-800">
                            {filters.map((filter, idx) => (
                              <li key={idx}>
                                • {getFieldLabel(filter.field)} {getOperatorLabel(filter.operator)} {filter.value}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div className="bg-white border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">プレビュー</h3>
                        <Button variant="outline" size="sm" onClick={refreshPreview}>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          更新
                        </Button>
                      </div>
                      
                      <div className="text-center py-8 bg-blue-50 rounded mb-4">
                        <p className="text-sm text-slate-600 mb-2">対象件数</p>
                        <p className="text-4xl font-bold text-blue-600">{mockAudienceDetail.targetCount}件</p>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-slate-50 border rounded p-3">
                          <div className="text-xs text-slate-500 mb-1">At-Risk User</div>
                          <div className="text-xl font-bold text-red-600">
                            {targetUsers.filter((u) => u.userStage === "At-Risk").length}名
                          </div>
                        </div>
                        <div className="bg-slate-50 border rounded p-3">
                          <div className="text-xs text-slate-500 mb-1">Admin権限</div>
                          <div className="text-xl font-bold text-purple-600">
                            {targetUsers.filter((u) => u.permission === "admin").length}名
                          </div>
                        </div>
                        <div className="bg-slate-50 border rounded p-3">
                          <div className="text-xs text-slate-500 mb-1">Inactive</div>
                          <div className="text-xl font-bold text-slate-600">
                            {targetUsers.filter((u) => u.status === "inactive").length}名
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users">
                <div className="bg-white border rounded-lg">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">対象User一覧</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {selectedUsers.length}名選択中
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="名前、Email、Companyで検索..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select defaultValue="all">
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Status filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="all_stage">
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Stage filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_stage">全Stage</SelectItem>
                          <SelectItem value="at_risk">At-Risk</SelectItem>
                          <SelectItem value="engaged">Engaged</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.length === targetUsers.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>権限</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>L30活動</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {targetUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={() => handleSelectUser(user.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{user.name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link
                              to={`/company/${user.companyId}`}
                              className="text-sm text-slate-600 hover:text-blue-600 hover:underline"
                            >
                              {user.company}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{user.project}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                user.permission === "admin" ? "bg-purple-50" : ""
                              }`}
                            >
                              {user.permission}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.status === "active" ? (
                              <Badge className="text-xs bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-slate-100">
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-xs ${
                                user.userStage === "At-Risk" ? "bg-red-500" : "bg-blue-500"
                              }`}
                            >
                              {user.userStage}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">{user.l30_active}日</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-4 border-t bg-slate-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        {targetUsers.length}名を表示中
                      </p>
                      {selectedUsers.length > 0 && (
                        <div className="flex gap-2">
                          <Link to={`/outbound/compose?audience=${audienceId}&count=${selectedUsers.length}`}>
                            <Button size="sm">
                              <Send className="w-4 h-4 mr-2" />
                              Outbound起票
                            </Button>
                          </Link>
                          <Link to={`/actions?audience=${audienceId}&count=${selectedUsers.length}`}>
                            <Button variant="outline" size="sm">
                              <CheckSquare className="w-4 h-4 mr-2" />
                              Actions作成
                            </Button>
                          </Link>
                          <Link to={`/content?audience=${audienceId}&count=${selectedUsers.length}`}>
                            <Button variant="outline" size="sm">
                              <FileText className="w-4 h-4 mr-2" />
                              Content作成
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
