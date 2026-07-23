const MIN_ODDS = 1.01;
const MAX_ODDS = 20;
const MAX_CONTEXT_IMPACT = 0.06;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalFinite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function text(value, maximum = 240, fallback = "") {
  return String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalized(value) {
  return text(value, 240).toLowerCase();
}

function isoDay(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

function resultProfit(row = {}) {
  const stake = Math.max(0, finite(row.stake));
  const odds = Math.max(MIN_ODDS, finite(row.odds, MIN_ODDS));
  const status = text(row.status, 20).toLowerCase();
  if (status === "won" || status === "win") return stake * (odds - 1);
  if (status === "lost" || status === "loss") return -stake;
  return 0;
}

function rowProbability(row = {}) {
  const raw = row.raw_pick || row.rawPick || {};
  return optionalFinite(raw.modelProbability ?? raw.consensusProbability ?? row.model_probability);
}

function rowClosingOdds(row = {}) {
  return optionalFinite(row.closing_odds ?? row.closingOdds);
}

function rowClv(row = {}) {
  const explicit = optionalFinite(row.clv);
  if (explicit !== null) return explicit;
  const odds = optionalFinite(row.odds);
  const closing = rowClosingOdds(row);
  if (!odds || !closing || odds <= 1 || closing <= 1) return null;
  return odds / closing - 1;
}

function outcomeValue(row = {}) {
  const status = text(row.status, 20).toLowerCase();
  if (status === "won" || status === "win") return 1;
  if (status === "lost" || status === "loss") return 0;
  return null;
}

function calculateDrawdown(rows = []) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.created_at || a.createdAt || 0) - Date.parse(b.created_at || b.createdAt || 0));
  let equity = 0;
  let peak = 0;
  let maximum = 0;
  for (const row of ordered) {
    equity += resultProfit(row);
    peak = Math.max(peak, equity);
    maximum = Math.max(maximum, peak - equity);
  }
  return maximum;
}

function calculateLosingStreak(rows = []) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.created_at || a.createdAt || 0) - Date.parse(b.created_at || b.createdAt || 0));
  let current = 0;
  let maximum = 0;
  for (const row of ordered) {
    const status = text(row.status, 20).toLowerCase();
    if (status === "lost" || status === "loss") {
      current += 1;
      maximum = Math.max(maximum, current);
    } else if (status === "won" || status === "win") {
      current = 0;
    }
  }
  return { current, maximum };
}

function aggregatePerformance(rows = [], now = new Date()) {
  const settled = rows.filter((row) => outcomeValue(row) !== null || ["push", "void"].includes(text(row.status, 20).toLowerCase()));
  const decisions = settled.filter((row) => outcomeValue(row) !== null);
  const staked = settled.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const profit = settled.reduce((sum, row) => sum + resultProfit(row), 0);
  const wins = decisions.filter((row) => outcomeValue(row) === 1).length;
  const losses = decisions.filter((row) => outcomeValue(row) === 0).length;
  const clvRows = settled.map(rowClv).filter((value) => value !== null);
  const probabilityRows = decisions
    .map((row) => ({ probability: rowProbability(row), outcome: outcomeValue(row) }))
    .filter((row) => row.probability !== null && row.probability > 0 && row.probability < 1);
  const brier = probabilityRows.length
    ? probabilityRows.reduce((sum, row) => sum + (row.probability - row.outcome) ** 2, 0) / probabilityRows.length
    : null;
  const logLoss = probabilityRows.length
    ? -probabilityRows.reduce((sum, row) => {
      const p = clamp(row.probability, 0.001, 0.999);
      return sum + row.outcome * Math.log(p) + (1 - row.outcome) * Math.log(1 - p);
    }, 0) / probabilityRows.length
    : null;
  const last30Start = new Date(now);
  last30Start.setUTCDate(last30Start.getUTCDate() - 30);
  const recent = settled.filter((row) => Date.parse(row.created_at || row.createdAt || 0) >= last30Start.getTime());
  const recentStake = recent.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const recentProfit = recent.reduce((sum, row) => sum + resultProfit(row), 0);
  const streak = calculateLosingStreak(settled);
  return {
    sampleSize: settled.length,
    decisionSample: decisions.length,
    wins,
    losses,
    pushes: settled.length - decisions.length,
    winRate: decisions.length ? round(wins / decisions.length, 4) : null,
    staked: round(staked, 2),
    profit: round(profit, 2),
    roi: staked > 0 ? round(profit / staked, 4) : null,
    averageClv: clvRows.length ? round(clvRows.reduce((sum, value) => sum + value, 0) / clvRows.length, 4) : null,
    positiveClvRate: clvRows.length ? round(clvRows.filter((value) => value > 0).length / clvRows.length, 4) : null,
    clvSample: clvRows.length,
    brier: round(brier, 5),
    logLoss: round(logLoss, 5),
    probabilitySample: probabilityRows.length,
    maxDrawdown: round(calculateDrawdown(settled), 2),
    currentLosingStreak: streak.current,
    maximumLosingStreak: streak.maximum,
    recent30: {
      sampleSize: recent.length,
      profit: round(recentProfit, 2),
      roi: recentStake > 0 ? round(recentProfit / recentStake, 4) : null
    }
  };
}

