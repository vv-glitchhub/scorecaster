import { loadSportsIntelligence } from "./sports-intelligence-service";
import { buildSportsIntelligenceReport } from "./sports-intelligence-v1.mjs";

function unavailable(match = {}) {
  const intelligence = {
    news: { ok: true, mode: "unavailable", source: "news-provider", data: [] },
    injuries: { ok: true, mode: "unavailable", source: "injury-provider", data: [] },
    lineup: { ok: true, mode: "unavailable", source: "lineup-provider", data: { teams: [] } }
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
  eventId
}) {
  const match = { homeTeam, awayTeam, sport, league, commenceTime, eventId };

  try {
    const result = await loadSportsIntelligence(match);
    if (!result?.ok || !result.intelligence || !result.report) return unavailable(match);
    return {
      intelligence: result.intelligence,
      report: result.report,
      cached: Boolean(result.cached),
      generatedAt: result.generatedAt || null
    };
  } catch {
    return unavailable(match);
  }
}
