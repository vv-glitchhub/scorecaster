import { NextResponse } from "next/server";
import { sportsDataGet } from "../../../lib/sportsdata-fetcher";

const pathsToTest = [
  "/v3/nhl/scores/json/Teams",
  "/v3/nhl/scores/json/Injuries",
  "/v3/nhl/scores/json/Players",
  "/v3/nba/scores/json/Teams",
  "/v3/nba/scores/json/Injuries",
  "/v3/nfl/scores/json/Teams",
  "/v3/nfl/scores/json/Injuries"
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