function calibrationMetrics(rows = []) {
  const usable = rows.filter((row) => {
    const probability = optionalFinite(row.model_probability ?? row.modelProbability);
    const outcome = optionalFinite(row.outcome);
    return probability !== null && probability > 0 && probability < 1 && (outcome === 0 || outcome === 1);
  });
  const buckets = new Map();
  for (const row of usable) {
    const probability = clamp(row.model_probability ?? row.modelProbability, 0.001, 0.999);
    const bucket = Math.min(9, Math.floor(probability * 10));
    const existing = buckets.get(bucket) || { bucket, count: 0, predicted: 0, actual: 0 };
    existing.count += 1;
    existing.predicted += probability;
    existing.actual += finite(row.outcome);
    buckets.set(bucket, existing);
  }
  const normalizedBuckets = [...buckets.values()].map((bucket) => ({
    bucket: `${bucket.bucket * 10}-${bucket.bucket * 10 + 10}%`,
    count: bucket.count,
    predicted: round(bucket.predicted / bucket.count, 4),
    actual: round(bucket.actual / bucket.count, 4),
    gap: round(Math.abs(bucket.predicted / bucket.count - bucket.actual / bucket.count), 4)
  }));
  const expectedCalibrationError = usable.length
    ? normalizedBuckets.reduce((sum, bucket) => sum + bucket.gap * bucket.count / usable.length, 0)
    : null;
  return {
    sampleSize: usable.length,
    expectedCalibrationError: round(expectedCalibrationError, 5),
    buckets: normalizedBuckets
  };
}

export function buildAutonomousV12LearningReport({ history = [], calibration = [], now = new Date() } = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  const performance = aggregatePerformance(history, clock);
  const calibrationReport = calibrationMetrics(calibration);
  const driftReasons = [];
  if (performance.clvSample >= 40 && finite(performance.averageClv) < -0.015) driftReasons.push("negative_clv");
  if (performance.probabilitySample >= 80 && finite(performance.brier, 1) > 0.27) driftReasons.push("brier_regression");
  if (calibrationReport.sampleSize >= 80 && finite(calibrationReport.expectedCalibrationError, 1) > 0.08) driftReasons.push("calibration_drift");
  if (performance.currentLosingStreak >= 8) driftReasons.push("loss_streak");
  const status = driftReasons.length >= 2 ? "critical" : driftReasons.length ? "watch" : performance.sampleSize >= 120 ? "healthy" : "learning";
  const challengerEligible = performance.sampleSize >= 200
    && performance.clvSample >= 120
    && finite(performance.averageClv, -1) >= 0
    && performance.probabilitySample >= 120
    && finite(performance.brier, 1) <= 0.25
    && finite(calibrationReport.expectedCalibrationError, 1) <= 0.06;
  return {
    version: "autonomous-scorecaster-v12-learning-v1",
    generatedAt: clock.toISOString(),
    status,
    driftReasons,
    performance,
    calibration: calibrationReport,
    champion: {
      id: "market-consensus-safety-champion",
      probabilitySource: "no-vig market consensus",
      productionProbabilityChanged: false
    },
    challenger: {
      id: "strict-evidence-shadow-challenger",
      mode: "shadow-only",
      eligibleForShadowChampion: challengerEligible,
      automaticProductionPromotion: false,
      requiredEvidence: {
        settledSample: 200,
        clvSample: 120,
        probabilitySample: 120,
        minimumAverageClv: 0,
        maximumBrier: 0.25,
        maximumCalibrationError: 0.06
      }
    }
  };
}

