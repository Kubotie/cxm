import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Input } from "../ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Eye,
  Edit,
  CheckCircle,
  HelpCircle,
  AlertCircle,
  TrendingUp,
  Target,
  FileText,
  Building,
  Sparkles,
  Plus,
  Link as LinkIcon,
  Maximize2,
  UserPlus,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  GitMerge,
  Network
} from "lucide-react";
import { PeopleOrgChartModals } from "./people-org-chart-modals";
import { PeopleDetailPanel } from "./people-detail-panel";
import { RelationshipEditor, type Relationship } from "./relationship-editor";
import { DepartmentGroup } from "./department-group";
import { RelationshipLines } from "./relationship-lines";
import { ConnectionHandles } from "./connection-handles";

interface Person {
  id: string;
  name: string;
  role: string;
  title?: string;
  department?: string;
  roleType: string;
  decisionInfluence: "high" | "medium" | "low" | "unknown";
  contactStatus: "active" | "contacted" | "not contacted" | "inactive" | "unknown";
  relationLevel?: string;
  company: string;
  email?: string;
  phone?: string;
  status: "confirmed" | "proposed" | "unresolved";
  confidence?: string;
  evidenceCount: number;
  lastTouchpoint?: string | null;
  linkedProjects?: string[];
  linkedActions?: number;
  linkedContentJobs?: number;
  scope?: string;
  owner?: string;
  relationshipHypothesis?: string;
  missingFields?: string[];
}

interface MissingRole {
  id: string;
  label: string;
  roleType: string;
  description: string;
  layer: "executive" | "champion" | "user";
}

interface PeopleOrgChartProps {
  people: Person[];
  onPersonSelect?: (personId: string) => void;
}

const roleTypeConfig: Record<string, { color: string; layer: "executive" | "champion" | "user" }> = {
  "Decision Maker": { color: "bg-purple-100 text-purple-800 border-purple-300", layer: "executive" },
  "Executive Sponsor": { color: "bg-purple-100 text-purple-800 border-purple-300", layer: "executive" },
  "Budget Holder": { color: "bg-emerald-100 text-emerald-800 border-emerald-300", layer: "executive" },
  "Champion": { color: "bg-blue-100 text-blue-800 border-blue-300", layer: "champion" },
  "Project Owner": { color: "bg-indigo-100 text-indigo-800 border-indigo-300", layer: "champion" },
  "User": { color: "bg-slate-100 text-slate-800 border-slate-300", layer: "user" },
  "Admin": { color: "bg-cyan-100 text-cyan-800 border-cyan-300", layer: "user" },
  "Support Contact": { color: "bg-amber-100 text-amber-800 border-amber-300", layer: "user" },
  "Unknown": { color: "bg-slate-100 text-slate-500 border-slate-300", layer: "user" },
};

const statusConfig = {
  confirmed: { label: "Confirmed", color: "border-emerald-500", ringColor: "ring-emerald-500", bgColor: "bg-emerald-50" },
  proposed: { label: "Proposed", color: "border-blue-500", ringColor: "ring-blue-500", bgColor: "bg-blue-50" },
  unresolved: { label: "Unresolved", color: "border-amber-500", ringColor: "ring-amber-500", bgColor: "bg-amber-50" },
};

const missingRolesData: MissingRole[] = [
  { id: "missing-exec-sponsor", label: "Executive Sponsor", roleType: "Executive Sponsor", description: "経営層の承認者が未把握", layer: "executive" },
  { id: "missing-budget", label: "Budget Holder", roleType: "Budget Holder", description: "予算承認者が不明確", layer: "executive" },
];

