import { NextResponse } from "next/server";
import { fetchNewsForMatch } from "../../../lib/news-fetcher";

export async function GET() {
  const result = await fetchNewsForMatch({
    homeTeam: "Carolina Hurricanes",
    awayTeam: "Vegas Golden Knights",
    sport: "NHL",
    league: "NHL"
  });

  return NextResponse.json(result);
}
