import {
  cleanText,
  enforceRateLimit,
  getAuthenticatedContext,
  getRequestId,
  jsonResponse,
  mutationOriginAllowed,
  readJsonBody
} from "../../../lib/api-security";
import { loadIntelligenceForMatch } from "../../../lib/intelligence-service";
import { SPORTS } from "../../../lib/sports.js";
import { buildVerifiedSportsIntelligence } from "../../../lib/verified-sports-intelligence.mjs";

export const dynamic = "force-dynamic";

const SUPPORTED_SPORTS = new Set(SPORTS.flatMap((group) => group.leagues.map((league) => league.key)));

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!mutationOriginAllowed(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const auth = await getAuthenticatedContext(request);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status, requestId);
  }

  const limited = await enforceRateLimit(auth, requestId, {
    bucket: "verified_sports_intelligence",
    limit: 20,
    windowSeconds: 300
  });
  if (limited) return limited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) {
    return jsonResponse({ ok: false, error: body.error }, body.status, requestId);
  }

  const homeTeam = cleanText(body.data?.homeTeam, 160);
  const awayTeam = cleanText(body.data?.awayTeam, 160);
  const sport = cleanText(body.data?.sport, 120);
  const league = cleanText(body.data?.league, 120);
  const commenceTime = cleanText(body.data?.commenceTime, 80);

  if (!homeTeam || !awayTeam || homeTeam.toLowerCase() === awayTeam.toLowerCase()) {
    return jsonResponse({ ok: false, error: "Distinct home and away teams are required" }, 400, requestId);
  }
  if (!SUPPORTED_SPORTS.has(sport)) {
    return jsonResponse({ ok: false, error: "A supported sport key is required" }, 400, requestId);
  }
  if (commenceTime && Number.isNaN(Date.parse(commenceTime))) {
    return jsonResponse({ ok: false, error: "A valid kickoff timestamp is required" }, 400, requestId);
  }

  const raw = await loadIntelligenceForMatch({ homeTeam, awayTeam, sport, league });
  const report = buildVerifiedSportsIntelligence({
    news: raw.news,
    injuries: raw.injuries,
    lineup: raw.lineup,
    externalMarkets: raw.polymarket,
    commenceTime: commenceTime || null
  });

  return jsonResponse({
    ok: true,
    paperOnly: true,
    generatedAt: new Date().toISOString(),
    probabilityAdjusted: false,
    report
  }, 200, requestId);
}
