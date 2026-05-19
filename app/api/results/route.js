import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "icehockey";
  const league = searchParams.get("league") || "NHL";

  return NextResponse.json({
    ok: true,
    source: "placeholder-results",
    sport,
    league,
    message:
      "Result API placeholder. Seuraavaksi tähän kytketään oikea results provider.",
    results: [],
  });
}
