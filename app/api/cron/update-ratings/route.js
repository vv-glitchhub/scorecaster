import { normalizeFootballPlayersFromFeed } from "../../../../lib/data-normalizers/football";
import { updateFootballRatingsFromStructuredPlayers } from "../../../../lib/rating-update-engine";

async function fetchStructuredStatsFeed() {
  const url = process.env.STATS_FEED_URL;
  const token = process.env.STATS_FEED_TOKEN;

  if (!url) {
    throw new Error("Missing STATS_FEED_URL");
  }

  const res = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Stats feed failed with HTTP ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data.players)) {
    throw new Error("Stats feed must return { players: [...] }");
  }

  return data.players;
}

async function runRatingsUpdate() {
  const rawPlayers = await fetchStructuredStatsFeed();
  const players = normalizeFootballPlayersFromFeed(rawPlayers);
  return updateFootballRatingsFromStructuredPlayers(players, "vercel_cron");
}

async function runCollector(req, cronSecret) {
  const origin = new URL(req.url).origin;
  const response = await fetch(`${origin}/api/internal/collector`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(110_000),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Collector failed with HTTP ${response.status}`);
  }
  return payload;
}

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [ratingsResult, collectorResult] = await Promise.allSettled([
    runRatingsUpdate(),
    runCollector(req, cronSecret),
  ]);

  const ratings = ratingsResult.status === "fulfilled"
    ? { ok: true, data: ratingsResult.value }
    : { ok: false, error: String(ratingsResult.reason) };

  const collector = collectorResult.status === "fulfilled"
    ? { ok: true, data: collectorResult.value }
    : { ok: false, error: String(collectorResult.reason) };

  const ok = ratings.ok || collector.ok;
  return Response.json(
    {
      ok,
      version: "scorecaster-daily-maintenance-v2",
      ratings,
      collector,
    },
    { status: ok ? 200 : 500 }
  );
}
