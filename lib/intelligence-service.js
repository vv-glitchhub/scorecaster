import { buildSportsIntelligenceReport } from "./sports-intelligence-v1.mjs";

function resolveOrigin(origin) {
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

function providersConfigured() {
  return Boolean(
    process.env.NEWS_API_KEY ||
    process.env.SPORTSDATA_API_KEY ||
    (process.env.LINEUP_API_URL && process.env.LINEUP_API_KEY)
  );
}

function unavailable(match = {}) {
  const intelligence = {
    news: { ok: true, mode: "not_configured", source: "news-provider", data: [] },
    injuries: { ok: true, mode: "not_configured", source: "injury-provider", data: [] },
    lineup: { ok: true, mode: "not_configured", source: "lineup-provider", data: { teams: [] } }
  };

  return {
    intelligence,
    report: buildSportsIntelligenceReport({ match, intelligence })
  };
}

export async function loadIntelligenceForMatch({
  homeTeam,
  awayTeam,
  sport,
  league,
  commenceTime,
  eventId,
  origin
}) {
  const match = { homeTeam, awayTeam, sport, league, commenceTime, eventId };
  if (!providersConfigured()) return unavailable(match);

  const baseOrigin = resolveOrigin(origin);
  const url = baseOrigin ? `${baseOrigin}/api/intelligence` : "/api/intelligence";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(match),
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) return unavailable(match);
    const data = await response.json();
    if (data?.ok !== true || !data?.intelligence || !data?.report) return unavailable(match);

    return {
      intelligence: data.intelligence,
      report: data.report
    };
  } catch {
    return unavailable(match);
  }
}