export function evaluateAutonomousV12CircuitBreakers({
  learning = {},
  system = {},
  bankroll = {},
  todayRows = [],
  openBets = []
} = {}) {
  const reasons = [];
  const warnings = [];
  const bankrollValue = Math.max(1, finite(bankroll.bankroll, 1000));
  const dailyProfit = todayRows.reduce((sum, row) => sum + resultProfit(row), 0);
  const dailyLossRate = dailyProfit < 0 ? Math.abs(dailyProfit) / bankrollValue : 0;
  const openExposure = openBets.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const providerScore = optionalFinite(system.providerScore);
  const staleRate = optionalFinite(system.staleRate);
  const settlementBacklog = Math.max(0, finite(system.settlementBacklog));
  const captureAgeMinutes = optionalFinite(system.captureAgeMinutes);

  if (system.killSwitch === true) reasons.push("manual_kill_switch");
  if (system.paperTradingMode === false) reasons.push("paper_mode_disabled");
  if (system.oddsProviderConfigured === false) reasons.push("odds_provider_not_configured");
  if (system.topPicksAvailable === false) reasons.push("top_picks_unavailable");
  if (providerScore !== null && providerScore < 35) reasons.push("provider_health_critical");
  if (staleRate !== null && staleRate >= 0.5) reasons.push("market_data_stale");
  if (captureAgeMinutes !== null && captureAgeMinutes > 120) reasons.push("unified_data_capture_stale");
  if (settlementBacklog >= 100) reasons.push("settlement_backlog_critical");
  if (learning.status === "critical") reasons.push("learning_drift_critical");
  if (dailyLossRate >= 0.04) reasons.push("daily_loss_stop");
  if (finite(learning.performance?.currentLosingStreak) >= 10) reasons.push("loss_streak_stop");
  if (finite(learning.performance?.maxDrawdown) / bankrollValue >= 0.15) reasons.push("drawdown_stop");

  if (providerScore !== null && providerScore < 65) warnings.push("provider_health_degraded");
  if (staleRate !== null && staleRate >= 0.2) warnings.push("market_freshness_watch");
  if (settlementBacklog >= 25) warnings.push("settlement_backlog_watch");
  if (learning.status === "watch") warnings.push("learning_drift_watch");
  if (dailyLossRate >= 0.02) warnings.push("daily_loss_watch");
  if (openExposure / bankrollValue >= 0.08) warnings.push("open_exposure_high");

  return {
    paused: reasons.length > 0,
    state: reasons.length ? "PAUSED" : warnings.length ? "CAUTION" : "RUNNING",
    reasons,
    warnings,
    metrics: {
      dailyProfit: round(dailyProfit, 2),
      dailyLossRate: round(dailyLossRate, 4),
      openExposure: round(openExposure, 2),
      openExposureRate: round(openExposure / bankrollValue, 4),
      providerScore,
      staleRate,
      settlementBacklog,
      captureAgeMinutes
    }
  };
}

export function buildAutonomousV12Policy({ settings = {}, bankroll = {}, learning = {}, circuit = {} } = {}) {
  const userPickLimit = Math.max(1, Math.min(5, Math.trunc(finite(settings.dailyPickLimit ?? settings.daily_pick_limit, 3))));
  const userStake = clamp(bankroll.maxStakePercent ?? bankroll.max_stake_percent ?? 1, 0.1, 5);
  const userExposure = clamp(bankroll.maxTotalExposurePercent ?? bankroll.max_daily_exposure_percent ?? 6, 0.5, 20);
  const userLeagueExposure = clamp(bankroll.maxLeagueExposurePercent ?? bankroll.max_single_league_exposure_percent ?? 3, 0.25, 10);
  let riskScale = 1;
  let evidenceBoost = 0;
  let maxPicks = userPickLimit;
  if (circuit.state === "CAUTION") {
    riskScale *= 0.5;
    evidenceBoost += 0.05;
    maxPicks = Math.min(maxPicks, 2);
  }
  if (learning.status === "watch") {
    riskScale *= 0.65;
    evidenceBoost += 0.04;
    maxPicks = Math.min(maxPicks, 2);
  }
  if (learning.performance?.clvSample >= 40 && finite(learning.performance?.averageClv) < 0) {
    riskScale *= 0.75;
    evidenceBoost += 0.03;
  }
  if (learning.performance?.sampleSize < 120) {
    riskScale *= 0.75;
    maxPicks = Math.min(maxPicks, 2);
  }
  if (circuit.paused) {
    riskScale = 0;
    maxPicks = 0;
  }
  return {
    version: "autonomous-scorecaster-v12-policy-v1",
    state: circuit.state || "RUNNING",
    maxPicks,
    minPriorityScore: clamp(finite(settings.minPriorityScore ?? settings.min_priority_score, 0.62) + evidenceBoost, 0.5, 0.95),
    minOdds: clamp(settings.minOdds ?? settings.min_odds ?? 1.2, MIN_ODDS, MAX_ODDS),
    maxOdds: clamp(settings.maxOdds ?? settings.max_odds ?? 5, MIN_ODDS, MAX_ODDS),
    minEdge: clamp(finite(bankroll.minEdge ?? bankroll.min_edge, 0.025) + evidenceBoost * 0.15, 0, 0.5),
    minConfidence: clamp(finite(bankroll.minConfidence ?? bankroll.min_confidence, 0.58) + evidenceBoost, 0, 1),
    minBookmakers: circuit.state === "CAUTION" ? 5 : 4,
    minVerifiedCoverage: circuit.state === "CAUTION" ? 0.5 : 0.35,
    maxStakePercent: round(userStake * riskScale, 3),
    maxTotalExposurePercent: round(userExposure * Math.max(0.35, riskScale), 3),
    maxLeagueExposurePercent: round(userLeagueExposure * Math.max(0.4, riskScale), 3),
    kellyFraction: round(0.25 * riskScale, 3),
    riskScale: round(riskScale, 3),
    automaticRelaxationAllowed: false,
    canUpgradeDecision: false,
    paperOnly: true
  };
}

