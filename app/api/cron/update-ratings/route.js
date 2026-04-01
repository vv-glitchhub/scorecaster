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

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const rawPlayers = await fetchStructuredStatsFeed();
    const players = normalizeFootballPlayersFromFeed(rawPlayers);

    const result = await updateFootballRatingsFromStructuredPlayers(
      players,
      "vercel_cron"
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
