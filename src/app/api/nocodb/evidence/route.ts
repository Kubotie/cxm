import { NextRequest, NextResponse } from "next/server";
import { fetchEvidence, fetchLogEntries } from "@/lib/nocodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyUid = searchParams.get("companyUid");
  const asLog = searchParams.get("asLog") === "true";

  if (!companyUid) {
    return NextResponse.json({ error: "companyUid is required" }, { status: 400 });
  }

  try {
    const data = asLog
      ? await fetchLogEntries(companyUid)
      : await fetchEvidence(companyUid);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
