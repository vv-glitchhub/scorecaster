import {
  buildHistoricalOddsSnapshotsFromGames,
  mergeHistoricalOddsSnapshots,
  summarizeHistoricalOddsCollection
} from "../../../lib/historical-odds-scheduler";
import { analyzeHistoricalOddsMovement } from "../../../lib/historical-odds-engine";

const DEFAULT_LEAGUE = "icehockey_nhl";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const sport = url.searchParams.get("sport") || DEFAULT_LEAGUE;
    const marketKey = url.searchParams.get("market") || "h2h";
    const selection = url.searchParams.get("selection") || null;

    const response = await fetch(
      `${url.origin}/api/odds?sport=${sport}&markets=${marketKey}`,
      { cache: "no-store" }
    );

    const data = await response.json();
    const games = Array.isArray(data) ? data : data?.data || data?.games || data?.events || [];

    const snapshots = buildHistoricalOddsSnapshotsFromGames({
      games,
      marketKey
    });

    const merged = mergeHistoricalOddsSnapshots({
      existing: [],
      incoming: snapshots
    });

    const summary = summarizeHistoricalOddsCollection(merged);
    const movement = analyzeHistoricalOddsMovement({
      snapshots: merged,
      selection
    });

    return Response.json({
      ok: true,
      source: "historical-odds-api-v1",
      sport,
      marketKey,
      summary,
      movement,
      sample: merged.slice(0, 20)
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        source: "historical-odds-api-v1",
        error: error.message
      },
      { status: 500 }
    );
  }
}
