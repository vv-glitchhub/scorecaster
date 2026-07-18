import { SPORTS } from "../../../lib/sports";
import { createTopPicksFromGames } from "../../../lib/scorecaster-engine";
import { enrichPickWithLiveIntelligence } from "../../../lib/agent-intelligence-loader";
import { calculatePickQuality } from "../../../lib/pick-quality-engine";
import {
  filterUpcomingPicks,
  isUsableLiveFixture
} from "../../../lib/fixture-integrity.mjs";

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
const ANALYSIS_WINDOW_HOURS = 24 * 7;
const FEATURED_WINDOW_HOURS = 72;
const PROVIDER_MAX_FUTURE_HOURS = 24 * 45;
const MAX_INTELLIGENCE_ENRICHMENTS = 12;
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

function preserveSafetyGate(marketDecision, pick) {
  if (marketDecision !== "BET") return marketDecision;

  const report = pick.sportsIntelligence;
  if (report?.readiness?.level !== "verified") return "WATCH";
  if (Array.isArray(report?.conflicts) && report.conflicts.length > 0) return "WATCH";
  if (Number(pick.intelligenceRelativeImpact || 0) <= -0.015) return "WATCH";

  return "BET";
}

function applyQualityFallback(pick) {
  const sourceTrust = Number(pick.sourceTrust ?? pick.confidence ?? 0.35);
  const quality = calculatePickQuality({
    ...pick,
    sourceTrust,
    sentimentScore: 0
  });

  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const gate = dataGate(pick);
  let marketDecision;

  if (!gate.watchable || edge < 0.005 || ev <= 0) {
    marketDecision = "PASS";
  } else if (!gate.playable) {
    marketDecision = "WAIT";
  } else if (edge >= 0.02 && ev >= 0.03 && ["A", "B", "C"].includes(quality.qualityGrade)) {
    marketDecision = "BET";
  } else {
    marketDecision = "WATCH";
  }

  const decision = preserveSafetyGate(marketDecision, pick);
  const readiness = pick.sportsIntelligence?.readiness?.level || "market-only";
  const qualityNotes = [
    ...(pick.qualityNotes || quality.qualityNotes || []),
    `${gate.bookmakerCount} bookmakers in consensus.`,
    `Market-data confidence ${(gate.confidence * 100).toFixed(0)}%.`,
    `Freshness: ${gate.freshness}.`,
    `Independent intelligence readiness: ${readiness}.`,
    pick.evidenceGateReason || "Independent intelligence did not change the market probability.",
    "Fixture came from the configured live odds provider and is inside the near-term analysis window.",
    "Edge is best-price value versus a no-vig market consensus, not a guaranteed outcome prediction."
  ];

  const result = {
    ...pick,
    decision,
    marketDecisionBeforeSafetyGate: marketDecision,
    sourceTrust,
    qualityScore: pick.qualityScore || quality.qualityScore,
    qualityGrade: pick.qualityGrade || quality.qualityGrade,
    qualityNotes,
    dataGate: gate,
    fixtureVerifiedByProvider: true,
    fixtureSource: "live-odds-provider"
  };

  return {
    ...result,
    trustScore: normalizedTrustScore(result),
    productDecision: productDecision(decision),
    paperOnly: true,
    modelMode: pick.modelMode || "market-consensus",
    edgeType: pick.edgeType || "best-price-vs-no-vig-consensus",
    probabilityAdjustedByIntelligence: false
  };
}

