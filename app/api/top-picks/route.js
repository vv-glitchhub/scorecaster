import { SPORTS } from "../../../lib/sports";
import { createTopPicksFromGames } from "../../../lib/scorecaster-engine";
import { enrichPickWithLiveIntelligence } from "../../../lib/agent-intelligence-loader";
import { calculatePickQuality } from "../../../lib/pick-quality-engine";

const ALL_LEAGUES = SPORTS.flatMap((group) => group.leagues);
const LEAGUE_KEYS = new Set(ALL_LEAGUES.map((league) => league.key));
const DEFAULT_LEAGUES = [
  "icehockey_nhl",
  "icehockey_finland_liiga",
  "icehockey_sweden_hockey_league",
  "basketball_nba",
  "soccer_epl",
  "soccer_spain_la_liga"
];
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  "X-Content-Type-Options": "nosniff"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function findLeagueTitle(key) {
  return ALL_LEAGUES.find((league) => league.key === key)?.title || key;
}

function getGamesFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.events)) return data.events;
  if (Array.isArray(data?.games)) return data.games;
  return [];
}

function normalizedTrustScore(pick) {
  const quality = Number(pick.qualityScore || 0);
  const qualityPercent = quality <= 1 ? quality * 100 : quality;
  const confidence = clamp(Number(pick.confidence || 0), 0, 1) * 100;
  const sourceTrust = clamp(Number(pick.sourceTrust || pick.confidence || 0.35), 0, 1) * 100;
  const coverage = clamp(Number(pick.bookmakerCount || 0) / 8, 0, 1) * 100;
  const score = qualityPercent * 0.35 + confidence * 0.4 + sourceTrust * 0.15 + coverage * 0.1;
  return Number(clamp(score, 0, 100).toFixed(1));
}

function productDecision(decision) {
  if (decision === "BET") return "PLAY";
  if (decision === "PASS") return "SKIP";
  return "CAUTION";
}

function dataGate(pick) {
  const bookmakerCount = Number(pick.bookmakerCount || 0);
  const confidence = Number(pick.confidence || 0);
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const stale = freshness === "stale";

  return {
    bookmakerCount,
    confidence,
    freshness,
    stale,
    playable: bookmakerCount >= 4 && confidence >= 0.55 && !stale,
    watchable: bookmakerCount >= 2 && confidence >= 0.35 && !stale
  };
}

function applyQualityFallback(pick) {
  const sourceTrust = Number(pick.sourceTrust ?? pick.confidence ?? 0.35);
  const quality = calculatePickQuality({
    ...pick,
    sourceTrust,
    sentimentScore: Number(pick.sentimentScore || 0)
  });

  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const gate = dataGate(pick);
  let decision;

  if (!gate.watchable || edge < 0.005 || ev <= 0) {
    decision = "PASS";
  } else if (!gate.playable) {
    decision = "WAIT";
  } else if (edge >= 0.02 && ev >= 0.03 && ["A", "B", "C"].includes(quality.qualityGrade)) {
    decision = "BET";
  } else {
    decision = "WATCH";
  }

  const qualityNotes = [
    ...(pick.qualityNotes || quality.qualityNotes || []),
    `${gate.bookmakerCount} bookmakers in consensus.`,
    `Market-data confidence ${(gate.confidence * 100).toFixed(0)}%.`,
    `Freshness: ${gate.freshness}.`,
    "Edge is best-price value versus a no-vig market consensus, not a guaranteed outcome prediction."
  ];

  const result = {
    ...pick,
    decision,
    sourceTrust,
    qualityScore: pick.qualityScore || quality.qualityScore,
    qualityGrade: pick.qualityGrade || quality.qualityGrade,
    qualityNotes,
    dataGate: gate
  };

  return {
    ...result,
    trustScore: normalizedTrustScore(result),
    productDecision: productDecision(decision),
    paperOnly: true,
    modelMode: pick.modelMode || "market-consensus",
    edgeType: pick.edgeType || "best-price-vs-no-vig-consensus"
  };
}

