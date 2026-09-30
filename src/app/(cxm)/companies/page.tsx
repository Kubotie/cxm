import { Suspense } from "react";
import { CompanyList } from "@/components/pages/company-list";
import { Skeleton } from "@/components/ui/skeleton";

function CompanyListSkeleton() {
  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-14 shrink-0 bg-white border-r border-slate-100" />
      <div className="flex-1 p-6 space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={<CompanyListSkeleton />}>
      <CompanyList />
    </Suspense>
  );
}
