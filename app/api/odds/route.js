import { NextResponse } from "next/server";
import { getLeagueById, getLeaguesForSport } from "@/lib/league-options";
import {
  hasBettingOdds,
  normalizeOddsApiEvent,
  normalizeSportsGameOddsEvent,
  uniqueMatches,
} from "@/lib/odds-normalizer";

export const dynamic = "force-dynamic";

const memoryCache = new Map();
const CACHE_MS = 1000 * 60 * 10;

function cacheKey(params) {
  return JSON.stringify(params);
}

function getCached(key) {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (Date.now() - item.createdAt > CACHE_MS) {
    memoryCache.delete(key);
    return null;
  }

  return item.data;
}

function setCached(key, data) {
  memoryCache.set(key, {
    createdAt: Date.now(),
    data,
  });
}

async function fetchOddsApi(league) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey || !league?.oddsApiSport) return [];

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${league.oddsApiSport}/odds`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu,uk,us");
  url.searchParams.set("markets", "h2h,totals,spreads");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json.map((event) => normalizeOddsApiEvent(event, league.labelFi));
}

async function fetchSportsGameOdds(league) {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
  if (!apiKey || !league?.sgoSport || !league?.sgoLeague) return [];

  const url = new URL("https://api.sportsgameodds.com/v2/events");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("sportID", league.sgoSport);
  url.searchParams.set("leagueID", league.sgoLeague);
  url.searchParams.set("oddsAvailable", "true");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const json = await res.json();
  const events = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

  return events.map((event) => normalizeSportsGameOddsEvent(event, league.labelFi));
}

async function fetchLeagueFromAllProviders(league) {
  const results = await Promise.allSettled([
    fetchOddsApi(league),
    fetchSportsGameOdds(league),
  ]);

  const matches = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return uniqueMatches(matches).filter(hasBettingOdds);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sport = searchParams.get("sport") || "all";
  const leagueId = searchParams.get("league") || "ALL";
  const force = searchParams.get("force") === "1";

  const selectedLeagues =
    leagueId !== "ALL"
      ? [getLeagueById(leagueId)].filter(Boolean)
      : getLeaguesForSport(sport).slice(0, 8);

  const key = cacheKey({ sport, leagueId });

  if (!force) {
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        cacheAgeSeconds: Math.round((Date.now() - cached.cachedAt) / 1000),
      });
    }
  }

  const settled = await Promise.allSettled(selectedLeagues.map(fetchLeagueFromAllProviders));

  const matches = uniqueMatches(
    settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
  )
    .filter(hasBettingOdds)
    .sort((a, b) => new Date(a.commence_time || 0) - new Date(b.commence_time || 0));

  const payload = {
    source: matches.length ? "live" : "empty",
    status: matches.length ? "fresh" : "empty",
    provider: "multi-odds",
    cached: false,
    cachedAt: Date.now(),
    reason: matches.length
      ? ""
      : "Valituista sarjoista ei löytynyt kertoimellisiä otteluita. Kokeile NHL, NBA, NFL, Premier League tai pakota uusi haku.",
    matches,
    debug: {
      requestedSport: sport,
      requestedLeague: leagueId,
      searchedLeagues: selectedLeagues.map((l) => l.id),
      bettableCount: matches.length,
      hasOddsApiKey: Boolean(process.env.ODDS_API_KEY),
      hasSportsGameOddsKey: Boolean(process.env.SPORTSGAMEODDS_API_KEY),
    },
  };

  setCached(key, payload);
  return NextResponse.json(payload);
}