function rankPick(pick) {
  const decisionWeight = {
    BET: 1,
    WATCH: 0.45,
    WAIT: 0.1,
    PASS: -1
  };

  return (
    Number(decisionWeight[pick.decision] || 0) +
    Number(pick.edge || 0) * 4 +
    Number(pick.ev || 0) * 2 +
    Number(pick.confidence || 0) * 0.4 +
    Number(pick.trustScore || 0) / 250 +
    clamp(Number(pick.bookmakerCount || 0) / 10, 0, 0.8)
  );
}

async function enrichSafely(pick) {
  try {
    const enriched = await enrichPickWithLiveIntelligence(pick);
    return applyQualityFallback(enriched);
  } catch (error) {
    return applyQualityFallback({
      ...pick,
      agentVersion: "consensus-fallback",
      decision: "WATCH",
      finalScore: Number(pick.finalScore || pick.edge || 0),
      intelligenceError: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
}

function parseLeagues(searchParams) {
  const requested = searchParams.get("sports");
  if (!requested) return DEFAULT_LEAGUES;

  const leagues = [...new Set(requested.split(",").map((value) => value.trim()).filter(Boolean))]
    .filter((league) => LEAGUE_KEYS.has(league))
    .sort();

  if (!leagues.length || leagues.length > 6) return null;
  return leagues;
}

async function loadLeague(origin, league) {
  try {
    const response = await fetch(
      `${origin}/api/odds?sport=${encodeURIComponent(league)}&markets=h2h`,
      { next: { revalidate: 120 }, signal: AbortSignal.timeout(12000) }
    );

    if (!response.ok) return [];
    const data = await response.json();
    const games = getGamesFromResponse(data);

    return createTopPicksFromGames({
      games,
      marketKey: "h2h",
      bankroll: 1000,
      kellyMode: "quarter",
      minEdge: 0.005,
      limit: 12
    }).map((pick) => ({
      ...pick,
      origin,
      league,
      leagueTitle: findLeagueTitle(league),
      sportKey: league
    }));
  } catch {
    return [];
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const unknownKeys = [...url.searchParams.keys()].filter((key) => key !== "sports");
  if (unknownKeys.length) {
    return Response.json(
      { ok: false, error: "Unsupported query parameter", data: [] },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const leagues = parseLeagues(url.searchParams);
  if (!leagues) {
    return Response.json(
      { ok: false, error: "Choose between one and six supported leagues", data: [] },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  if (url.searchParams.has("sports")) {
    const canonicalSports = leagues.join(",");
    if (url.searchParams.get("sports") !== canonicalSports) {
      const canonical = new URL(request.url);
      canonical.search = new URLSearchParams({ sports: canonicalSports }).toString();
      return Response.redirect(canonical, 307);
    }
  }

  const { origin } = url;
  const leaguePicks = await Promise.all(leagues.map((league) => loadLeague(origin, league)));
  const allPicks = leaguePicks.flat();

  const preFiltered = allPicks
    .sort((a, b) => (Number(b.edge || 0) * Number(b.confidence || 0)) - (Number(a.edge || 0) * Number(a.confidence || 0)))
    .slice(0, 30);

  const enriched = await Promise.all(preFiltered.map(enrichSafely));
  const sorted = enriched
    .sort((a, b) => rankPick(b) - rankPick(a))
    .slice(0, 20);

  return Response.json(
    {
      ok: true,
      source: "no-vig-market-consensus",
      agentVersion: "V8-consensus",
      modelMode: "market-consensus",
      edgeType: "best-price-vs-no-vig-consensus",
      generatedAt: new Date().toISOString(),
      paperOnly: true,
      disclaimer: "Analysis is uncertain and does not guarantee profit. Probability comes from a no-vig bookmaker consensus; SKIP is a valid result.",
      leagues,
      count: sorted.length,
      featured: sorted.filter((pick) => pick.productDecision !== "SKIP").slice(0, 3),
      data: sorted
    },
    { headers: CACHE_HEADERS }
  );
}