function pickId(pick = {}) {
  return text(pick.eventId || pick.gameId || pick.id, 180);
}

function pickSelection(pick = {}) {
  return text(pick.selection || pick.label, 160);
}

function pickLeague(pick = {}) {
  return text(pick.league || pick.leagueTitle || pick.sportKey || pick.sport, 120, "unknown");
}

function probabilityForStake(pick = {}) {
  return optionalFinite(pick.stressTest?.probability ?? pick.consensusProbability ?? pick.modelProbability ?? pick.marketProbability);
}

function kellyStakePercent(probability, odds, fraction) {
  if (!(probability > 0 && probability < 1 && odds > 1)) return 0;
  const b = odds - 1;
  const fullKelly = (probability * odds - 1) / b;
  return clamp(fullKelly * fraction * 100, 0, 5);
}

function candidateReasons(pick, policy) {
  const reasons = [];
  const decision = text(pick.productDecision || pick.decision, 20).toUpperCase();
  const odds = finite(pick.odds);
  const edge = finite(pick.edge, -1);
  const confidence = finite(pick.confidence, -1);
  const priority = finite(pick.priorityScore, -1);
  const bookmakerCount = finite(pick.bookmakerCount);
  const coverage = finite(pick.unifiedSportsData?.coverage?.verifiedCoverageRate);
  const providerCount = finite(pick.unifiedSportsData?.coverage?.independentOddsProviders, 1);
  if (decision !== "PLAY" && decision !== "BET") reasons.push("not_play");
  if (pick.unifiedDataSafetyDowngrade === true || pick.intelligenceSafetyDowngrade === true) reasons.push("safety_downgrade");
  if (pick.fixtureVerifiedByProvider === false) reasons.push("fixture_not_verified");
  if (pick.stale === true || pick.isStale === true) reasons.push("stale_market");
  if (odds < policy.minOdds || odds > policy.maxOdds) reasons.push("odds_outside_policy");
  if (edge < policy.minEdge) reasons.push("edge_below_policy");
  if (finite(pick.ev, -1) <= 0) reasons.push("non_positive_ev");
  if (confidence < policy.minConfidence) reasons.push("confidence_below_policy");
  if (priority < policy.minPriorityScore) reasons.push("priority_below_policy");
  if (bookmakerCount < policy.minBookmakers) reasons.push("bookmaker_coverage_low");
  if (coverage < policy.minVerifiedCoverage && providerCount < 2) reasons.push("verified_data_coverage_low");
  if (!pickId(pick) || !pickSelection(pick)) reasons.push("missing_identity");
  return reasons;
}

