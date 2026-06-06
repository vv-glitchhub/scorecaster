import { NextResponse } from "next/server";
import { sportsDataGet } from "../../../lib/sportsdata-fetcher";

const pathsToTest = [
  "/v3/nfl/scores/json/Standings/2025",
  "/v3/nfl/scores/json/Teams",
  "/v3/nfl/scores/json/Players",
  "/v3/nfl/scores/json/Injuries",
  "/v3/nfl/scores/json/Schedules/2025",
  "/v3/nfl/scores/json/Scores/2025",
  "/v3/nfl/scores/json/PlayerSeasonStats/2025"
];

export async function GET() {
  const results = [];

  for (const path of pathsToTest) {
    const result = await sportsDataGet(path);

    results.push({
      path,
      ok: result.ok,
      status: result.status,
      mode: result.mode,
      error: result.error,
      sample: Array.isArray(result.data)
        ? result.data.slice(0, 2)
        : result.data
    });
  }

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    results
  });
}
