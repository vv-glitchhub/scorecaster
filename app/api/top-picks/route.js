import { SPORTS } from "../../../lib/sports";
import { createTopPicksFromGames } from "../../../lib/scorecaster-engine";
import { enrichPickWithLiveIntelligence } from "../../../lib/agent-intelligence-loader";
import { calculatePickQuality } from "../../../lib/pick-quality-engine";
import { evaluateIndependentIntelligenceSafetyV1 } from "../../../lib/intelligence-play-safety-v1.mjs";
import {
  filterUpcomingPicks,
  isUsableLiveFixture
} from "../../../lib/fixture-integrity.mjs";

const ALL_LEAGUES = SPORTS.flatMap((group) => group.leagues);
const LEAGUE_KEYS = new Set(ALL_LEAGUES.map((league) => league.key));
const CORE_SEASON_DEFAULT_LEAGUES = [
  "icehockey_nhl",
  "icehockey_finland_liiga",
  "icehockey_sweden_hockey_league",
  "basketball_nba",
  "soccer_epl",
  "soccer_spain_la_liga"
];
const SUMMER_DEFAULT_LEAGUES = [
  "baseball_mlb",
  "basketball_wnba",
  "soccer_usa_mls",
  "soccer_finland_veikkausliiga",
  "soccer_sweden_allsvenskan",
  "soccer_norway_eliteserien"
];
const ANALYSIS_WINDOW_HOURS = 24 * 7;
const FEATURED_WINDOW_HOURS = 72;
const PROVIDER_MAX_FUTURE_HOURS = 24 * 45;
const MAX_INTELLIGENCE_ENRICHMENTS = 12;
const CACHE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function compactSportsIntelligence(report = {}) {
  return {
    sourceCount: Number(report.sourceCount || 0),
    readiness: {
      level: report.readiness?.level || "market-only",
      missing: Array.isArray(report.readiness?.missing) ? report.readiness.missing.slice(0, 8) : [],
      allowsIndependentPlayEvidence: report.readiness?.allowsIndependentPlayEvidence === true
    },
    conflicts: Array.isArray(report.conflicts) ? report.conflicts.slice(0, 8) : [],
    injuries: Array.isArray(report.injuries) ? report.injuries.slice(0, 12) : [],
    lineups: Array.isArray(report.lineups) ? report.lineups.slice(0, 6) : [],
    news: Array.isArray(report.news) ? report.news.slice(0, 8) : []
  };
}

