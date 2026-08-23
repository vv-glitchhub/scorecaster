function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function decisionOf(pick = {}) {
  if (pick.productDecision) return pick.productDecision;
  if (pick.decision === "BET") return "PLAY";
  if (pick.decision === "PASS") return "SKIP";
  return "CAUTION";
}

function readinessOf(pick = {}) {
  return pick.sportsIntelligence?.readiness?.level || pick.intelligenceReadiness?.level || "market-only";
}

function trustOf(pick = {}) {
  const raw = Number(pick.trustScore ?? pick.qualityScore ?? pick.confidence ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return clamp(raw > 1 ? raw / 100 : raw);
}

function recommendationScore(pick = {}) {
  const edge = clamp((Number(pick.edge || 0) + 0.005) / 0.055);
  const ev = clamp((Number(pick.ev || 0) + 0.005) / 0.085);
  const confidence = clamp(pick.confidence);
  const trust = trustOf(pick);
  const coverage = clamp(Number(pick.bookmakerCount || 0) / 8);
  const readiness = readinessOf(pick) === "verified" ? 1 : readinessOf(pick) === "partial" ? 0.55 : 0.25;

  const raw = (
    edge * 0.22 +
    ev * 0.22 +
    confidence * 0.18 +
    trust * 0.15 +
    coverage * 0.10 +
    readiness * 0.13
  ) * 100;

  const decision = decisionOf(pick);
  const ceiling = decision === "PLAY" ? 100 : decision === "CAUTION" ? 79 : 49;
  return Number(Math.min(ceiling, Math.max(0, raw)).toFixed(1));
}

function reasonItems(pick = {}) {
  const reasons = [];
  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const odds = Number(pick.odds || 0);
  const fairOdds = Number(pick.fairOdds || 0);
  const bookmakerCount = Number(pick.bookmakerCount || 0);
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";

  if (edge > 0) reasons.push({ code: "positive-edge", value: edge });
  if (ev > 0) reasons.push({ code: "positive-ev", value: ev });
  if (odds > 0 && fairOdds > 0 && odds > fairOdds) reasons.push({ code: "price-above-fair", odds, fairOdds });
  if (bookmakerCount >= 4) reasons.push({ code: "market-coverage", value: bookmakerCount });
  if (readinessOf(pick) === "verified") reasons.push({ code: "verified-evidence" });
  if (freshness !== "stale" && freshness !== "unknown") reasons.push({ code: "fresh-data", value: freshness });
  if (Number(pick.confidence || 0) >= 0.55) reasons.push({ code: "confidence", value: Number(pick.confidence || 0) });

  return reasons.slice(0, 5);
}

function warningItems(pick = {}) {
  const warnings = [];
  const decision = decisionOf(pick);
  const readiness = readinessOf(pick);
  const bookmakerCount = Number(pick.bookmakerCount || 0);
  const confidence = Number(pick.confidence || 0);
  const edge = Number(pick.edge || 0);
  const ev = Number(pick.ev || 0);
  const freshness = pick.freshnessLabel || pick.dataQuality?.freshness || "unknown";
  const conflicts = Array.isArray(pick.sportsIntelligence?.conflicts) ? pick.sportsIntelligence.conflicts : [];

  if (readiness !== "verified") warnings.push({ code: "evidence-not-verified", value: readiness });
  if (conflicts.length) warnings.push({ code: "evidence-conflict", value: conflicts.length });
  if (bookmakerCount < 4) warnings.push({ code: "thin-market", value: bookmakerCount });
  if (confidence < 0.55) warnings.push({ code: "low-confidence", value: confidence });
  if (freshness === "stale") warnings.push({ code: "stale-data" });
  if (edge < 0.02) warnings.push({ code: "thin-edge", value: edge });
  if (ev < 0.03) warnings.push({ code: "thin-ev", value: ev });
  if (decision === "SKIP" && pick.skipReason) warnings.push({ code: "skip-gate", value: String(pick.skipReason) });

  return warnings.slice(0, 5);
}

function strengthLabel(score, decision) {
  if (decision === "PLAY" && score >= 82) return "strong";
  if (decision === "PLAY") return "playable";
  if (decision === "CAUTION" && score >= 65) return "watch-closely";
  if (decision === "CAUTION") return "watch";
  return "skip";
}

export function buildRecommendation(pick = {}, rank = null) {
  const decision = decisionOf(pick);
  const score = recommendationScore(pick);
  return {
    version: "scorecaster-recommendation-v1",
    rank,
    decision,
    strength: strengthLabel(score, decision),
    score,
    id: pick.id || pick.eventId || pick.gameId || null,
    eventId: pick.eventId || pick.gameId || pick.id || null,
    match: pick.match || `${pick.homeTeam || ""} – ${pick.awayTeam || ""}`.trim(),
    homeTeam: pick.homeTeam || null,
    awayTeam: pick.awayTeam || null,
    league: pick.leagueTitle || pick.league || null,
    commenceTime: pick.commenceTime || null,
    selection: pick.selection || pick.label || null,
    marketKey: pick.marketKey || null,
    point: pick.point ?? null,
    odds: Number(pick.odds || 0) || null,
    fairOdds: Number(pick.fairOdds || 0) || null,
    edge: Number(pick.edge || 0),
    ev: Number(pick.ev || 0),
    confidence: Number(pick.confidence || 0),
    trustScore: Number(pick.trustScore || 0),
    bookmaker: pick.bookmaker || null,
    bookmakerCount: Number(pick.bookmakerCount || 0),
    readiness: readinessOf(pick),
    reasons: reasonItems(pick),
    warnings: warningItems(pick),
    decisionReason: pick.evidenceGateReason || pick.decisionReason || null,
    paperOnly: true,
    realMoneyActionAvailable: false,
    probabilityAdjustedByIntelligence: false
  };
}

export function buildRecommendationFeed(picks = [], { limit = 8 } = {}) {
  const decisionOrder = { PLAY: 3, CAUTION: 2, SKIP: 1 };
  const recommendations = (Array.isArray(picks) ? picks : [])
    .map((pick) => buildRecommendation(pick))
    .sort((a, b) => {
      const decisionDiff = (decisionOrder[b.decision] || 0) - (decisionOrder[a.decision] || 0);
      if (decisionDiff) return decisionDiff;
      return b.score - a.score;
    })
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 8)))
    .map((item, index) => ({ ...item, rank: index + 1 }));

  const plays = recommendations.filter((item) => item.decision === "PLAY");
  const cautions = recommendations.filter((item) => item.decision === "CAUTION");
  const skips = recommendations.filter((item) => item.decision === "SKIP");

  return {
    version: "scorecaster-recommendation-feed-v1",
    generatedAt: new Date().toISOString(),
    paperOnly: true,
    realMoneyActionAvailable: false,
    topRecommendation: plays[0] || cautions[0] || null,
    hasPlayablePick: plays.length > 0,
    counts: { PLAY: plays.length, CAUTION: cautions.length, SKIP: skips.length },
    recommendations
  };
}
