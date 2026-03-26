import { NextRequest, NextResponse } from "next/server";
import { fetchPeople } from "@/lib/nocodb";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyUid = searchParams.get("companyUid");

  if (!companyUid) {
    return NextResponse.json({ error: "companyUid is required" }, { status: 400 });
  }

  try {
    const people = await fetchPeople(companyUid);
    return NextResponse.json(people);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
