import { redirect } from "next/navigation";

// /companies/list → /companies に統合
export default function CompanyListLegacyPage() {
  redirect("/companies");
}
