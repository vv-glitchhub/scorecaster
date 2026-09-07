import { SPORTS } from "../../../lib/sports.js";

const SUPPORTED_LEAGUES = SPORTS.flatMap((group) => group.leagues.map((league) => ({
  key: league.key,
  group: group.group,
  title: league.title
})));
const SUPPORTED_KEYS = new Set(SUPPORTED_LEAGUES.map((league) => league.key));

function getFallbackSports() {
  return SUPPORTED_LEAGUES
    .filter((sport) => !String(sport.key).endsWith("_winner"))
    .map((sport) => ({
      key: sport.key,
      group: sport.group,
      title: sport.title,
      description: sport.title,
      active: true,
      has_outrights: false,
      fallback: true
    }));
}

function isAllowedSport(sport) {
  if (!sport?.active) return false;
  return SUPPORTED_KEYS.has(sport.key);
}

export async function GET() {
  try {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      return Response.json({
        fallback: true,
        data: getFallbackSports(),
        error: "Live sports discovery is not configured"
      });
    }

    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}`,
      { next: { revalidate: 60 * 60 } }
    );
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json({
        fallback: true,
        data: getFallbackSports(),
        error: data?.message || "Failed to fetch sports"
      });
    }

    const filtered = Array.isArray(data) ? data.filter(isAllowedSport) : [];
    return Response.json({
      fallback: false,
      supportedCount: SUPPORTED_KEYS.size,
      activeCount: filtered.length,
      data: filtered
    });
  } catch {
    return Response.json({
      fallback: true,
      data: getFallbackSports(),
      error: "Failed to fetch sports"
    });
  }
}
