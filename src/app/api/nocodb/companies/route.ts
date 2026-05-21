import { NextRequest, NextResponse } from "next/server";
import { fetchAllCompanies, fetchCompanyByUid, fetchCompaniesByUids } from "@/lib/nocodb";
import { fetchAllChannelCompanyUids } from "@/lib/nocodb/company-channels";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid     = searchParams.get("uid");
  const outbound = searchParams.get("outbound") === "true";

  try {
    if (uid) {
      const company = await fetchCompanyByUid(uid);
      return NextResponse.json(company);
    }

    const limit = Number(searchParams.get("limit") ?? "50");
    const owner = searchParams.get("owner") ?? undefined;
    const csmCompanies = await fetchAllCompanies(limit, owner);

    if (!outbound) {
      return NextResponse.json(csmCompanies);
    }

    // outbound=true: CSM管理企業 + Slack/Chatworkチャンネル登録企業をマージ
    const csmUidSet = new Set(csmCompanies.map(c => c.id));
    const channelUids = await fetchAllChannelCompanyUids();
    const extraUids = channelUids.filter(uid => !csmUidSet.has(uid));
    const extraCompanies = await fetchCompaniesByUids(extraUids);

    // CSM企業を先頭に、チャンネルのみ企業を名前順で後続
    const merged = [
      ...csmCompanies,
      ...extraCompanies.sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    ];
    return NextResponse.json(merged);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
