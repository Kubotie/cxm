import { NextRequest, NextResponse } from "next/server";
import { fetchAlerts } from "@/lib/nocodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyUid = searchParams.get("companyUid") ?? undefined;

  try {
    const alerts = await fetchAlerts(companyUid);
    return NextResponse.json(alerts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