export function PeopleOrgChart({ people, onPersonSelect }: PeopleOrgChartProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"structure" | "influence" | "coverage" | "evidence">("structure");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [zoom, setZoom] = useState(100);
  const [groupByDepartment, setGroupByDepartment] = useState(true);
  const [showRelationships, setShowRelationships] = useState(true);

  // Relationships state
  const [relationships, setRelationships] = useState<Relationship[]>([
    { id: "rel-1", fromPersonId: "p1", toPersonId: "p3", type: "influences", strength: "strong", direction: "one-way", status: "confirmed" },
    { id: "rel-2", fromPersonId: "p3", toPersonId: "p5", type: "collaborates", strength: "medium", direction: "two-way", status: "confirmed" },
    { id: "rel-3", fromPersonId: "p2", toPersonId: "p4", type: "mentor", strength: "strong", direction: "one-way", status: "proposed" },
  ]);
  const [showRelationshipEditor, setShowRelationshipEditor] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);

  // Connection drag state
  const [isDraggingConnection, setIsDraggingConnection] = useState(false);
  const [connectionFrom, setConnectionFrom] = useState<{ personId: string; x: number; y: number } | null>(null);
  const [connectionTo, setConnectionTo] = useState<{ x: number; y: number } | null>(null);

  // Modal/Sheet/Dialog states
  const [showEvidenceSheet, setShowEvidenceSheet] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showProjectLinkSheet, setShowProjectLinkSheet] = useState(false);
  const [showActionCreateDrawer, setShowActionCreateDrawer] = useState(false);
  const [showMissingRoleSheet, setShowMissingRoleSheet] = useState(false);
  const [selectedMissingRole, setSelectedMissingRole] = useState<MissingRole | null>(null);

  const selectedPerson = people.find(p => p.id === selectedPersonId);

  // Filter people by roleFilter
  const filteredPeople = roleFilter === "all" 
    ? people 
    : people.filter(p => p.roleType === roleFilter);

  // New grouping logic: Group by department first, then by layer within each department
  const groupPeopleByDepartment = () => {
    if (!groupByDepartment) {
      // If department grouping is off, return flat structure by layer
      return {
        "All": {
          executive: filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "executive"),
          champion: filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "champion"),
          user: filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "user"),
        }
      };
    }

    // Group by department
    const deptGroups: Record<string, { executive: Person[]; champion: Person[]; user: Person[] }> = {};
    
    filteredPeople.forEach(person => {
      const dept = person.department || "Other";
      if (!deptGroups[dept]) {
        deptGroups[dept] = { executive: [], champion: [], user: [] };
      }
      
      const layer = roleTypeConfig[person.roleType]?.layer || "user";
      deptGroups[dept][layer].push(person);
    });

    return deptGroups;
  };

  const departmentGroups = groupPeopleByDepartment();

  // Separate executive-only departments from business divisions
  const executiveDepartments: string[] = [];
  const businessDivisions: string[] = [];

  Object.entries(departmentGroups).forEach(([deptName, layers]) => {
    // If a department has only executives and no champions/users, it's executive-level
    if (layers.executive.length > 0 && layers.champion.length === 0 && layers.user.length === 0) {
      executiveDepartments.push(deptName);
    } else if (layers.executive.length > 0 || layers.champion.length > 0 || layers.user.length > 0) {
      businessDivisions.push(deptName);
    }
  });

  // Legacy layer aggregations (for non-departmental view and stats)
  const executiveLayer = filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "executive");
  const championLayer = filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "champion");
  const userLayer = filteredPeople.filter(p => roleTypeConfig[p.roleType]?.layer === "user");

  // Statistics (use original people, not filtered)
  const confirmedCount = people.filter(p => p.status === "confirmed").length;
  const proposedCount = people.filter(p => p.status === "proposed").length;
  const unresolvedCount = people.filter(p => p.status === "unresolved").length;
  const noContactCount = people.filter(p => p.contactStatus === "not contacted").length;

  const handlePersonClick = (personId: string) => {
    setSelectedPersonId(personId);
    if (onPersonSelect) {
      onPersonSelect(personId);
    }
  };

  const handleMissingRoleClick = (roleId: string) => {
    const missingRole = missingRolesData.find(m => m.id === roleId);
    if (missingRole) {
      setSelectedMissingRole(missingRole);
      setShowMissingRoleSheet(true);
    }
  };

  const handleSaveRelationship = (relationship: Relationship) => {
    setRelationships(prev => {
      const existing = prev.find(r => r.id === relationship.id);
      if (existing) {
        return prev.map(r => r.id === relationship.id ? relationship : r);
      } else {
        return [...prev, relationship];
      }
    });
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    setRelationships(prev => prev.filter(r => r.id !== relationshipId));
  };

  const handleAddRelationship = () => {
    setEditingRelationship(null);
    setShowRelationshipEditor(true);
  };

  const handleEditRelationship = (relationship: Relationship) => {
    setEditingRelationship(relationship);
    setShowRelationshipEditor(true);
  };

  // Connection drag handlers
  const handleConnectionStart = (fromId: string) => {
    setIsDraggingConnection(true);
    setConnectionFrom({ personId: fromId, x: 0, y: 0 });
  };

  const handleConnectionEnd = (toId: string) => {
    if (connectionFrom && connectionFrom.personId !== toId) {
      // Create new relationship
      const newRelationship: Relationship = {
        id: `rel-${Date.now()}`,
        fromPersonId: connectionFrom.personId,
        toPersonId: toId,
        type: "influences",
        strength: "medium",
        direction: "one-way",
        status: "proposed",
      };
      
      setRelationships(prev => [...prev, newRelationship]);
      
      // Automatically open editor for the new relationship
      setEditingRelationship(newRelationship);
      setShowRelationshipEditor(true);
    }
    
    setIsDraggingConnection(false);
    setConnectionFrom(null);
    setConnectionTo(null);
  };

  const renderPersonNode = (person: Person, index: number, total: number) => {
    const isSelected = selectedPersonId === person.id;
    const config = roleTypeConfig[person.roleType] || roleTypeConfig["Unknown"];
    const statusCfg = statusConfig[person.status];

    const nodeSize = viewMode === "influence" 
      ? person.decisionInfluence === "high" ? "w-48" : person.decisionInfluence === "medium" ? "w-44" : "w-40"
      : "w-44";

    return (
      <div
        key={person.id}
        data-person-id={person.id}
        onClick={() => handlePersonClick(person.id)}
        className={`${nodeSize} relative cursor-pointer transition-all ${isSelected ? "scale-105" : "hover:scale-102"}`}
        style={{
          transform: `translateX(${index * 20 - (total - 1) * 10}px)`,
        }}
      >
        <div
          className={`person-card-inner border-2 rounded-lg p-3 bg-white shadow-sm transition-all ${
            isSelected
              ? `${statusCfg.ringColor} ring-4 ring-opacity-50 ${statusCfg.color} shadow-lg`
              : `${statusCfg.color} hover:shadow-md`
          } ${statusCfg.bgColor}`}
        >
          {/* Avatar */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              person.status === "confirmed" ? "bg-emerald-500 text-white" :
              person.status === "proposed" ? "bg-blue-500 text-white" :
              "bg-amber-500 text-white"
            }`}>
              {person.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">{person.name}</div>
              <div className="text-xs text-slate-600 truncate">{person.title || person.role}</div>
            </div>
          </div>

          {/* Role Badge */}
          <div className="mb-2">
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              {person.roleType}
            </Badge>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap gap-1 text-xs">
            {viewMode === "coverage" && (
              <Badge variant="outline" className={`text-xs ${
                person.contactStatus === "active" ? "bg-emerald-100 text-emerald-700" :
                person.contactStatus === "not contacted" ? "bg-red-100 text-red-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {person.contactStatus === "active" ? "Active" :
                 person.contactStatus === "not contacted" ? "No Contact" :
                 person.contactStatus}
              </Badge>
            )}
            
            {viewMode === "influence" && person.decisionInfluence !== "unknown" && (
              <Badge variant="outline" className={`text-xs ${
                person.decisionInfluence === "high" ? "bg-red-100 text-red-700" :
                person.decisionInfluence === "medium" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                {person.decisionInfluence}
              </Badge>
            )}

            {viewMode === "evidence" && (
              <Badge variant="outline" className="text-xs bg-slate-100">
                <FileText className="w-2.5 h-2.5 mr-0.5" />
                {person.evidenceCount}
              </Badge>
            )}

            {person.missingFields && person.missingFields.length > 0 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                {person.missingFields.length}
              </Badge>
            )}
          </div>

          {/* Last Touchpoint */}
          {person.lastTouchpoint && (
            <div className="mt-2 pt-2 border-t text-xs text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{person.lastTouchpoint}</span>
            </div>
          )}

          {!person.lastTouchpoint && person.contactStatus === "not contacted" && (
            <div className="mt-2 pt-2 border-t text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>No Contact</span>
            </div>
          )}
        </div>

        {/* Connection Handles for Drag & Drop */}
        <ConnectionHandles
          personId={person.id}
          onConnectionStart={handleConnectionStart}
          onConnectionEnd={handleConnectionEnd}
          isDragging={isDraggingConnection && connectionFrom?.personId !== person.id}
        />
      </div>
    );
  };

  const renderMissingNode = (missing: MissingRole, index: number, total: number) => {
    return (
      <div
        key={missing.id}
        onClick={() => handleMissingRoleClick(missing.id)}
        className="w-44 relative cursor-pointer transition-all hover:scale-102"
        style={{
          transform: `translateX(${index * 20 - (total - 1) * 10}px)`,
        }}
      >
        <div className="border-2 border-dashed border-amber-300 rounded-lg p-3 bg-amber-50 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-amber-200 text-amber-800">
              <Plus className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-amber-900">Missing</div>
              <div className="text-xs text-amber-700 truncate">{missing.label}</div>
            </div>
          </div>

          <div className="text-xs text-amber-800 mb-2">{missing.description}</div>

          <Button size="sm" variant="outline" className="w-full text-xs h-7">
            <Sparkles className="w-3 h-3 mr-1" />
            候補を探す
          </Button>
        </div>

        {missing.layer !== "user" && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full h-6 w-0.5 bg-slate-300 opacity-30" />
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex relative">
      {/* Main Chart Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Summary & Controls */}
        <div className="p-2 border-b bg-slate-50 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] font-semibold text-slate-700 uppercase tracking-wide">People Summary</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-6 text-xs px-2">
                  <Maximize2 className="w-3 h-3 mr-1" />
                  全体表示
                </Button>
              </DialogTrigger>
              <DialogContent className="!max-w-[calc(100vw-2rem)] w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] p-0">
                <DialogHeader className="p-4 border-b bg-slate-50">
                  <div className="flex items-center justify-between">
                    <DialogTitle>People Org Chart - 全体管理</DialogTitle>
                    <DialogDescription className="sr-only">
                      組織全体の人物マップを管理・編集するモーダルビュー
                    </DialogDescription>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border rounded px-2 py-1 bg-white">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => setZoom(Math.max(50, zoom - 10))}
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-xs font-medium text-slate-700 min-w-[3rem] text-center">
                          {zoom}%
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0"
                          onClick={() => setZoom(Math.min(200, zoom + 10))}
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-6 w-6 p-0 ml-1"
                          onClick={() => setZoom(100)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="h-4 w-px bg-slate-300" />
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <UserPlus className="w-3.5 h-3.5 mr-1" />
                        新規追加
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        インポート
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs">
                        <Download className="w-3.5 h-3.5 mr-1" />
                        エクスポート
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                
                <div className="flex-1 flex flex-col overflow-hidden relative">
                  {/* Modal Controls */}
                  <div className="p-4 border-b bg-slate-50 flex-shrink-0">
                    <div className="grid grid-cols-5 gap-3 mb-3">
                      <div className="bg-white border rounded p-2 text-center">
                        <div className="text-xs text-slate-600 mb-1">Total People</div>
                        <div className="text-xl font-semibold text-slate-900">{people.length}</div>
                      </div>
                      <div className="bg-white border rounded p-2 text-center">
                        <div className="text-xs text-slate-600 mb-1">Confirmed</div>
                        <div className="text-xl font-semibold text-emerald-700">{confirmedCount}</div>
                      </div>
                      <div className="bg-white border rounded p-2 text-center">
                        <div className="text-xs text-slate-600 mb-1">Proposed</div>
                        <div className="text-xl font-semibold text-blue-700">{proposedCount}</div>
                      </div>
                      <div className="bg-white border rounded p-2 text-center">
                        <div className="text-xs text-slate-600 mb-1">Unresolved</div>
                        <div className="text-xl font-semibold text-amber-700">{unresolvedCount}</div>
                      </div>
                      <div className="bg-white border rounded p-2 text-center">
                        <div className="text-xs text-slate-600 mb-1">No Contact</div>
                        <div className="text-xl font-semibold text-red-700">{noContactCount}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="structure">Structure View</SelectItem>
                          <SelectItem value="influence">Influence View</SelectItem>
                          <SelectItem value="coverage">Coverage View</SelectItem>
                          <SelectItem value="evidence">Evidence View</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                          <SelectItem value="Champion">Champion</SelectItem>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm" 
                        variant={groupByDepartment ? "default" : "outline"}
                        className="h-8 text-xs px-3"
                        onClick={() => setGroupByDepartment(!groupByDepartment)}
                      >
                        <Building className="w-3.5 h-3.5 mr-1" />
                        部署
                      </Button>
                      <Button 
                        size="sm" 
                        variant={showRelationships ? "default" : "outline"}
                        className="h-8 text-xs px-3"
                        onClick={() => setShowRelationships(!showRelationships)}
                      >
                        <Network className="w-3.5 h-3.5 mr-1" />
                        関係線
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 text-xs px-3"
                        onClick={handleAddRelationship}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        関係性追加
                      </Button>
                    </div>
                  </div>

                  {/* Modal Chart Canvas */}
                  <div className="flex-1 overflow-auto bg-slate-50 relative org-chart-canvas">
                    <div 
                      className="p-12 min-h-full min-w-max origin-top-left transition-transform duration-200" 
                      style={{ transform: `scale(${zoom / 100})` }}
                    >
                      {groupByDepartment ? (
                        <>
                          {/* Executive Departments (上段) */}
                          {executiveDepartments.length > 0 && (
                            <div className="mb-16">
                              <div className="text-sm font-semibold text-slate-600 mb-6 uppercase tracking-wide">
                                経営層
                              </div>
                              <div className="flex justify-center gap-8 flex-wrap">
                                {executiveDepartments.map(deptName => {
                                  const layers = departmentGroups[deptName];
                                  return (
                                    <DepartmentGroup key={deptName} departmentName={deptName}>
                                      {layers.executive.map((person, idx) => renderPersonNode(person, idx, layers.executive.length))}
                                      {layers.champion.map((person, idx) => renderPersonNode(person, idx, layers.champion.length))}
                                      {layers.user.map((person, idx) => renderPersonNode(person, idx, layers.user.length))}
                                    </DepartmentGroup>
                                  );
                                })}
                                {missingRolesData.filter(m => m.layer === "executive").length > 0 && (
                                  <DepartmentGroup departmentName="Missing Roles">
                                    {missingRolesData.filter(m => m.layer === "executive").map((missing, idx) => 
                                      renderMissingNode(missing, idx, missingRolesData.filter(m => m.layer === "executive").length)
                                    )}
                                  </DepartmentGroup>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Business Divisions (下段：横並び) */}
                          {businessDivisions.length > 0 && (
                            <div className="mb-12">
                              <div className="text-sm font-semibold text-slate-600 mb-6 uppercase tracking-wide">
                                事業部
                              </div>
                              <div className="flex justify-center gap-8 flex-wrap">
                                {businessDivisions.map(deptName => {
                                  const layers = departmentGroups[deptName];
                                  return (
                                    <DepartmentGroup key={deptName} departmentName={deptName}>
                                      {/* Executive Layer */}
                                      {layers.executive.length > 0 && (
                                        <div className="mb-3">
                                          <div className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Executive</div>
                                          <div className="space-y-2">
                                            {layers.executive.map((person, idx) => renderPersonNode(person, 0, 1))}
                                          </div>
                                        </div>
                                      )}
                                      {/* Champion Layer */}
                                      {layers.champion.length > 0 && (
                                        <div className="mb-3">
                                          <div className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">Champion</div>
                                          <div className="space-y-2">
                                            {layers.champion.map((person, idx) => renderPersonNode(person, 0, 1))}
                                          </div>
                                        </div>
                                      )}
                                      {/* User Layer */}
                                      {layers.user.length > 0 && (
                                        <div>
                                          <div className="text-[10px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">User</div>
                                          <div className="space-y-2">
                                            {layers.user.map((person, idx) => renderPersonNode(person, 0, 1))}
                                          </div>
                                        </div>
                                      )}
                                    </DepartmentGroup>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Legacy layer-based view */}
                          <div className="mb-20">
                            <div className="text-sm font-semibold text-slate-600 mb-6 uppercase tracking-wide">
                              Executive Layer
                            </div>
                            <div className="flex justify-center gap-16 flex-wrap">
                              {executiveLayer.map((person, idx) => renderPersonNode(person, idx, executiveLayer.length))}
                              {missingRolesData.filter(m => m.layer === "executive").map((missing, idx) => 
                                renderMissingNode(missing, idx + executiveLayer.length, executiveLayer.length + 1)
                              )}
                            </div>
                          </div>

                          {executiveLayer.length > 0 && championLayer.length > 0 && (
                            <div className="relative h-12 mb-12">
                              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                              </svg>
                            </div>
                          )}

                          <div className="mb-20">
                            <div className="text-sm font-semibold text-slate-600 mb-6 uppercase tracking-wide">
                              Champion Layer
                            </div>
                            <div className="flex justify-center gap-16 flex-wrap">
                              {championLayer.map((person, idx) => renderPersonNode(person, idx, championLayer.length))}
                            </div>
                          </div>

                          {championLayer.length > 0 && userLayer.length > 0 && (
                            <div className="relative h-12 mb-12">
                              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                              </svg>
                            </div>
                          )}

                          <div className="mb-12">
                            <div className="text-sm font-semibold text-slate-600 mb-6 uppercase tracking-wide">
                              User Layer
                            </div>
                            <div className="flex justify-center gap-16 flex-wrap">
                              {userLayer.map((person, idx) => renderPersonNode(person, idx, userLayer.length))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Relationship Lines Overlay in Modal */}
                      {showRelationships && (
                        <RelationshipLines
                          relationships={relationships}
                          people={people}
                          onRelationshipClick={handleEditRelationship}
                        />
                      )}
                    </div>
                  </div>

                  {/* Detail Panel in Modal - Outside chart canvas and scroll container */}
                  {selectedPerson && (
                    <PeopleDetailPanel
                      person={selectedPerson}
                      onClose={() => setSelectedPersonId(null)}
                      onShowEvidence={() => setShowEvidenceSheet(true)}
                      onShowActionCreate={() => setShowActionCreateDrawer(true)}
                      onShowEdit={() => setShowEditDrawer(true)}
                      onShowConfirm={() => setShowConfirmDialog(true)}
                      onShowProjectLink={() => setShowProjectLinkSheet(true)}
                      onShowMerge={() => setShowMergeDialog(true)}
                    />
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            <div className="bg-white border rounded p-1.5 text-center">
              <div className="text-[10px] text-slate-600 mb-0.5">Confirmed</div>
              <div className="text-base font-semibold text-emerald-700">{confirmedCount}</div>
            </div>
            <div className="bg-white border rounded p-1.5 text-center">
              <div className="text-[10px] text-slate-600 mb-0.5">Proposed</div>
              <div className="text-base font-semibold text-blue-700">{proposedCount}</div>
            </div>
            <div className="bg-white border rounded p-1.5 text-center">
              <div className="text-[10px] text-slate-600 mb-0.5">Unresolved</div>
              <div className="text-base font-semibold text-amber-700">{unresolvedCount}</div>
            </div>
            <div className="bg-white border rounded p-1.5 text-center">
              <div className="text-[10px] text-slate-600 mb-0.5">No Contact</div>
              <div className="text-base font-semibold text-red-700">{noContactCount}</div>
            </div>
          </div>

          <div className="flex gap-1.5">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <SelectTrigger className="flex-1 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="structure">Structure View</SelectItem>
                <SelectItem value="influence">Influence View</SelectItem>
                <SelectItem value="coverage">Coverage View</SelectItem>
                <SelectItem value="evidence">Evidence View</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="flex-1 h-7 text-xs">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Decision Maker">Decision Maker</SelectItem>
                <SelectItem value="Champion">Champion</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart Canvas - Both horizontal and vertical scrolling */}
        <div className="flex-1 overflow-auto bg-slate-50 relative org-chart-canvas">
          <div className="p-8 min-h-full min-w-max">
            {groupByDepartment ? (
              <>
                {/* Executive Departments (上段) */}
                {executiveDepartments.length > 0 && (
                  <div className="mb-12">
                    <div className="text-xs font-semibold text-slate-600 mb-4 uppercase tracking-wide">
                      経営層
                    </div>
                    <div className="flex justify-center gap-6 flex-wrap">
                      {executiveDepartments.map(deptName => {
                        const layers = departmentGroups[deptName];
                        return (
                          <DepartmentGroup key={deptName} departmentName={deptName}>
                            {layers.executive.map((person) => renderPersonNode(person, 0, 1))}
                            {layers.champion.map((person) => renderPersonNode(person, 0, 1))}
                            {layers.user.map((person) => renderPersonNode(person, 0, 1))}
                          </DepartmentGroup>
                        );
                      })}
                      {missingRolesData.filter(m => m.layer === "executive").length > 0 && (
                        <DepartmentGroup departmentName="Missing Roles">
                          {missingRolesData.filter(m => m.layer === "executive").map((missing, idx) => 
                            renderMissingNode(missing, idx, missingRolesData.filter(m => m.layer === "executive").length)
                          )}
                        </DepartmentGroup>
                      )}
                    </div>
                  </div>
                )}

                {/* Business Divisions (下段：横並び) */}
                {businessDivisions.length > 0 && (
                  <div className="mb-8">
                    <div className="text-xs font-semibold text-slate-600 mb-4 uppercase tracking-wide">
                      事業部
                    </div>
                    <div className="flex justify-center gap-6 flex-wrap">
                      {businessDivisions.map(deptName => {
                        const layers = departmentGroups[deptName];
                        return (
                          <DepartmentGroup key={deptName} departmentName={deptName}>
                            {/* Executive Layer */}
                            {layers.executive.length > 0 && (
                              <div className="mb-2">
                                <div className="text-[9px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Executive</div>
                                <div className="space-y-2">
                                  {layers.executive.map((person) => renderPersonNode(person, 0, 1))}
                                </div>
                              </div>
                            )}
                            {/* Champion Layer */}
                            {layers.champion.length > 0 && (
                              <div className="mb-2">
                                <div className="text-[9px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Champion</div>
                                <div className="space-y-2">
                                  {layers.champion.map((person) => renderPersonNode(person, 0, 1))}
                                </div>
                              </div>
                            )}
                            {/* User Layer */}
                            {layers.user.length > 0 && (
                              <div>
                                <div className="text-[9px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">User</div>
                                <div className="space-y-2">
                                  {layers.user.map((person) => renderPersonNode(person, 0, 1))}
                                </div>
                              </div>
                            )}
                          </DepartmentGroup>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Legacy layer-based view */}
                <div className="mb-12">
                  <div className="text-xs font-semibold text-slate-600 mb-4 uppercase tracking-wide">
                    Executive Layer
                  </div>
                  <div className="flex justify-center gap-12 flex-wrap">
                    {executiveLayer.map((person, idx) => renderPersonNode(person, idx, executiveLayer.length))}
                    {missingRolesData.filter(m => m.layer === "executive").map((missing, idx) => 
                      renderMissingNode(missing, idx + executiveLayer.length, executiveLayer.length + 1)
                    )}
                  </div>
                </div>

                {executiveLayer.length > 0 && championLayer.length > 0 && (
                  <div className="relative h-6 mb-6">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                    </svg>
                  </div>
                )}

                <div className="mb-12">
                  <div className="text-xs font-semibold text-slate-600 mb-4 uppercase tracking-wide">
                    Champion Layer
                  </div>
                  <div className="flex justify-center gap-12 flex-wrap">
                    {championLayer.map((person, idx) => renderPersonNode(person, idx, championLayer.length))}
                  </div>
                </div>

                {championLayer.length > 0 && userLayer.length > 0 && (
                  <div className="relative h-6 mb-6">
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
                    </svg>
                  </div>
                )}

                <div className="mb-8">
                  <div className="text-xs font-semibold text-slate-600 mb-4 uppercase tracking-wide">
                    User Layer
                  </div>
                  <div className="flex justify-center gap-12 flex-wrap">
                    {userLayer.map((person, idx) => renderPersonNode(person, idx, userLayer.length))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Relationship Lines Overlay */}
          {showRelationships && (
            <RelationshipLines
              relationships={relationships}
              people={people}
              onRelationshipClick={handleEditRelationship}
            />
          )}
        </div>
      </div>

      {/* Detail Panel in Normal View - Outside chart canvas for better visibility */}
      {selectedPerson && (
        <PeopleDetailPanel
          person={selectedPerson}
          onClose={() => setSelectedPersonId(null)}
          onShowEvidence={() => setShowEvidenceSheet(true)}
          onShowActionCreate={() => setShowActionCreateDrawer(true)}
          onShowEdit={() => setShowEditDrawer(true)}
          onShowConfirm={() => setShowConfirmDialog(true)}
          onShowProjectLink={() => setShowProjectLinkSheet(true)}
          onShowMerge={() => setShowMergeDialog(true)}
        />
      )}

      {/* All Modals/Sheets/Dialogs */}
      <PeopleOrgChartModals
        selectedPerson={selectedPerson}
        selectedMissingRole={selectedMissingRole}
        showEvidenceSheet={showEvidenceSheet}
        showConfirmDialog={showConfirmDialog}
        showEditDrawer={showEditDrawer}
        showMergeDialog={showMergeDialog}
        showProjectLinkSheet={showProjectLinkSheet}
        showActionCreateDrawer={showActionCreateDrawer}
        showMissingRoleSheet={showMissingRoleSheet}
        setShowEvidenceSheet={setShowEvidenceSheet}
        setShowConfirmDialog={setShowConfirmDialog}
        setShowEditDrawer={setShowEditDrawer}
        setShowMergeDialog={setShowMergeDialog}
        setShowProjectLinkSheet={setShowProjectLinkSheet}
        setShowActionCreateDrawer={setShowActionCreateDrawer}
        setShowMissingRoleSheet={setShowMissingRoleSheet}
      />

      {/* Relationship Editor */}
      <RelationshipEditor
        open={showRelationshipEditor}
        onOpenChange={setShowRelationshipEditor}
        relationship={editingRelationship}
        people={people.map(p => ({ id: p.id, name: p.name, role: p.roleType }))}
        onSave={handleSaveRelationship}
        onDelete={handleDeleteRelationship}
      />
    </div>
  );
}