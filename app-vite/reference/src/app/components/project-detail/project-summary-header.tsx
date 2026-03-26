import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Building2, TrendingUp, Users, AlertTriangle, Target, FileText, ArrowLeft, Layers, Calendar, ArrowRight, Headphones } from "lucide-react";
import { Link, useSearchParams } from "react-router";

export function ProjectSummaryHeader() {
  const [searchParams] = useSearchParams();
  const fromAudience = searchParams.get("from") === "audience";
  const clusterId = searchParams.get("cluster");
  const fromProjects = searchParams.get("from") === "projects";
  // Mock data
  const projectData = {
    project_name: "株式会社サンプル - マーケティングチーム",
    project_id: "proj_abc123",
    linked_company: "株式会社サンプル",
    company_uid: "comp_xyz789",
    a_phase: "Champion Layer",
    phase_source: "External Analytics",
    healthy_score: 78,
    breadth_score: 65,
    depth_score: 82,
    l30_active: 24,
    open_alerts: 3,
    open_actions: 7,
    unresolved_evidence: 12,
    user_count: 28,
    domain: "sample.co.jp",
    tier: "Enterprise",
    customer_type: "Direct",
    total_mrr: 450000,
  };

  // このProjectに関連するEvent
  const relatedEvents = [
    {
      id: "evt_1",
      name: "Q2製品アップデート案内",
      type: "Product Update",
      status: "active",
      startDate: "2026-04-01",
      endDate: "2026-04-30",
      sent: true,
    },
  ];

  // このProjectに関連するSupport
  const relatedSupport = [
    {
      id: "sup_2",
      title: "API連携設定エラー",
      caseType: "Support",
      severity: "medium",
      routingStatus: "in progress",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white border-b px-6 py-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-900">
              {projectData.project_name}
            </h1>
            <Badge variant="outline" className="text-xs">
              Project
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
              {projectData.a_phase}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-slate-600">
            {projectData.linked_company && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{projectData.linked_company}</span>
              </div>
            )}
            <span className="text-slate-400">•</span>
            <span>{projectData.domain}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(fromAudience || fromProjects) && (
            <>
              {fromProjects && (
                <Link to="/projects">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Project Top
                  </Button>
                </Link>
              )}
              {fromAudience && clusterId && (
                <Link to={`/audience?cluster=${clusterId}`}>
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2">
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Audience Workspace
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* Compact Metrics Grid */}
      <div className="grid grid-cols-8 gap-2">
        {/* Health Scores */}
        <div className="bg-slate-50 rounded p-2">
          <p className="text-xs text-slate-600 mb-0.5">Health</p>
          <p className={`text-lg font-semibold ${getScoreColor(projectData.healthy_score)}`}>
            {projectData.healthy_score}
          </p>
        </div>

        <div className="bg-slate-50 rounded p-2">
          <p className="text-xs text-slate-600 mb-0.5">Breadth</p>
          <p className={`text-lg font-semibold ${getScoreColor(projectData.breadth_score)}`}>
            {projectData.breadth_score}
          </p>
        </div>

        <div className="bg-slate-50 rounded p-2">
          <p className="text-xs text-slate-600 mb-0.5">Depth</p>
          <p className={`text-lg font-semibold ${getScoreColor(projectData.depth_score)}`}>
            {projectData.depth_score}
          </p>
        </div>

        {/* Activity */}
        <div className="bg-slate-50 rounded p-2">
          <p className="text-xs text-slate-600 mb-0.5">L30 Active</p>
          <p className="text-lg font-semibold text-slate-900">{projectData.l30_active}</p>
        </div>

        {/* Alerts & Actions */}
        <div className="bg-orange-50 rounded p-2 border border-orange-200">
          <div className="flex items-center gap-1 mb-0.5">
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            <p className="text-xs text-orange-700">Alerts</p>
          </div>
          <p className="text-lg font-semibold text-orange-700">{projectData.open_alerts}</p>
        </div>

        <div className="bg-blue-50 rounded p-2 border border-blue-200">
          <div className="flex items-center gap-1 mb-0.5">
            <Target className="w-3 h-3 text-blue-600" />
            <p className="text-xs text-blue-700">Actions</p>
          </div>
          <p className="text-lg font-semibold text-blue-700">{projectData.open_actions}</p>
        </div>

        <div className="bg-slate-50 rounded p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <FileText className="w-3 h-3 text-slate-600" />
            <p className="text-xs text-slate-600">Evidence</p>
          </div>
          <p className="text-lg font-semibold text-slate-900">{projectData.unresolved_evidence}</p>
        </div>

        <div className="bg-slate-50 rounded p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Users className="w-3 h-3 text-slate-600" />
            <p className="text-xs text-slate-600">Users</p>
          </div>
          <p className="text-lg font-semibold text-slate-900">{projectData.user_count}</p>
        </div>
      </div>

      {/* Unified Context Banner (Events + Support) */}
      {(relatedEvents.length > 0 || relatedSupport.length > 0) && (
        <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-orange-50 border-t mt-2 pt-2">
          <div className="flex items-center gap-6">
            {/* Related Events */}
            {relatedEvents.length > 0 && (
              <div className={`flex items-center gap-2 ${relatedSupport.length > 0 ? 'flex-1' : ''}`}>
                <Calendar className="w-3 h-3 text-purple-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-purple-900">Event:</span>
                <div className="flex items-center gap-2">
                  {relatedEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-1.5 text-xs">
                      <Link
                        to={`/events/${event.id}`}
                        className="font-medium text-purple-700 hover:text-purple-900 hover:underline"
                      >
                        {event.name}
                      </Link>
                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200 h-4">
                        {event.type}
                      </Badge>
                      {event.sent && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs h-4">配信済</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relatedEvents.length > 0 && relatedSupport.length > 0 && (
              <div className="h-4 w-px bg-slate-300" />
            )}

            {/* Related Support */}
            {relatedSupport.length > 0 && (
              <div className={`flex items-center gap-2 ${relatedEvents.length > 0 ? 'flex-1' : ''}`}>
                <Headphones className="w-3 h-3 text-orange-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-orange-900">Support:</span>
                <div className="flex items-center gap-2">
                  {relatedSupport.map((supportCase) => (
                    <div key={supportCase.id} className="flex items-center gap-1.5 text-xs">
                      <Link
                        to={`/support/${supportCase.id}`}
                        className="font-medium text-orange-700 hover:text-orange-900 hover:underline"
                      >
                        {supportCase.title}
                      </Link>
                      {supportCase.severity === "high" && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs h-4">High</Badge>
                      )}
                      {supportCase.severity === "medium" && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs h-4">Medium</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}