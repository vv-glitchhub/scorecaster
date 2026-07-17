import { cleanText, getRequestId, jsonResponse, readJsonBody } from "../../../lib/api-security";
import { buildIntelligenceReadiness } from "../../../lib/intelligence-readiness.mjs";
import { fetchNewsForMatch } from "../../../lib/news-fetcher";
import { fetchInjuriesForMatch } from "../../../lib/injury-fetcher";
import { fetchLineupForMatch } from "../../../lib/lineup-fetcher";

export const dynamic = "force-dynamic";

function normalizeInput(data = {}) {
  const homeTeam = cleanText(data.homeTeam, 120);
  const awayTeam = cleanText(data.awayTeam, 120);
  const sport = cleanText(data.sport, 120);
  const league = cleanText(data.league, 120);

  if (!homeTeam || !awayTeam || !sport) return null;
  if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return null;
  return { homeTeam, awayTeam, sport, league };
}

export async function POST(request) {
  const requestId = getRequestId(request);
  const parsed = await readJsonBody(request, 8192);
  if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, parsed.status, requestId);

  const match = normalizeInput(parsed.data);
  if (!match) return jsonResponse({ ok: false, error: "Invalid match input" }, 400, requestId);

  const [news, injuries, lineup] = await Promise.all([
    fetchNewsForMatch(match),
    fetchInjuriesForMatch(match),
    fetchLineupForMatch(match)
  ]);

  const intelligence = { news, injuries, lineup };
  const readiness = buildIntelligenceReadiness(intelligence);

  return jsonResponse({
    ok: true,
    generatedAt: new Date().toISOString(),
    match,
    readiness,
    intelligence,
    paperOnly: true
  }, 200, requestId);
}
