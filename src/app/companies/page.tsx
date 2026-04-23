import { Suspense } from "react";
import { CompanyList } from "@/components/pages/company-list";

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompanyList />
    </Suspense>
  );
}
