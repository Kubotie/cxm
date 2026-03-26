import { createBrowserRouter, Navigate } from "react-router";
import { Console } from "./pages/console";
import { CompanyDetail } from "./pages/company-detail";
import { UnifiedCompanyLog } from "./pages/unified-company-log";
import { SupportHome } from "./pages/support-home";
import { SupportQueue } from "./pages/support-queue";
import { SupportDetail } from "./pages/support-detail";
import { SupportAnalytics } from "./pages/support-analytics";

function ErrorBoundary() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">エラーが発生しました</h1>
        <p className="text-slate-600 mb-4">ページの読み込み中に問題が発生しました。</p>
        <a href="/console" className="text-blue-600 hover:underline">
          Consoleに戻る
        </a>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/console" replace />,
  },
  {
    path: "/console",
    element: <Console />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/companies/:companyId",
    element: <CompanyDetail />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/companies/:companyId/log",
    element: <UnifiedCompanyLog />,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/support",
    element: <SupportHome />,
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
]);
