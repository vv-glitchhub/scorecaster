import {
  DEFAULT_THRESHOLDS,
  normalizeDiagnosticDecision,
  summarizeDecisionDiagnostics
} from "./decision-diagnostics.mjs";

const ALERT_RULES = Object.freeze({
  staleRate: 0.5,
  providerCoverage: 0.35,
  noPlaySnapshots: 6
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function normalizeResult(value) {
  const result = String(value || "").toLowerCase();
  if (["won", "win"].includes(result)) return "won";
  if (["lost", "loss"].includes(result)) return "lost";
  if (["void", "push"].includes(result)) return result;
  return "open";
}

function reasonCodesFromBet(bet = {}) {
  const raw = bet.raw_pick || {};
  if (Array.isArray(raw.decisionReasons)) return raw.decisionReasons.filter(Boolean);
  if (Array.isArray(raw.decision_reasons)) return raw.decision_reasons.filter(Boolean);
  if (raw.skipReason) return [String(raw.skipReason)];
  if (raw.skip_reason) return [String(raw.skip_reason)];
  return [];
}

export function buildProviderHealth(payload = {}, diagnostics = summarizeDecisionDiagnostics(payload)) {
  const providerGames = Math.max(0, finite(payload.providerGames));
  const acceptedGames = Math.max(0, finite(payload.acceptedGames));
  const excludedGames = Math.max(0, finite(payload.excludedGames, providerGames - acceptedGames));
  const coverageRate = providerGames > 0 ? acceptedGames / providerGames : diagnostics.total > 0 ? 1 : 0;
  const staleRate = finite(diagnostics.dataQuality?.staleRate);
  const averageBookmakers = diagnostics.dataQuality?.averageBookmakers;
  const averageConfidence = diagnostics.dataQuality?.averageConfidence;
  const sourceLive = payload.fixtureSource === "live-odds-provider-only" || payload.source === "no-vig-market-consensus";

  let status = "healthy";
  const reasons = [];
  if (!sourceLive || (providerGames === 0 && diagnostics.total === 0)) {
    status = "down";
    reasons.push("provider-unavailable");
  } else {
    if (coverageRate < ALERT_RULES.providerCoverage) reasons.push("low-fixture-acceptance");
    if (staleRate >= ALERT_RULES.staleRate) reasons.push("stale-market-data");
    if (averageBookmakers !== null && averageBookmakers < DEFAULT_THRESHOLDS.minimumWatchBookmakers) reasons.push("weak-bookmaker-coverage");
    if (averageConfidence !== null && averageConfidence < DEFAULT_THRESHOLDS.minimumWatchConfidence) reasons.push("low-market-confidence");
    if (reasons.length) status = "degraded";
  }

  const leagueRows = diagnostics.leagues.map((league) => {
    const leagueStaleRate = league.total ? league.stale / league.total : 0;
    const leagueStatus = league.total === 0
      ? "empty"
      : leagueStaleRate >= ALERT_RULES.staleRate || finite(league.averageBookmakers) < DEFAULT_THRESHOLDS.minimumWatchBookmakers
        ? "degraded"
        : "healthy";
    return {
      ...league,
      staleRate: leagueStaleRate,
      status: leagueStatus
    };
  });

  const score = status === "down"
    ? 0
    : Math.round(Math.max(0, Math.min(100,
        coverageRate * 40 +
        (1 - staleRate) * 25 +
        Math.min(1, finite(averageBookmakers) / 6) * 20 +
        Math.min(1, finite(averageConfidence) / 0.7) * 15
      )));

  return {
    version: "provider-health-v1",
    status,
    score,
    reasons,
    source: payload.source || "unknown",
    fixtureSource: payload.fixtureSource || "unknown",
    generatedAt: payload.generatedAt || null,
    providerGames,
    acceptedGames,
    excludedGames,
    coverageRate,
    staleRate,
    averageBookmakers,
    averageConfidence,
    selectedLeagues: Array.isArray(payload.leagues) ? payload.leagues : [],
    leagues: leagueRows
  };
}

export function simulateDecisionThresholds(picks = [], overrides = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...overrides };
  const counts = { PLAY: 0, CAUTION: 0, SKIP: 0 };
  const decisions = picks.map((pick, index) => {
    const bookmakerCount = finite(pick.dataGate?.bookmakerCount ?? pick.bookmakerCount ?? pick.dataQuality?.bookmakerCount);
    const confidence = finite(pick.dataGate?.confidence ?? pick.confidence ?? pick.dataQuality?.confidence);
    const freshness = String(pick.dataGate?.freshness || pick.freshnessLabel || pick.dataQuality?.freshness || "unknown").toLowerCase();
    const stale = pick.dataGate?.stale === true || freshness === "stale";
    const edge = finite(pick.edge);
    const ev = finite(pick.ev);
    const qualityGrade = String(pick.qualityGrade || "").toUpperCase();
    const readiness = String(pick.sportsIntelligence?.readiness?.level || "market-only");
    const conflicts = Array.isArray(pick.sportsIntelligence?.conflicts) ? pick.sportsIntelligence.conflicts.length : 0;
    const impact = finite(pick.intelligenceRelativeImpact);

    const watchable = !stale && bookmakerCount >= thresholds.minimumWatchBookmakers && confidence >= thresholds.minimumWatchConfidence && edge >= thresholds.minimumWatchEdge && ev > 0;
    const marketPlayable = watchable && bookmakerCount >= thresholds.minimumPlayBookmakers && confidence >= thresholds.minimumPlayConfidence && edge >= thresholds.minimumPlayEdge && ev >= thresholds.minimumPlayEv && ["A", "B", "C"].includes(qualityGrade);
    const evidencePlayable = readiness === "verified" && conflicts === 0 && impact > -0.015;
    const decision = !watchable ? "SKIP" : marketPlayable && evidencePlayable ? "PLAY" : "CAUTION";
    counts[decision] += 1;

    return {
      id: String(pick.id || pick.gameId || pick.eventId || index),
      match: pick.match || `${pick.homeTeam || "Home"} vs ${pick.awayTeam || "Away"}`,
      selection: pick.selection || pick.label || "–",
      currentDecision: normalizeDiagnosticDecision(pick),
      simulatedDecision: decision,
      edge,
      ev,
      confidence,
      bookmakerCount,
      freshness,
      marketPlayable,
      evidencePlayable
    };
  });

  const changed = decisions.filter((item) => item.currentDecision !== item.simulatedDecision);
  return {
    version: "threshold-simulator-v1",
    descriptiveOnly: true,
    thresholds,
    total: decisions.length,
    counts,
    changedCount: changed.length,
    changed,
    decisions
  };
}

export function analyzeDecisionOutcomes(bets = []) {
  const settled = bets.filter((bet) => ["won", "lost", "void", "push"].includes(normalizeResult(bet.status || bet.result)));
  const groups = new Map();
  const reasonGroups = new Map();

  for (const bet of settled) {
    const decision = normalizeDiagnosticDecision({ decision: bet.raw_pick?.decision || bet.decision || "PLAY" });
    const status = normalizeResult(bet.status || bet.result);
    const stake = Math.max(0, finite(bet.stake));
    const profit = finite(bet.profit);
    const clv = Number(bet.clv);
    const group = groups.get(decision) || {
      decision,
      settled: 0,
      wins: 0,
      losses: 0,
      voids: 0,
      stake: 0,
      profit: 0,
      clvValues: [],
      positiveClv: 0,
      edgeValues: []
    };
    group.settled += 1;
    if (status === "won") group.wins += 1;
    if (status === "lost") group.losses += 1;
    if (status === "void" || status === "push") group.voids += 1;
    group.stake += stake;
    group.profit += profit;
    if (Number.isFinite(clv)) {
      group.clvValues.push(clv);
      if (clv > 0) group.positiveClv += 1;
    }
    if (Number.isFinite(Number(bet.edge))) group.edgeValues.push(Number(bet.edge));
    groups.set(decision, group);

    for (const reason of reasonCodesFromBet(bet)) {
      const key = String(reason);
      const reasonGroup = reasonGroups.get(key) || { reason: key, settled: 0, wins: 0, stake: 0, profit: 0, clvValues: [] };
      reasonGroup.settled += 1;
      if (status === "won") reasonGroup.wins += 1;
      reasonGroup.stake += stake;
      reasonGroup.profit += profit;
      if (Number.isFinite(clv)) reasonGroup.clvValues.push(clv);
      reasonGroups.set(key, reasonGroup);
    }
  }

  function finalize(group) {
    const decided = group.wins + group.losses;
    return {
      decision: group.decision,
      settled: group.settled,
      wins: group.wins,
      losses: group.losses,
      voids: group.voids,
      stake: Number(group.stake.toFixed(2)),
      profit: Number(group.profit.toFixed(2)),
      roi: group.stake > 0 ? group.profit / group.stake : 0,
      winRate: decided ? group.wins / decided : 0,
      averageClv: average(group.clvValues),
      positiveClvRate: group.clvValues.length ? group.positiveClv / group.clvValues.length : null,
      averageEdge: average(group.edgeValues)
    };
  }

  const byDecision = ["PLAY", "CAUTION", "SKIP"].map((decision) => finalize(groups.get(decision) || {
    decision, settled: 0, wins: 0, losses: 0, voids: 0, stake: 0, profit: 0, clvValues: [], positiveClv: 0, edgeValues: []
  }));
  const totalStake = settled.reduce((sum, bet) => sum + Math.max(0, finite(bet.stake)), 0);
  const totalProfit = settled.reduce((sum, bet) => sum + finite(bet.profit), 0);
  const clvValues = settled.map((bet) => Number(bet.clv)).filter(Number.isFinite);

  return {
    version: "decision-outcomes-v1",
    authenticatedSample: true,
    totalBets: bets.length,
    settled: settled.length,
    totalStake: Number(totalStake.toFixed(2)),
    totalProfit: Number(totalProfit.toFixed(2)),
    roi: totalStake > 0 ? totalProfit / totalStake : 0,
    averageClv: average(clvValues),
    positiveClvRate: clvValues.length ? clvValues.filter((value) => value > 0).length / clvValues.length : null,
    byDecision,
    byReason: [...reasonGroups.values()].map((group) => ({
      reason: group.reason,
      settled: group.settled,
      winRate: group.settled ? group.wins / group.settled : 0,
      profit: Number(group.profit.toFixed(2)),
      roi: group.stake > 0 ? group.profit / group.stake : 0,
      averageClv: average(group.clvValues)
    })).sort((left, right) => right.settled - left.settled),
    limitation: "Only saved and settled paper selections can be evaluated. Unsaved CAUTION and SKIP selections remain counterfactual until shadow settlement is added."
  };
}

export function buildDiagnosticSnapshot(payload = {}, options = {}) {
  const diagnostics = summarizeDecisionDiagnostics(payload);
  const providerHealth = buildProviderHealth(payload, diagnostics);
  const simulation = simulateDecisionThresholds(diagnostics.picks, options.thresholds || {});
  return {
    version: "decision-diagnostics-v2",
    capturedAt: options.capturedAt || new Date().toISOString(),
    source: diagnostics.source,
    fixtureSource: diagnostics.fixtureSource,
    leagueSelectionMode: diagnostics.leagueSelectionMode,
    defaultLeagueSeason: diagnostics.defaultLeagueSeason,
    selectedLeagues: diagnostics.selectedLeagues,
    status: diagnostics.status,
    total: diagnostics.total,
    counts: diagnostics.counts,
    rates: diagnostics.rates,
    dataQuality: diagnostics.dataQuality,
    freshness: diagnostics.freshness,
    reasons: diagnostics.reasons,
    leagues: diagnostics.leagues,
    thresholds: diagnostics.thresholds,
    providerHealth,
    simulation,
    picks: diagnostics.picks.map((pick) => ({
      id: pick.diagnosticId,
      eventId: pick.gameId || pick.eventId || null,
      sportKey: pick.sportKey || pick.league || null,
      match: pick.match || null,
      selection: pick.selection || pick.label || null,
      decision: pick.diagnosticDecision,
      reasons: pick.diagnosticReasonCodes,
      odds: finite(pick.odds),
      edge: finite(pick.edge),
      ev: finite(pick.ev),
      confidence: finite(pick.confidence),
      bookmakerCount: finite(pick.bookmakerCount),
      freshness: pick.diagnosticFreshness,
      league: pick.diagnosticLeague
    }))
  };
}

export function evaluateDiagnosticAlerts(snapshot = {}, history = [], rules = {}) {
  const config = { ...ALERT_RULES, ...rules };
  const alerts = [];
  const now = snapshot.capturedAt || new Date().toISOString();
  const staleRate = finite(snapshot.dataQuality?.staleRate);

  if (snapshot.total > 0 && finite(snapshot.counts?.SKIP) === snapshot.total) {
    alerts.push({
      fingerprint: "diagnostics:all-skip",
      alertType: "all_skip",
      severity: "high",
      title: "All current selections are SKIP",
      message: "Every current selection is blocked by at least one safety gate.",
      details: { total: snapshot.total, topReason: snapshot.reasons?.[0] || null },
      active: true,
      detectedAt: now
    });
  }

  if (snapshot.total > 0 && staleRate >= config.staleRate) {
    alerts.push({
      fingerprint: "diagnostics:stale-data",
      alertType: "stale_data",
      severity: "high",
      title: "Most market data is stale",
      message: `${Math.round(staleRate * 100)}% of current selections use stale odds data.`,
      details: { staleRate, threshold: config.staleRate },
      active: true,
      detectedAt: now
    });
  }

  if (["degraded", "down"].includes(snapshot.providerHealth?.status)) {
    alerts.push({
      fingerprint: "diagnostics:provider-health",
      alertType: "provider_health",
      severity: snapshot.providerHealth.status === "down" ? "high" : "medium",
      title: snapshot.providerHealth.status === "down" ? "Odds provider is unavailable" : "Odds provider health is degraded",
      message: `Provider health score is ${snapshot.providerHealth.score}/100.`,
      details: snapshot.providerHealth,
      active: true,
      detectedAt: now
    });
  }

  const recent = [snapshot, ...history]
    .filter((item) => Number(item?.total ?? 0) > 0)
    .slice(0, config.noPlaySnapshots);
  if (recent.length >= config.noPlaySnapshots && recent.every((item) => finite(item.counts?.PLAY ?? item.play_count) === 0)) {
    alerts.push({
      fingerprint: "diagnostics:no-play-streak",
      alertType: "no_play_streak",
      severity: "medium",
      title: "No PLAY selections across recent snapshots",
      message: `The last ${config.noPlaySnapshots} non-empty diagnostic snapshots contained no PLAY selections.`,
      details: { snapshots: config.noPlaySnapshots },
      active: true,
      detectedAt: now
    });
  }

  return alerts;
}

export { ALERT_RULES };