function publicPickSummary(pick = {}) {
  return {
    id: pick.id,
    eventId: pick.eventId || pick.gameId || pick.id,
    gameId: pick.gameId || pick.eventId || pick.id,
    match: pick.match,
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    selection: pick.selection,
    label: pick.label,
    sportKey: pick.sportKey,
    sportTitle: pick.sportTitle,
    league: pick.league,
    leagueTitle: pick.leagueTitle,
    commenceTime: pick.commenceTime,
    marketKey: pick.marketKey,
    point: pick.point ?? null,
    odds: pick.odds,
    bookmaker: pick.bookmaker,
    bookmakerKey: pick.bookmakerKey,
    bookmakerCount: pick.bookmakerCount,
    averageOdds: pick.averageOdds,
    fairOdds: pick.fairOdds,
    consensusProbability: pick.consensusProbability,
    marketProbability: pick.marketProbability,
    modelProbability: pick.modelProbability,
    independentModelProbability: pick.independentModelProbability ?? null,
    probabilityDispersion: pick.probabilityDispersion,
    confidence: pick.confidence,
    sourceTrust: pick.sourceTrust,
    trustScore: pick.trustScore,
    qualityScore: pick.qualityScore,
    qualityGrade: pick.qualityGrade,
    edge: pick.edge,
    ev: pick.ev,
    kelly: pick.kelly,
    adjustedKelly: pick.adjustedKelly,
    suggestedStake: pick.suggestedStake,
    decision: pick.decision,
    productDecision: pick.productDecision,
    marketDecisionBeforeSafetyGate: pick.marketDecisionBeforeSafetyGate,
    decisionReason: pick.decisionReason,
    decisionReasons: Array.isArray(pick.decisionReasons) ? pick.decisionReasons.slice(0, 8) : [],
    skipReason: pick.skipReason,
    evidenceGateReason: pick.evidenceGateReason,
    freshnessLabel: pick.freshnessLabel,
    dataAgeHours: pick.dataAgeHours,
    lastUpdate: pick.lastUpdate,
    dataQuality: pick.dataQuality ? {
      freshness: pick.dataQuality.freshness,
      ageHours: pick.dataQuality.ageHours,
      bookmakerCount: pick.dataQuality.bookmakerCount,
      probabilityDispersion: pick.dataQuality.probabilityDispersion
    } : null,
    dataGate: pick.dataGate,
    intelligenceReadiness: pick.intelligenceReadiness,
    intelligenceRelativeImpact: pick.intelligenceRelativeImpact,
    sportsIntelligence: compactSportsIntelligence(pick.sportsIntelligence),
    polymarketSignal: pick.polymarketSignal,
    fixtureSource: pick.fixtureSource,
    fixtureVerifiedByProvider: pick.fixtureVerifiedByProvider === true,
    paperOnly: true,
    modelMode: pick.modelMode,
    edgeType: pick.edgeType,
    probabilityAdjustedByIntelligence: false
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seasonForDate(now = Date.now()) {
  const month = new Date(now).getUTCMonth();
  return month >= 4 && month <= 7 ? "summer" : "core-season";
}

function defaultLeaguesForDate(now = Date.now()) {
  return seasonForDate(now) === "summer"
    ? SUMMER_DEFAULT_LEAGUES
    : CORE_SEASON_DEFAULT_LEAGUES;
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

function gateFailureReasons(gate, edge, ev) {
  const reasons = [];
  if (gate.stale) reasons.push("Odds data is older than 12 hours.");
  if (gate.bookmakerCount < 2) reasons.push("Fewer than two bookmakers are available.");
  if (gate.confidence < 0.35) reasons.push("Market-data confidence is below 35%.");
  if (edge < 0.005) reasons.push("Edge is below 0.5%.");
  if (ev <= 0) reasons.push("Expected value is not positive.");
  return reasons;
}

function preserveSafetyGate(marketDecision, pick) {
  if (marketDecision !== "BET") return marketDecision;

  if (pick.sportsIntelligence?.readiness?.allowsIndependentPlayEvidence !== true) {
    return "WATCH";
  }

  const intelligenceSafety = evaluateIndependentIntelligenceSafetyV1({
    report: pick.sportsIntelligence,
    relativeImpact: pick.intelligenceRelativeImpact
  });
  if (intelligenceSafety.downgrade) return "WATCH";

  return "BET";
}

function decisionExplanation({ decision, marketDecision, gateFailures, gate, edge, ev, independentPlayReady }) {
  if (decision === "PASS") {
    return `SKIP: ${gateFailures.join(" ") || "The selection does not pass the minimum market-data gate."}`;
  }
  if (marketDecision === "BET" && decision === "WATCH") {
    if (!independentPlayReady) {
      return "CAUTION: the market price gates passed, but PLAY requires verified independent evidence.";
    }
    return "CAUTION: the market threshold passed, but verified negative intelligence or an unresolved evidence conflict blocked PLAY.";
  }
  if (decision === "WAIT") {
    return `CAUTION: the selection is watchable but not yet playable (${gate.bookmakerCount} bookmakers, ${(gate.confidence * 100).toFixed(0)}% data confidence).`;
  }
  if (decision === "WATCH") {
    return `CAUTION: data is usable, but PLAY requires at least 2.0% edge and 3.0% EV. Current edge ${(edge * 100).toFixed(1)}%, EV ${(ev * 100).toFixed(1)}%.`;
  }
  return "PLAY: price and market-data gates passed, with no verified negative intelligence or unresolved evidence conflict blocking the selection.";
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
  const gateFailures = gateFailureReasons(gate, edge, ev);
  const independentPlayReady = pick.sportsIntelligence?.readiness?.allowsIndependentPlayEvidence === true;
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
  const decisionReason = decisionExplanation({ decision, marketDecision, gateFailures, gate, edge, ev, independentPlayReady });
  const qualityNotes = [
    decisionReason,
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
    decisionReason,
    decisionReasons: gateFailures,
    skipReason: decision === "PASS" ? gateFailures[0] || decisionReason : null,
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

function parseLeagues(searchParams, now = Date.now()) {
  const requested = searchParams.get("sports");
  if (!requested) return defaultLeaguesForDate(now);

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

    // Keep all consensus-backed selections with at least two bookmakers.
    // The decision gate below is responsible for classifying weak edges as SKIP,
    // while the collector can still preserve the underlying market observation.
    const picks = createTopPicksFromGames({
      games: nearTermGames,
      marketKey: "h2h",
      bankroll: 1000,
      kellyMode: "quarter",
      minEdge: -1,
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
  const unknownKeys = [...url.searchParams.keys()].filter((key) => !["sports", "view"].includes(key));
  if (unknownKeys.length) {
    return Response.json(
      { ok: false, error: "Unsupported query parameter", data: [] },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const view = url.searchParams.get("view") || "full";
  if (!new Set(["full", "summary"]).has(view)) {
    return Response.json(
      { ok: false, error: "Unsupported view", data: [] },
      { status: 400, headers: CACHE_HEADERS }
    );
  }

  const now = Date.now();
  const leagues = parseLeagues(url.searchParams, now);
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
      canonical.search = new URLSearchParams({ sports: canonicalSports, ...(view === "summary" ? { view } : {}) }).toString();
      return Response.redirect(canonical, 307);
    }
  }

  const { origin } = url;
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
  const responseData = view === "summary" ? sorted.map(publicPickSummary) : sorted;
  const responseFeatured = view === "summary" ? featured.map(publicPickSummary) : featured;

  const providerGames = leagueResults.reduce((sum, result) => sum + result.providerGames, 0);
  const acceptedGames = leagueResults.reduce((sum, result) => sum + result.acceptedGames, 0);
  const intelligenceLevels = sorted.reduce((counts, pick) => {
    const level = pick.sportsIntelligence?.readiness?.level || "market-only";
    counts[level] = (counts[level] || 0) + 1;
    return counts;
  }, { verified: 0, partial: 0, "market-only": 0 });
  const decisionCounts = sorted.reduce((counts, pick) => {
    const value = pick.productDecision || "CAUTION";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, { PLAY: 0, CAUTION: 0, SKIP: 0 });

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
      view,
      leagueSelectionMode: url.searchParams.has("sports") ? "requested" : "season-aware-default",
      defaultLeagueSeason: seasonForDate(now),
      providerGames,
      acceptedGames,
      excludedGames: Math.max(0, providerGames - acceptedGames),
      intelligenceLevels,
      decisionCounts,
      disclaimer: "Only live-provider fixtures inside the near-term analysis window are shown. Independent intelligence can downgrade a pick but never changes the market probability or upgrades a pick to PLAY.",
      leagues,
      count: sorted.length,
      featured: responseFeatured,
      data: responseData
    },
    { headers: CACHE_HEADERS }
  );
}
