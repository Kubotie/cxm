import { createBrowserRouter } from "react-router";
import { Console } from "./pages/console";
import { CSMHome } from "./pages/csm-home";
import { Projects } from "./pages/projects";
import { Project } from "./pages/project";
import { Audience } from "./pages/audience";
import { AudienceDetail } from "./pages/audience-detail";
import { Inbox } from "./pages/inbox";
import { Library } from "./pages/library";
import { CompanyDetail } from "./pages/company-detail";
import { EvidenceInbox } from "./pages/evidence-inbox";
import { AlertQueue } from "./pages/alert-queue";
import { ActionReview } from "./pages/action-review";
import { ContentJobs } from "./pages/content-jobs";
import { GovernanceAudit } from "./pages/governance-audit";
import { Knowledge } from "./pages/knowledge";
import { Settings } from "./pages/settings";
import { UnifiedCompanyLog } from "./pages/unified-company-log";
import { ProjectDetail } from "./pages/project-detail";
import { ProjectsPortfolio } from "./pages/projects-portfolio";
import { AudienceWorkspace } from "./pages/audience-workspace";
import { OutboundList } from "./pages/outbound-list";
import { OutboundEditor } from "./pages/outbound-editor";
import { OutboundResult } from "./pages/outbound-result";
import { EventList } from "./pages/event-list";
import { EventDetail } from "./pages/event-detail";
import { EventCalendar } from "./pages/event-calendar";
import { SupportHomeNew } from "./pages/support-home-new";
import { SupportQueue } from "./pages/support-queue";
import { SupportDetail } from "./pages/support-detail";
import { SupportAnalytics } from "./pages/support-analytics";
import { AutomationList } from "./pages/automation-list";
import { AutomationBuilder } from "./pages/automation-builder";
import { AutomationDetail } from "./pages/automation-detail";
import { AutomationRuns } from "./pages/automation-runs";

function ErrorBoundary() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">エラーが発生しました</h1>
        <p className="text-slate-600 mb-4">ページの読み込み中に問題が発生しました。</p>
        <a href="/" className="text-blue-600 hover:underline">
          ホームに戻る
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Console />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/companies",
    element: <CSMHome />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/projects",
    element: <Projects />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/project/:projectId",
    element: <Project />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/audience",
    element: <Audience />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/audience/detail",
    element: <AudienceDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/company/:companyId",
    element: <CompanyDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/company/:companyId/log",
    element: <UnifiedCompanyLog />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/inbox",
    element: <Inbox />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/evidence",
    element: <EvidenceInbox />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/actions",
    element: <ActionReview />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/content",
    element: <ContentJobs />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/outbound",
    element: <OutboundList />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/outbound/compose",
    element: <OutboundEditor />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/outbound/editor/:id",
    element: <OutboundEditor />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/outbound/:id/edit",
    element: <OutboundEditor />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/outbound/:id/result",
    element: <OutboundResult />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/governance",
    element: <GovernanceAudit />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/library",
    element: <Library />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/settings",
    element: <Settings />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/events",
    element: <EventList />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/events/:eventId",
    element: <EventDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/events/calendar",
    element: <EventCalendar />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/support",
    element: <SupportHomeNew />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/support/queue",
    element: <SupportQueue />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/support/analytics",
    element: <SupportAnalytics />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/support/:id",
    element: <SupportDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/automation",
    element: <AutomationList />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/automation/new",
    element: <AutomationBuilder />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/automation/:id",
    element: <AutomationDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/automation/:id/runs",
    element: <AutomationRuns />,
    errorElement: <ErrorBoundary />,
  },
]);