export function selectAutonomousV12Picks({ picks = [], policy = {}, bankroll = {}, openBets = [], todayRows = [] } = {}) {
  if (policy.state === "PAUSED" || policy.maxPicks <= 0 || policy.riskScale <= 0) {
    return { selected: [], skipped: picks.map((pick) => ({ pick, reasons: ["circuit_breaker_paused"] })), audit: [] };
  }
  const bankrollValue = Math.max(1, finite(bankroll.bankroll, 1000));
  const totalCap = bankrollValue * finite(policy.maxTotalExposurePercent) / 100;
  const leagueCap = bankrollValue * finite(policy.maxLeagueExposurePercent) / 100;
  const singleCap = bankrollValue * finite(policy.maxStakePercent) / 100;
  let openTotal = openBets.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const leagueExposure = new Map();
  const usedEvents = new Set();
  const usedToday = new Set();
  for (const row of openBets) {
    const league = normalized(row.league || row.sport || "unknown");
    leagueExposure.set(league, (leagueExposure.get(league) || 0) + Math.max(0, finite(row.stake)));
    const event = normalized(row.raw_pick?.eventId || row.event_id || row.match);
    if (event) usedEvents.add(event);
  }
  for (const row of todayRows) {
    const event = normalized(row.raw_pick?.eventId || row.event_id || row.match);
    if (event) usedToday.add(event);
  }
  const ranked = [...picks].sort((a, b) => {
    const scoreA = finite(a.priorityScore) * 0.45 + finite(a.robustnessScore) * 0.25 + finite(a.confidence) * 0.2 + clamp(finite(a.edge), 0, 0.2) * 0.5;
    const scoreB = finite(b.priorityScore) * 0.45 + finite(b.robustnessScore) * 0.25 + finite(b.confidence) * 0.2 + clamp(finite(b.edge), 0, 0.2) * 0.5;
    return scoreB - scoreA;
  });
  const selected = [];
  const skipped = [];
  for (const pick of ranked) {
    const reasons = candidateReasons(pick, policy);
    const eventKey = normalized(pickId(pick));
    const leagueKey = normalized(pickLeague(pick));
    if (usedEvents.has(eventKey) || usedToday.has(eventKey)) reasons.push("event_already_used");
    if (selected.length >= policy.maxPicks) reasons.push("daily_pick_limit");
    if (reasons.length) {
      skipped.push({ pick, reasons });
      continue;
    }
    const odds = finite(pick.odds);
    const probability = probabilityForStake(pick);
    const kellyPercent = kellyStakePercent(probability, odds, finite(policy.kellyFraction));
    const suggested = Math.max(0, finite(pick.allocatedStake || pick.suggestedStake));
    const policyStake = bankrollValue * Math.min(finite(policy.maxStakePercent), kellyPercent || finite(policy.maxStakePercent) * 0.5) / 100;
    const remainingTotal = Math.max(0, totalCap - openTotal);
    const remainingLeague = Math.max(0, leagueCap - (leagueExposure.get(leagueKey) || 0));
    const stake = round(Math.min(singleCap, policyStake, suggested || policyStake, remainingTotal, remainingLeague), 2);
    if (!(stake >= 0.5)) {
      skipped.push({ pick, reasons: [remainingTotal < 0.5 ? "total_exposure_full" : "league_exposure_full"] });
      continue;
    }
    const score = round(finite(pick.priorityScore) * 0.45 + finite(pick.robustnessScore) * 0.25 + finite(pick.confidence) * 0.2 + clamp(finite(pick.edge), 0, 0.2) * 0.5, 6);
    selected.push({ ...pick, autonomousStake: stake, autonomousV12Score: score, autonomousV12Policy: policy.version });
    openTotal += stake;
    leagueExposure.set(leagueKey, (leagueExposure.get(leagueKey) || 0) + stake);
    usedEvents.add(eventKey);
    usedToday.add(eventKey);
  }
  return {
    selected,
    skipped,
    audit: ranked.map((pick) => ({
      eventId: pickId(pick),
      selection: pickSelection(pick),
      league: pickLeague(pick),
      odds: round(pick.odds, 4),
      edge: round(pick.edge, 4),
      confidence: round(pick.confidence, 4),
      priorityScore: round(pick.priorityScore, 4),
      verifiedCoverage: round(pick.unifiedSportsData?.coverage?.verifiedCoverageRate, 4),
      contextImpact: round(clamp(pick.contextImpact, -MAX_CONTEXT_IMPACT, MAX_CONTEXT_IMPACT), 4),
      selected: selected.some((row) => pickId(row) === pickId(pick) && pickSelection(row) === pickSelection(pick)),
      skipReasons: skipped.find((row) => row.pick === pick)?.reasons || []
    }))
  };
}

export function nextAutonomousV12Check({ result = {}, circuit = {}, learning = {}, now = new Date() } = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  let minutes = 120;
  if (circuit.paused) minutes = circuit.reasons.includes("manual_kill_switch") ? 24 * 60 : 60;
  else if (result.savedCount > 0) minutes = 180;
  else if (result.candidateCount > 0) minutes = 60;
  else minutes = 90;
  if (learning.status === "critical") minutes = Math.max(minutes, 180);
  return new Date(clock.getTime() + minutes * 60_000).toISOString();
}

export function autonomousV12RunFingerprint(userId, now = new Date()) {
  const clock = now instanceof Date ? now : new Date(now);
  return `${text(userId, 80)}:${clock.toISOString().slice(0, 13)}`;
}
