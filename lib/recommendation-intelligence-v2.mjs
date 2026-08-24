export const RECOMMENDATION_INTELLIGENCE_VERSION = "scorecaster-recommendation-intelligence-v2";

const SCORE_WEIGHTS = Object.freeze({
  edge: 0.22,
  ev: 0.22,
  confidence: 0.18,
  trust: 0.15,
  coverage: 0.10,
  readiness: 0.13
});

const VISIBLE_PLAY_GATES = Object.freeze([
  "fresh-data",
  "bookmaker-coverage",
  "confidence",
  "edge",
  "ev",
  "verified-evidence"
]);

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, finite(value)));
}

function normalizedTrust(value) {
  const raw = finite(value);
  return clamp(raw > 1 ? raw / 100 : raw);
}

function normalizedReadiness(value) {
  const readiness = String(value || "market-only").toLowerCase();
  if (readiness === "verified") return 1;
  if (readiness === "partial") return 0.55;
  return 0.25;
}

function decisionCeiling(decision) {
  if (decision === "PLAY") return 100;
  if (decision === "CAUTION") return 79;
  return 49;
}

function gateState(item = {}) {
  const freshness = String(item.freshness || "unknown").toLowerCase();
  const bookmakerCount = finite(item.bookmakerCount);
  const confidence = finite(item.confidence);
  const edge = finite(item.edge);
  const ev = finite(item.ev);
  const readiness = String(item.readiness || "market-only").toLowerCase();

  return [
    {
      code: "fresh-data",
      passed: freshness !== "stale",
      current: freshness,
      target: "not-stale",
      gap: freshness === "stale" ? 1 : 0
    },
    {
      code: "bookmaker-coverage",
      passed: bookmakerCount >= 4,
      current: bookmakerCount,
      target: 4,
      gap: Math.max(0, 4 - bookmakerCount)
    },
    {
      code: "confidence",
      passed: confidence >= 0.55,
      current: confidence,
      target: 0.55,
      gap: Math.max(0, 0.55 - confidence)
    },
    {
      code: "edge",
      passed: edge >= 0.02,
      current: edge,
      target: 0.02,
      gap: Math.max(0, 0.02 - edge)
    },
    {
      code: "ev",
      passed: ev >= 0.03,
      current: ev,
      target: 0.03,
      gap: Math.max(0, 0.03 - ev),
      minimumEvOdds: item.minimumEvOdds ?? null,
      currentOdds: item.odds ?? null
    },
    {
      code: "verified-evidence",
      passed: readiness === "verified",
      current: readiness,
      target: "verified",
      gap: readiness === "verified" ? 0 : 1
    }
  ];
}

export function buildScoreDecomposition(item = {}) {
  const normalized = {
    edge: clamp((finite(item.edge) + 0.005) / 0.055),
    ev: clamp((finite(item.ev) + 0.005) / 0.085),
    confidence: clamp(item.confidence),
    trust: normalizedTrust(item.trustScore),
    coverage: clamp(finite(item.bookmakerCount) / 8),
    readiness: normalizedReadiness(item.readiness)
  };

  const components = Object.entries(SCORE_WEIGHTS).map(([code, weight]) => ({
    code,
    weight,
    normalized: normalized[code],
    contribution: Number((normalized[code] * weight * 100).toFixed(2))
  }));
  const rawScore = Number(components.reduce((sum, component) => sum + component.contribution, 0).toFixed(2));
  const ceiling = decisionCeiling(item.decision);

  return {
    version: "recommendation-score-decomposition-v1",
    rawScore,
    decisionCeiling: ceiling,
    displayedScore: finite(item.score),
    ceilingApplied: rawScore > ceiling,
    components
  };
}

function opportunitySignals(item, gates, failedVisibleGates) {
  const signals = [];
  const nextGate = item.nextGate?.code || null;
  const decision = item.decision;

  if (decision === "PLAY") {
    signals.push({ code: "play-maintain", severity: "high", label: "PLAY gates currently pass" });
  }
  if (decision === "CAUTION" && failedVisibleGates.length === 1) {
    signals.push({ code: "one-visible-gate-away", severity: "high", gate: failedVisibleGates[0].code, label: "One visible PLAY gate is still blocked" });
  }
  if (decision === "CAUTION" && finite(item.score) >= 65 && finite(item.edge) >= 0.02 && finite(item.ev) >= 0.03) {
    signals.push({ code: "high-value-caution", severity: "medium", label: "Strong market value but PLAY is still blocked" });
  }
  if (nextGate === "verified-evidence") {
    signals.push({ code: "evidence-bottleneck", severity: "medium", label: "Independent evidence is the current visible bottleneck" });
  }
  if (nextGate === "ev" && item.minimumEvOdds && item.odds) {
    signals.push({
      code: "price-bottleneck",
      severity: "medium",
      label: "Price is below the 3% EV floor",
      currentOdds: item.odds,
      targetOdds: item.minimumEvOdds,
      oddsGap: Number((finite(item.minimumEvOdds) - finite(item.odds)).toFixed(3))
    });
  }
  if (finite(item.bookmakerCount) >= 8) {
    signals.push({ code: "deep-market", severity: "info", label: "Broad bookmaker coverage" });
  }
  if (String(item.freshness || "unknown").toLowerCase() === "stale") {
    signals.push({ code: "stale-risk", severity: "high", label: "Fresh data is required before reconsideration" });
  }
  if (item.evPriceGateOpen === true && decision !== "SKIP") {
    signals.push({ code: "ev-price-open", severity: "info", label: "Current price clears the 3% EV floor" });
  }

  return signals.slice(0, 6);
}

