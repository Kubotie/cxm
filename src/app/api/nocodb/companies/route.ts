import { NextRequest, NextResponse } from "next/server";
import { fetchAllCompanies, fetchCompanyByUid } from "@/lib/nocodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");

  try {
    if (uid) {
      const company = await fetchCompanyByUid(uid);
      return NextResponse.json(company);
    }
    const limit = Number(searchParams.get("limit") ?? "50");
    const owner = searchParams.get("owner") ?? undefined;
    const companies = await fetchAllCompanies(limit, owner);
    return NextResponse.json(companies);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