function rankPick(pick) {
  const decisionWeight = {
    BET: 1,
    WATCH: 0.45,
    WAIT: 0.1,
    PASS: -1
  };
  const readinessWeight = {
    verified: 0.2,
    partial: 0.05,
    "market-only": 0
  };

  return (
    Number(decisionWeight[pick.decision] || 0) +
    Number(readinessWeight[pick.sportsIntelligence?.readiness?.level] || 0) +
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
      intelligenceError: process.env.NODE_ENV === "production" ? undefined : error.message,
      evidenceGateReason: "Independent intelligence could not be loaded."
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

async function loadLeague(origin, league, now) {
  try {
    const response = await fetch(
      `${origin}/api/odds?sport=${encodeURIComponent(league)}&markets=h2h`,
      { next: { revalidate: 120 }, signal: AbortSignal.timeout(12000) }
    );

    if (!response.ok) return { picks: [], providerGames: 0, acceptedGames: 0 };
    const data = await response.json();
    if (data?.source !== "live" || data?.ok !== true) {
      return { picks: [], providerGames: 0, acceptedGames: 0 };
    }

    const providerGames = getGamesFromResponse(data);
    const structurallyValid = providerGames.filter((game) =>
      isUsableLiveFixture(game, {
        now,
        maxFutureHours: PROVIDER_MAX_FUTURE_HOURS
      })
    );
    const nearTermGames = structurallyValid.filter((game) =>
      filterUpcomingPicks([{ commenceTime: game.commence_time }], ANALYSIS_WINDOW_HOURS, now).length === 1
    );

    const picks = createTopPicksFromGames({
      games: nearTermGames,
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
      sportKey: league,
      fixtureVerifiedByProvider: true,
      fixtureSource: "live-odds-provider"
    }));

    return {
      picks,
      providerGames: providerGames.length,
      acceptedGames: nearTermGames.length
    };
  } catch {
    return { picks: [], providerGames: 0, acceptedGames: 0 };
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
  const now = Date.now();
  const leagueResults = await Promise.all(leagues.map((league) => loadLeague(origin, league, now)));
  const allPicks = leagueResults.flatMap((result) => result.picks);

  const preFiltered = allPicks
    .sort((a, b) => (Number(b.edge || 0) * Number(b.confidence || 0)) - (Number(a.edge || 0) * Number(a.confidence || 0)))
    .slice(0, MAX_INTELLIGENCE_ENRICHMENTS);

  const enriched = await Promise.all(preFiltered.map(enrichSafely));
  const sorted = enriched
    .sort((a, b) => rankPick(b) - rankPick(a))
    .slice(0, MAX_INTELLIGENCE_ENRICHMENTS);
  const featured = filterUpcomingPicks(sorted, FEATURED_WINDOW_HOURS, now)
    .filter((pick) => pick.productDecision !== "SKIP")
    .slice(0, 3);

  const providerGames = leagueResults.reduce((sum, result) => sum + result.providerGames, 0);
  const acceptedGames = leagueResults.reduce((sum, result) => sum + result.acceptedGames, 0);
  const intelligenceLevels = sorted.reduce((counts, pick) => {
    const level = pick.sportsIntelligence?.readiness?.level || "market-only";
    counts[level] = (counts[level] || 0) + 1;
    return counts;
  }, { verified: 0, partial: 0, "market-only": 0 });

  return Response.json(
    {
      ok: true,
      source: "no-vig-market-consensus",
      fixtureSource: "live-odds-provider-only",
      intelligenceMode: "team-attributed-audit-only",
      agentVersion: "V11-model-lab+sports-intelligence-v1",
      modelMode: "market-consensus",
      edgeType: "best-price-vs-no-vig-consensus",
      generatedAt: new Date(now).toISOString(),
      paperOnly: true,
      analysisWindowHours: ANALYSIS_WINDOW_HOURS,
      featuredWindowHours: FEATURED_WINDOW_HOURS,
      maxIntelligenceEnrichments: MAX_INTELLIGENCE_ENRICHMENTS,
      providerGames,
      acceptedGames,
      excludedGames: Math.max(0, providerGames - acceptedGames),
      intelligenceLevels,
      disclaimer: "Only live-provider fixtures inside the near-term analysis window are shown. Independent intelligence can downgrade a pick but never changes the market probability or upgrades a pick to PLAY.",
      leagues,
      count: sorted.length,
      featured,
      data: sorted
    },
    { headers: CACHE_HEADERS }
  );
}