export function enrichRecommendationIntelligence(item = {}) {
  const gates = gateState(item);
  const failedVisibleGates = gates.filter((gate) => !gate.passed);
  const passedVisibleGates = gates.length - failedVisibleGates.length;
  const oneVisibleGateAway = item.decision === "CAUTION" && failedVisibleGates.length === 1;
  const nextGateMatches = oneVisibleGateAway && failedVisibleGates[0]?.code === item.nextGate?.code;
  const scoreDecomposition = buildScoreDecomposition(item);
  const opportunity = opportunitySignals(item, gates, failedVisibleGates);
  const priority = Number((
    finite(item.score) +
    (item.decision === "PLAY" ? 20 : 0) +
    (oneVisibleGateAway ? 12 : 0) +
    (finite(item.edge) >= 0.02 ? 4 : 0) +
    (finite(item.ev) >= 0.03 ? 4 : 0)
  ).toFixed(1));

  return {
    version: RECOMMENDATION_INTELLIGENCE_VERSION,
    visiblePlayGates: gates,
    visibleGateSummary: {
      total: gates.length,
      passed: passedVisibleGates,
      failed: failedVisibleGates.length,
      progress: Number((passedVisibleGates / gates.length).toFixed(3))
    },
    failedVisibleGates,
    oneVisibleGateAway,
    nearPlay: Boolean(oneVisibleGateAway && nextGateMatches),
    nearPlayGate: oneVisibleGateAway ? failedVisibleGates[0]?.code || null : null,
    finalSafetyStillRequired: item.decision !== "PLAY",
    scoreDecomposition,
    opportunitySignals: opportunity,
    opportunityPriority: priority,
    decisionUpgradeAllowedByThisLayer: false,
    probabilityAdjustedByThisLayer: false,
    paperOnly: true
  };
}

export function buildOpportunityRadar(recommendations = [], { limit = 12 } = {}) {
  const rows = (Array.isArray(recommendations) ? recommendations : [])
    .map((item) => ({ ...item, intelligenceV2: item.intelligenceV2 || enrichRecommendationIntelligence(item) }))
    .filter((item) => item.decision !== "SKIP" || item.intelligenceV2.opportunitySignals.length > 0)
    .sort((a, b) => b.intelligenceV2.opportunityPriority - a.intelligenceV2.opportunityPriority)
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 12)));

  return {
    version: "scorecaster-opportunity-radar-v1",
    generatedAt: new Date().toISOString(),
    paperOnly: true,
    realMoneyActionAvailable: false,
    counts: {
      play: rows.filter((item) => item.decision === "PLAY").length,
      nearPlay: rows.filter((item) => item.intelligenceV2.nearPlay).length,
      evidenceBottleneck: rows.filter((item) => item.intelligenceV2.opportunitySignals.some((signal) => signal.code === "evidence-bottleneck")).length,
      priceBottleneck: rows.filter((item) => item.intelligenceV2.opportunitySignals.some((signal) => signal.code === "price-bottleneck")).length
    },
    opportunities: rows
  };
}

export function buildCurrentWindowLeagueReadiness(recommendations = []) {
  const groups = new Map();
  for (const item of Array.isArray(recommendations) ? recommendations : []) {
    const league = String(item.league || item.sportTitle || item.sportKey || "unknown");
    if (!groups.has(league)) groups.set(league, []);
    groups.get(league).push(item);
  }

  return [...groups.entries()].map(([league, rows]) => {
    const averageBookmakers = rows.reduce((sum, item) => sum + finite(item.bookmakerCount), 0) / rows.length;
    const averageConfidence = rows.reduce((sum, item) => sum + finite(item.confidence), 0) / rows.length;
    const verified = rows.filter((item) => String(item.readiness).toLowerCase() === "verified").length;
    const stale = rows.filter((item) => String(item.freshness).toLowerCase() === "stale").length;
    const verifiedRate = verified / rows.length;
    const freshRate = 1 - stale / rows.length;
    let status = "insufficient";
    if (averageBookmakers >= 6 && averageConfidence >= 0.65 && verifiedRate >= 0.5 && freshRate >= 0.8) status = "full";
    else if (averageBookmakers >= 4 && averageConfidence >= 0.55 && freshRate >= 0.6) status = "partial";

    return {
      league,
      status,
      sampleSize: rows.length,
      averageBookmakers: Number(averageBookmakers.toFixed(1)),
      averageConfidence: Number(averageConfidence.toFixed(3)),
      verifiedEvidenceRate: Number(verifiedRate.toFixed(3)),
      freshRate: Number(freshRate.toFixed(3)),
      playCount: rows.filter((item) => item.decision === "PLAY").length,
      cautionCount: rows.filter((item) => item.decision === "CAUTION").length,
      limitation: "Current live recommendation window only; this is not a historical league-quality rating."
    };
  }).sort((a, b) => {
    const order = { full: 3, partial: 2, insufficient: 1 };
    return (order[b.status] - order[a.status]) || b.sampleSize - a.sampleSize || a.league.localeCompare(b.league);
  });
}

export { VISIBLE_PLAY_GATES, SCORE_WEIGHTS };
