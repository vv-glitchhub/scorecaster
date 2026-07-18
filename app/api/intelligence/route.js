import { cleanText, getRequestId, jsonResponse, readJsonBody } from "../../../lib/api-security";
import { fetchNewsForMatch } from "../../../lib/news-fetcher";
import { fetchInjuriesForMatch } from "../../../lib/injury-fetcher";
import { fetchLineupForMatch } from "../../../lib/lineup-fetcher";
import { buildSportsIntelligenceReport } from "../../../lib/sports-intelligence-v1.mjs";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 500;
const cache = new Map();

function normalizeInput(data = {}) {
  const homeTeam = cleanText(data.homeTeam, 120);
  const awayTeam = cleanText(data.awayTeam, 120);
  const sport = cleanText(data.sport, 120);
  const league = cleanText(data.league, 120);
  const commenceTime = cleanText(data.commenceTime, 80);
  const eventId = cleanText(data.eventId, 160);

  if (!homeTeam || !awayTeam || !sport) return null;
  if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return null;
  if (commenceTime && !Number.isFinite(Date.parse(commenceTime))) return null;
  return {
    homeTeam,
    awayTeam,
    sport,
    league,
    commenceTime: commenceTime || null,
    eventId: eventId || null
  };
}

function cacheKey(match) {
  return [
    match.eventId || "no-event",
    match.sport,
    match.league,
    match.homeTeam,
    match.awayTeam
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

function readCache(key, now) {
  const value = cache.get(key);
  if (!value) return null;
  if (now - value.createdAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return value.payload;
}

function writeCache(key, payload, now) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt).slice(0, 50);
    oldest.forEach(([entryKey]) => cache.delete(entryKey));
  }
  cache.set(key, { createdAt: now, payload });
}

function sameOriginOrServerRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request) {
  const requestId = getRequestId(request);
  if (!sameOriginOrServerRequest(request)) {
    return jsonResponse({ ok: false, error: "Invalid request origin" }, 403, requestId);
  }

  const parsed = await readJsonBody(request, 8192);
  if (!parsed.ok) return jsonResponse({ ok: false, error: parsed.error }, parsed.status, requestId);

  const match = normalizeInput(parsed.data);
  if (!match) return jsonResponse({ ok: false, error: "Invalid match input" }, 400, requestId);

  const now = Date.now();
  const key = cacheKey(match);
  const cached = readCache(key, now);
  if (cached) {
    return jsonResponse({ ...cached, cached: true }, 200, requestId);
  }

  const [news, injuries, lineup] = await Promise.all([
    fetchNewsForMatch(match),
    fetchInjuriesForMatch(match),
    fetchLineupForMatch(match)
  ]);

  const intelligence = { news, injuries, lineup };
  const report = buildSportsIntelligenceReport({ match, intelligence, now });
  const payload = {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    match,
    report,
    readiness: report.readiness,
    intelligence,
    cached: false,
    paperOnly: true
  };
  writeCache(key, payload, now);

  return jsonResponse(payload, 200, requestId);
}
