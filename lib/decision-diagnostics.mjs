const DEFAULT_THRESHOLDS = Object.freeze({
  minimumWatchEdge: 0.005,
  minimumPlayEdge: 0.02,
  minimumPlayEv: 0.03,
  minimumWatchConfidence: 0.35,
  minimumPlayConfidence: 0.55,
  minimumWatchBookmakers: 2,
  minimumPlayBookmakers: 4
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  const numbers = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeDiagnosticDecision(pick = {}) {
  const value = String(pick.productDecision || pick.decision || "CAUTION").toUpperCase();
  if (value === "BET") return "PLAY";
  if (value === "PASS") return "SKIP";
  if (value === "WATCH" || value === "WAIT") return "CAUTION";
  return ["PLAY", "CAUTION", "SKIP"].includes(value) ? value : "CAUTION";
}

export function pickIdentity(pick = {}, index = 0) {
  return String(pick.id || pick.gameId || pick.eventId || `${pick.match || "pick"}-${pick.selection || pick.label || index}`);
}

export function diagnosticReasonCodes(pick = {}, thresholds = DEFAULT_THRESHOLDS) {
  const decision = normalizeDiagnosticDecision(pick);
  const gate = pick.dataGate || {};
  const bookmakerCount = finite(gate.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount);
  const confidence = finite(gate.confidence ?? pick.confidence ?? pick.dataQuality?.confidence);
  const freshness = String(gate.freshness || pick.freshnessLabel || pick.dataQuality?.freshness || "unknown").toLowerCase();
  const stale = gate.stale === true || freshness === "stale";
  const edge = finite(pick.edge);
  const ev = finite(pick.ev);
  const qualityGrade = String(pick.qualityGrade || "").toUpperCase();
  const readiness = String(pick.sportsIntelligence?.readiness?.level || "market-only");
  const conflicts = Array.isArray(pick.sportsIntelligence?.conflicts) ? pick.sportsIntelligence.conflicts.length : 0;
  const marketDecision = String(pick.marketDecisionBeforeSafetyGate || "").toUpperCase();
  const rawDecision = String(pick.decision || "").toUpperCase();
  const reasons = [];

  if (decision === "SKIP") {
    if (stale) reasons.push("stale-odds");
    if (bookmakerCount < thresholds.minimumWatchBookmakers) reasons.push("insufficient-bookmakers");
    if (confidence < thresholds.minimumWatchConfidence) reasons.push("low-market-confidence");
    if (edge < thresholds.minimumWatchEdge) reasons.push("edge-below-watch-floor");
    if (ev <= 0) reasons.push("non-positive-ev");
    if (!reasons.length) reasons.push("minimum-data-gate");
    return unique(reasons);
  }

  if (decision === "CAUTION") {
    if (marketDecision === "BET" && rawDecision !== "BET") reasons.push("intelligence-safety-downgrade");
    if (readiness !== "verified" && marketDecision === "BET") reasons.push("intelligence-not-verified");
    if (conflicts > 0) reasons.push("intelligence-conflict");
    if (bookmakerCount < thresholds.minimumPlayBookmakers) reasons.push("play-bookmaker-coverage");
    if (confidence < thresholds.minimumPlayConfidence) reasons.push("play-confidence");
    if (edge < thresholds.minimumPlayEdge) reasons.push("play-edge");
    if (ev < thresholds.minimumPlayEv) reasons.push("play-ev");
    if (qualityGrade && !["A", "B", "C"].includes(qualityGrade)) reasons.push("quality-grade");
    if (!reasons.length) reasons.push("safety-watch");
  }

  return unique(reasons);
}

function freshnessBucket(pick = {}) {
  const freshness = String(pick.dataGate?.freshness || pick.freshnessLabel || pick.dataQuality?.freshness || "unknown").toLowerCase();
  return ["fresh", "recent", "aging", "stale"].includes(freshness) ? freshness : "unknown";
}

function leagueName(pick = {}) {
  return String(pick.leagueTitle || pick.league || pick.sportTitle || pick.sportKey || "Unknown league");
}

function nearPlayScore(pick, thresholds) {
  const edge = finite(pick.edge);
  const ev = finite(pick.ev);
  const confidence = finite(pick.dataGate?.confidence ?? pick.confidence ?? pick.dataQuality?.confidence);
  const bookmakers = finite(pick.dataGate?.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount);
  const edgeGap = Math.max(0, thresholds.minimumPlayEdge - edge);
  const evGap = Math.max(0, thresholds.minimumPlayEv - ev);
  const confidenceGap = Math.max(0, thresholds.minimumPlayConfidence - confidence);
  const bookmakerGap = Math.max(0, thresholds.minimumPlayBookmakers - bookmakers);
  return edgeGap * 4 + evGap * 2.5 + confidenceGap * 0.5 + bookmakerGap * 0.02;
}

function isNearPlay(pick, thresholds) {
  if (normalizeDiagnosticDecision(pick) !== "CAUTION") return false;
  const gate = pick.dataGate || {};
  const freshness = freshnessBucket(pick);
  const bookmakers = finite(gate.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount);
  const confidence = finite(gate.confidence ?? pick.confidence ?? pick.dataQuality?.confidence);
  const edge = finite(pick.edge);
  const ev = finite(pick.ev);
  if (freshness === "stale" || bookmakers < thresholds.minimumWatchBookmakers || confidence < thresholds.minimumWatchConfidence) return false;
  return edge >= 0.01 || ev >= 0.015 || String(pick.marketDecisionBeforeSafetyGate || "").toUpperCase() === "BET";
}

export function summarizeDecisionDiagnostics(input = {}, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const picks = Array.isArray(input) ? input : Array.isArray(input.data) ? input.data : [];
  const counts = { PLAY: 0, CAUTION: 0, SKIP: 0 };
  const freshness = { fresh: 0, recent: 0, aging: 0, stale: 0, unknown: 0 };
  const reasonMap = new Map();
  const leagueMap = new Map();
  const decorated = picks.map((pick, index) => {
    const decision = normalizeDiagnosticDecision(pick);
    const reasonCodes = diagnosticReasonCodes(pick, thresholds);
    const bucket = freshnessBucket(pick);
    const league = leagueName(pick);
    counts[decision] += 1;
    freshness[bucket] += 1;

    for (const code of reasonCodes) {
      const current = reasonMap.get(code) || { code, count: 0, decisions: { PLAY: 0, CAUTION: 0, SKIP: 0 } };
      current.count += 1;
      current.decisions[decision] += 1;
      reasonMap.set(code, current);
    }

    const currentLeague = leagueMap.get(league) || {
      league,
      total: 0,
      PLAY: 0,
      CAUTION: 0,
      SKIP: 0,
      bookmakerCounts: [],
      confidences: [],
      ages: [],
      stale: 0
    };
    currentLeague.total += 1;
    currentLeague[decision] += 1;
    currentLeague.bookmakerCounts.push(finite(pick.dataGate?.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount));
    currentLeague.confidences.push(finite(pick.dataGate?.confidence ?? pick.confidence ?? pick.dataQuality?.confidence));
    const age = finite(pick.dataAgeHours ?? pick.dataQuality?.ageHours, NaN);
    if (Number.isFinite(age)) currentLeague.ages.push(age);
    if (bucket === "stale") currentLeague.stale += 1;
    leagueMap.set(league, currentLeague);

    return {
      ...pick,
      diagnosticId: pickIdentity(pick, index),
      diagnosticDecision: decision,
      diagnosticReasonCodes: reasonCodes,
      diagnosticFreshness: bucket,
      diagnosticLeague: league,
      nearPlayScore: nearPlayScore(pick, thresholds)
    };
  });

  const total = picks.length;
  const averageBookmakers = average(decorated.map((pick) => pick.dataGate?.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount));
  const averageConfidence = average(decorated.map((pick) => pick.dataGate?.confidence ?? pick.confidence ?? pick.dataQuality?.confidence));
  const averageAgeHours = average(decorated.map((pick) => pick.dataAgeHours ?? pick.dataQuality?.ageHours));
  const allSkip = total > 0 && counts.SKIP === total;
  const noPlay = total > 0 && counts.PLAY === 0;
  const status = total === 0 ? "empty" : allSkip ? "blocked" : noPlay ? "watch" : "healthy";

  const reasons = [...reasonMap.values()].sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
  const leagues = [...leagueMap.values()]
    .map((league) => ({
      league: league.league,
      total: league.total,
      PLAY: league.PLAY,
      CAUTION: league.CAUTION,
      SKIP: league.SKIP,
      averageBookmakers: average(league.bookmakerCounts),
      averageConfidence: average(league.confidences),
      averageAgeHours: average(league.ages),
      stale: league.stale
    }))
    .sort((left, right) => right.total - left.total || left.league.localeCompare(right.league));

  const nearPlay = decorated
    .filter((pick) => isNearPlay(pick, thresholds))
    .sort((left, right) => left.nearPlayScore - right.nearPlayScore || finite(right.edge) - finite(left.edge))
    .slice(0, 8);

  const safetyDowngrades = decorated
    .filter((pick) => String(pick.marketDecisionBeforeSafetyGate || "").toUpperCase() === "BET" && pick.diagnosticDecision !== "PLAY")
    .sort((left, right) => finite(right.edge) - finite(left.edge))
    .slice(0, 8);

  return {
    version: "decision-diagnostics-v1",
    generatedAt: Array.isArray(input) ? null : input.generatedAt || null,
    source: Array.isArray(input) ? null : input.source || null,
    fixtureSource: Array.isArray(input) ? null : input.fixtureSource || null,
    leagueSelectionMode: Array.isArray(input) ? null : input.leagueSelectionMode || null,
    defaultLeagueSeason: Array.isArray(input) ? null : input.defaultLeagueSeason || null,
    selectedLeagues: Array.isArray(input) ? [] : Array.isArray(input.leagues) ? input.leagues : [],
    total,
    counts,
    rates: {
      PLAY: total ? counts.PLAY / total : 0,
      CAUTION: total ? counts.CAUTION / total : 0,
      SKIP: total ? counts.SKIP / total : 0
    },
    status,
    allSkip,
    noPlay,
    freshness,
    dataQuality: {
      averageBookmakers,
      averageConfidence,
      averageAgeHours,
      staleRate: total ? freshness.stale / total : 0
    },
    thresholds,
    reasons,
    leagues,
    nearPlay,
    safetyDowngrades,
    picks: decorated
  };
}

export { DEFAULT_THRESHOLDS };
