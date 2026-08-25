import { normalizeFootballPlayersFromFeed } from "../../../../lib/data-normalizers/football";
import { updateFootballRatingsFromStructuredPlayers } from "../../../../lib/rating-update-engine";
import { GET as runSelfDataEngineRoute } from "../../internal/self-data-engine/route";

async function fetchStructuredStatsFeed() {
  const url = process.env.STATS_FEED_URL;
  const token = process.env.STATS_FEED_TOKEN;
  if (!url) return null;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Stats feed failed with HTTP ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data.players)) throw new Error("Stats feed must return { players: [...] }");
  return data.players;
}

async function runRatingsUpdate() {
  const rawPlayers = await fetchStructuredStatsFeed();
  if (!rawPlayers) {
    return {
      ok: true,
      skipped: true,
      reason: "optional-stats-feed-not-configured",
      productionDecisionBlocked: false,
    };
  }
  const players = normalizeFootballPlayersFromFeed(rawPlayers);
  const result = await updateFootballRatingsFromStructuredPlayers(players, "vercel_cron");
  return { ok: true, skipped: false, result };
}

async function runSelfDataEngine(req) {
  const routeResponse = await runSelfDataEngineRoute(req);
  const responseText = await routeResponse.text();
  let payload = null;
  if (responseText) {
    try { payload = JSON.parse(responseText); }
    catch { payload = { rawResponse: responseText.slice(0, 1000) }; }
  }

  if (!routeResponse.ok || payload?.ok === false) {
    const detail = payload?.error || payload?.status || `HTTP ${routeResponse.status}`;
    throw new Error(`Self Data Engine failed: ${detail}`);
  }
  if (!payload?.runId) throw new Error("Self Data Engine returned without a runId");
  return payload;
}

function settledResult(result) {
  return result.status === "fulfilled"
    ? { ok: true, data: result.value }
    : { ok: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
}

export async function GET(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // The self-data engine is the primary maintenance path. Optional licensed
  // player feeds enrich ratings when configured, but their absence must never
  // stop Scorecaster from collecting its own point-in-time dataset.
  const [selfDataResult, ratingsResult] = await Promise.allSettled([
    runSelfDataEngine(req),
    runRatingsUpdate(),
  ]);

  const selfDataEngine = settledResult(selfDataResult);
  const ratings = settledResult(ratingsResult);
  const ok = selfDataEngine.ok && ratings.ok;

  return Response.json({
    ok,
    version: "scorecaster-daily-maintenance-v6",
    primaryPipeline: "self-data-engine-v1",
    selfDataEngine,
    ratings,
    autonomousCollection: true,
    pointInTimeFeatures: true,
    realMoneyActionAvailable: false,
    paperOnly: true,
  }, { status: ok ? 200 : 500 });
}
