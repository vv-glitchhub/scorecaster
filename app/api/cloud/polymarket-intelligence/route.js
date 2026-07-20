import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse
} from "../../../../lib/api-security";
import { fetchPolymarketForMatch } from "../../../../lib/polymarket-fetcher.js";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = new Set(["home", "away", "sport", "league", "commenceTime"]);

function readMatch(searchParams) {
  const homeTeam = cleanText(searchParams.get("home"), 120);
  const awayTeam = cleanText(searchParams.get("away"), 120);
  const sport = cleanText(searchParams.get("sport"), 120);
  const league = cleanText(searchParams.get("league"), 120);
  const commenceTime = cleanText(searchParams.get("commenceTime"), 80);

  if (!homeTeam || !awayTeam) return { ok: false, error: "Home and away teams are required" };
  if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return { ok: false, error: "Teams must be different" };
  if (commenceTime && !Number.isFinite(Date.parse(commenceTime))) return { ok: false, error: "Invalid commence time" };
  return {
    ok: true,
    match: {
      homeTeam,
      awayTeam,
      sport,
      league,
      commenceTime: commenceTime || null
    }
  };
}

export async function GET(request) {
  const requestId = getRequestId(request);
  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "polymarket_intelligence",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const unknownKeys = [...url.searchParams.keys()].filter((key) => !ALLOWED_KEYS.has(key));
  if (unknownKeys.length) {
    return jsonResponse({ ok: false, error: "Unsupported query parameter" }, 400, requestId);
  }

  const input = readMatch(url.searchParams);
  if (!input.ok) return jsonResponse({ ok: false, error: input.error }, 400, requestId);

  const result = await fetchPolymarketForMatch(input.match);
  return jsonResponse({
    ...result,
    paperOnly: true,
    decisionUse: "downgrade-only",
    probabilityAdjusted: false,
    officialScoreSource: false
  }, result.ok ? 200 : result.mode === "invalid_input" ? 400 : 502, requestId);
}
