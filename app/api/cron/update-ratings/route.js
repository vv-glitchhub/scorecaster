import { normalizeFootballPlayersFromFeed } from "../../../../lib/data-normalizers/football";
import { updateFootballRatingsFromStructuredPlayers } from "../../../../lib/rating-update-engine";
import { GET as runCollectorRoute } from "../../internal/collector/route";

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

async function runCollector(req) {
  console.log("[daily-maintenance] Running collector directly");

  const response = await runCollectorRoute(req);
  const responseText = await response.text();
  let payload = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { rawResponse: responseText.slice(0, 1000) };
    }
  }

  console.log("[daily-maintenance] Direct collector response", {
    status: response.status,
    payload,
  });

  if (!response.ok) {
    const detail = payload?.error || payload?.message || `HTTP ${response.status}`;
    throw new Error(`Collector failed: ${detail}`);
  }

  if (!payload || payload.ok !== true) {
    const detail = payload?.error || payload?.status || payload?.rawResponse || "invalid collector response";
    throw new Error(`Collector returned an unsuccessful response: ${detail}`);
  }

  if (!payload.runId) {
    throw new Error("Collector returned HTTP 200 without a runId");
  }

  if (!["success", "partial"].includes(payload.status)) {
    throw new Error(`Collector returned invalid status: ${payload.status || "missing"}`);
  }

  return payload;
}

function settledResult(result) {
  return result.status === "fulfilled"
    ? { ok: true, data: result.value }
    : {
        ok: false,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
}

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[daily-maintenance] CRON_SECRET is not configured");
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error("[daily-maintenance] Unauthorized cron request");
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  console.log("[daily-maintenance] Starting ratings update and direct collector");

  const [ratingsResult, collectorResult] = await Promise.allSettled([
    runRatingsUpdate(),
    runCollector(req),
  ]);

  const ratings = settledResult(ratingsResult);
  const collector = settledResult(collectorResult);

  if (!ratings.ok) {
    console.error("[daily-maintenance] Ratings update failed:", ratings.error);
  } else {
    console.log("[daily-maintenance] Ratings update completed");
  }

  if (!collector.ok) {
    console.error("[daily-maintenance] Collector failed:", collector.error);
  } else {
    console.log("[daily-maintenance] Collector completed", {
      runId: collector.data.runId,
      status: collector.data.status,
      recordsStored: collector.data.recordsStored,
      publishable: collector.data.publishable,
    });
  }

  const ok = ratings.ok && collector.ok;

  return Response.json(
    {
      ok,
      version: "scorecaster-daily-maintenance-v5",
      ratings,
      collector,
    },
    { status: ok ? 200 : 500 }
  );
}
