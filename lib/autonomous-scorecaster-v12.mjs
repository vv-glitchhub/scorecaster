const MIN_ODDS = 1.01;
const MAX_ODDS = 20;

function finite(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalFinite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function round(value, digits = 4) {
  const number = optionalFinite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function clean(value, maximum = 240, fallback = "") {
  return String(value ?? fallback)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function normalized(value) {
  return clean(value, 240).toLowerCase();
}

function statusOf(row = {}) {
  return clean(row.status, 24).toLowerCase();
}

function outcomeOf(row = {}) {
  const status = statusOf(row);
  if (status === "won" || status === "win") return 1;
  if (status === "lost" || status === "loss") return 0;
  return null;
}

function profitOf(row = {}) {
  const stake = Math.max(0, finite(row.stake));
  const odds = Math.max(MIN_ODDS, finite(row.odds, MIN_ODDS));
  const outcome = outcomeOf(row);
  if (outcome === 1) return stake * (odds - 1);
  if (outcome === 0) return -stake;
  return 0;
}

function probabilityOf(row = {}) {
  const raw = row.raw_pick || row.rawPick || {};
  return optionalFinite(
    raw.modelProbability
      ?? raw.consensusProbability
      ?? raw.marketProbability
      ?? row.model_probability
      ?? row.modelProbability
  );
}

function closingOddsOf(row = {}) {
  return optionalFinite(row.closing_odds ?? row.closingOdds);
}

function clvOf(row = {}) {
  const explicit = optionalFinite(row.clv);
  if (explicit !== null) return explicit;
  const selectedOdds = optionalFinite(row.odds);
  const closingOdds = closingOddsOf(row);
  if (selectedOdds === null || closingOdds === null || selectedOdds <= 1 || closingOdds <= 1) return null;
  return selectedOdds / closingOdds - 1;
}

function timestampOf(row = {}) {
  const parsed = Date.parse(row.created_at || row.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function drawdownOf(rows = []) {
  const ordered = [...rows].sort((left, right) => timestampOf(left) - timestampOf(right));
  let equity = 0;
  let peak = 0;
  let maximum = 0;
  for (const row of ordered) {
    equity += profitOf(row);
    peak = Math.max(peak, equity);
    maximum = Math.max(maximum, peak - equity);
  }
  return maximum;
}

function losingStreakOf(rows = []) {
  const ordered = [...rows].sort((left, right) => timestampOf(left) - timestampOf(right));
  let current = 0;
  let maximum = 0;
  for (const row of ordered) {
    const outcome = outcomeOf(row);
    if (outcome === 0) {
      current += 1;
      maximum = Math.max(maximum, current);
    } else if (outcome === 1) {
      current = 0;
    }
  }
  return { current, maximum };
}

function performanceReport(rows = [], now = new Date()) {
  const settled = rows.filter((row) => outcomeOf(row) !== null || ["push", "void"].includes(statusOf(row)));
  const decisions = settled.filter((row) => outcomeOf(row) !== null);
  const staked = settled.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const profit = settled.reduce((sum, row) => sum + profitOf(row), 0);
  const wins = decisions.filter((row) => outcomeOf(row) === 1).length;
  const losses = decisions.filter((row) => outcomeOf(row) === 0).length;
  const clvValues = settled.map(clvOf).filter((value) => value !== null);
  const probabilityRows = decisions
    .map((row) => ({ probability: probabilityOf(row), outcome: outcomeOf(row) }))
    .filter((row) => row.probability !== null && row.probability > 0 && row.probability < 1);

  const brier = probabilityRows.length
    ? probabilityRows.reduce((sum, row) => sum + (row.probability - row.outcome) ** 2, 0) / probabilityRows.length
    : null;
  const logLoss = probabilityRows.length
    ? -probabilityRows.reduce((sum, row) => {
      const probability = clamp(row.probability, 0.001, 0.999);
      return sum + row.outcome * Math.log(probability) + (1 - row.outcome) * Math.log(1 - probability);
    }, 0) / probabilityRows.length
    : null;

  const clock = now instanceof Date ? now : new Date(now);
  const recentStart = clock.getTime() - 30 * 24 * 60 * 60 * 1000;
  const recent = settled.filter((row) => timestampOf(row) >= recentStart);
  const recentStake = recent.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const recentProfit = recent.reduce((sum, row) => sum + profitOf(row), 0);
  const streak = losingStreakOf(settled);

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
    clvSample: clvValues.length,
    averageClv: clvValues.length ? round(clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length, 4) : null,
    positiveClvRate: clvValues.length ? round(clvValues.filter((value) => value > 0).length / clvValues.length, 4) : null,
    probabilitySample: probabilityRows.length,
    brier: round(brier, 5),
    logLoss: round(logLoss, 5),
    maxDrawdown: round(drawdownOf(settled), 2),
    currentLosingStreak: streak.current,
    maximumLosingStreak: streak.maximum,
    recent30: {
      sampleSize: recent.length,
      profit: round(recentProfit, 2),
      roi: recentStake > 0 ? round(recentProfit / recentStake, 4) : null
    }
  };
}

function calibrationReport(rows = []) {
  const usable = rows
    .map((row) => ({
      probability: optionalFinite(row.model_probability ?? row.modelProbability),
      outcome: optionalFinite(row.outcome)
    }))
    .filter((row) => row.probability !== null && row.probability > 0 && row.probability < 1 && (row.outcome === 0 || row.outcome === 1));

  const grouped = new Map();
  for (const row of usable) {
    const bucketIndex = Math.min(9, Math.floor(row.probability * 10));
    const bucket = grouped.get(bucketIndex) || { bucketIndex, count: 0, predicted: 0, actual: 0 };
    bucket.count += 1;
    bucket.predicted += row.probability;
    bucket.actual += row.outcome;
    grouped.set(bucketIndex, bucket);
  }

  const buckets = [...grouped.values()]
    .sort((left, right) => left.bucketIndex - right.bucketIndex)
    .map((bucket) => {
      const predicted = bucket.predicted / bucket.count;
      const actual = bucket.actual / bucket.count;
      return {
        bucket: `${bucket.bucketIndex * 10}-${bucket.bucketIndex * 10 + 10}%`,
        count: bucket.count,
        predicted: round(predicted, 4),
        actual: round(actual, 4),
        gap: round(Math.abs(predicted - actual), 4)
      };
    });

  const expectedCalibrationError = usable.length
    ? buckets.reduce((sum, bucket) => sum + finite(bucket.gap) * bucket.count / usable.length, 0)
    : null;

  return {
    sampleSize: usable.length,
    expectedCalibrationError: round(expectedCalibrationError, 5),
    buckets
  };
}

export function buildAutonomousV12LearningReport({ history = [], calibration = [], now = new Date() } = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(clock.getTime())) throw new Error("Autonomous V12 learning requires a valid clock");

  const performance = performanceReport(Array.isArray(history) ? history : [], clock);
  const calibrationMetrics = calibrationReport(Array.isArray(calibration) ? calibration : []);
  const driftReasons = [];

  if (performance.clvSample >= 40 && performance.averageClv !== null && performance.averageClv < -0.015) driftReasons.push("negative_clv");
  if (performance.probabilitySample >= 80 && performance.brier !== null && performance.brier > 0.27) driftReasons.push("brier_regression");
  if (calibrationMetrics.sampleSize >= 80 && calibrationMetrics.expectedCalibrationError !== null && calibrationMetrics.expectedCalibrationError > 0.08) driftReasons.push("calibration_drift");
  if (performance.currentLosingStreak >= 8) driftReasons.push("loss_streak");

  const status = driftReasons.length >= 2
    ? "critical"
    : driftReasons.length
      ? "watch"
      : performance.sampleSize >= 120
        ? "healthy"
        : "learning";

  const challengerEligible = performance.sampleSize >= 200
    && performance.clvSample >= 120
    && performance.averageClv !== null
    && performance.averageClv >= 0
    && performance.probabilitySample >= 120
    && performance.brier !== null
    && performance.brier <= 0.25
    && calibrationMetrics.sampleSize >= 120
    && calibrationMetrics.expectedCalibrationError !== null
    && calibrationMetrics.expectedCalibrationError <= 0.06;

  return {
    version: "autonomous-scorecaster-v12-learning-v1",
    generatedAt: clock.toISOString(),
    status,
    driftReasons,
    performance,
    calibration: calibrationMetrics,
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
    },
    paperOnly: true
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
  const dailyProfit = (Array.isArray(todayRows) ? todayRows : []).reduce((sum, row) => sum + profitOf(row), 0);
  const dailyLossRate = dailyProfit < 0 ? Math.abs(dailyProfit) / bankrollValue : 0;
  const openExposure = (Array.isArray(openBets) ? openBets : []).reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const providerScore = optionalFinite(system.providerScore);
  const staleRate = optionalFinite(system.staleRate);
  const captureAgeMinutes = optionalFinite(system.captureAgeMinutes);
  const settlementBacklog = Math.max(0, Math.trunc(finite(system.settlementBacklog)));
  const performance = learning.performance || {};

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
  if (finite(performance.currentLosingStreak) >= 10) reasons.push("loss_streak_stop");
  if (finite(performance.maxDrawdown) / bankrollValue >= 0.15) reasons.push("drawdown_stop");

  if (providerScore !== null && providerScore >= 35 && providerScore < 65) warnings.push("provider_health_degraded");
  if (staleRate !== null && staleRate >= 0.2 && staleRate < 0.5) warnings.push("market_freshness_watch");
  if (captureAgeMinutes !== null && captureAgeMinutes > 60 && captureAgeMinutes <= 120) warnings.push("unified_data_capture_watch");
  if (settlementBacklog >= 25 && settlementBacklog < 100) warnings.push("settlement_backlog_watch");
  if (learning.status === "watch") warnings.push("learning_drift_watch");
  if (dailyLossRate >= 0.02 && dailyLossRate < 0.04) warnings.push("daily_loss_watch");
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
      captureAgeMinutes,
      settlementBacklog
    }
  };
}

export function buildAutonomousV12Policy({ settings = {}, bankroll = {}, learning = {}, circuit = {} } = {}) {
  const userPickLimit = Math.max(1, Math.min(5, Math.trunc(finite(settings.dailyPickLimit ?? settings.daily_pick_limit, 3))));
  const userStake = clamp(bankroll.maxStakePercent ?? bankroll.max_stake_percent ?? 1, 0.1, 5);
  const userExposure = clamp(bankroll.maxTotalExposurePercent ?? bankroll.max_daily_exposure_percent ?? 6, 0.5, 20);
  const userLeagueExposure = clamp(bankroll.maxLeagueExposurePercent ?? bankroll.max_single_league_exposure_percent ?? 3, 0.25, 10);
  const basePriority = clamp(settings.minPriorityScore ?? settings.min_priority_score ?? 0.62, 0.5, 0.95);
  const baseEdge = clamp(bankroll.minEdge ?? bankroll.min_edge ?? 0.025, 0, 0.5);
  const baseConfidence = clamp(bankroll.minConfidence ?? bankroll.min_confidence ?? 0.58, 0, 1);
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
  if (finite(learning.performance?.clvSample) >= 40 && optionalFinite(learning.performance?.averageClv) !== null && finite(learning.performance?.averageClv) < 0) {
    riskScale *= 0.75;
    evidenceBoost += 0.03;
  }
  if (finite(learning.performance?.sampleSize) < 120) {
    riskScale *= 0.75;
    maxPicks = Math.min(maxPicks, 2);
  }
  if (circuit.paused || circuit.state === "PAUSED") {
    riskScale = 0;
    maxPicks = 0;
  }

  return {
    version: "autonomous-scorecaster-v12-policy-v1",
    state: circuit.paused ? "PAUSED" : circuit.state || "RUNNING",
    maxPicks,
    minPriorityScore: clamp(basePriority + evidenceBoost, 0.5, 0.95),
    minOdds: clamp(settings.minOdds ?? settings.min_odds ?? 1.2, MIN_ODDS, MAX_ODDS),
    maxOdds: clamp(settings.maxOdds ?? settings.max_odds ?? 5, MIN_ODDS, MAX_ODDS),
    minEdge: clamp(baseEdge + evidenceBoost * 0.15, 0, 0.5),
    minConfidence: clamp(baseConfidence + evidenceBoost, 0, 1),
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

function eventIdOf(pick = {}) {
  return clean(pick.eventId || pick.gameId || pick.id, 180);
}

function selectionOf(pick = {}) {
  return clean(pick.selection || pick.label, 160);
}

function leagueOf(pick = {}) {
  return clean(pick.league || pick.leagueTitle || pick.sportKey || pick.sport, 120, "unknown");
}

function decisionOf(pick = {}) {
  return clean(pick.productDecision || pick.decision, 24).toUpperCase();
}

function probabilityForStake(pick = {}) {
  return optionalFinite(
    pick.stressTest?.probability
      ?? pick.consensusProbability
      ?? pick.modelProbability
      ?? pick.marketProbability
  );
}

function fractionalKellyPercent(probability, odds, fraction) {
  if (probability === null || probability <= 0 || probability >= 1 || odds <= 1 || fraction <= 0) return 0;
  const fullKelly = (probability * odds - 1) / (odds - 1);
  return clamp(fullKelly * fraction * 100, 0, 5);
}

function candidateSkipReasons(pick, policy) {
  const reasons = [];
  const decision = decisionOf(pick);
  const odds = finite(pick.odds);
  const edge = optionalFinite(pick.edge);
  const ev = optionalFinite(pick.ev);
  const confidence = optionalFinite(pick.confidence);
  const priority = optionalFinite(pick.priorityScore);
  const bookmakerCount = Math.max(0, finite(pick.bookmakerCount));
  const verifiedCoverage = optionalFinite(pick.unifiedSportsData?.coverage?.verifiedCoverageRate);
  const independentProviders = Math.max(1, finite(pick.unifiedSportsData?.coverage?.independentOddsProviders, 1));

  if (decision !== "PLAY" && decision !== "BET") reasons.push("not_play");
  if (pick.unifiedDataSafetyDowngrade === true || pick.intelligenceSafetyDowngrade === true) reasons.push("safety_downgrade");
  if (pick.fixtureVerifiedByProvider === false) reasons.push("fixture_not_verified");
  if (pick.stale === true || pick.isStale === true) reasons.push("stale_market");
  if (odds < policy.minOdds || odds > policy.maxOdds) reasons.push("odds_outside_policy");
  if (edge === null || edge < policy.minEdge) reasons.push("edge_below_policy");
  if (ev === null || ev <= 0) reasons.push("non_positive_ev");
  if (confidence === null || confidence < policy.minConfidence) reasons.push("confidence_below_policy");
  if (priority === null || priority < policy.minPriorityScore) reasons.push("priority_below_policy");
  if (bookmakerCount < policy.minBookmakers) reasons.push("bookmaker_coverage_low");
  if ((verifiedCoverage === null || verifiedCoverage < policy.minVerifiedCoverage) && independentProviders < 2) reasons.push("verified_data_coverage_low");
  if (!eventIdOf(pick) || !selectionOf(pick)) reasons.push("missing_identity");
  return reasons;
}

function rankScore(pick = {}) {
  return finite(pick.priorityScore) * 0.45
    + finite(pick.robustnessScore) * 0.25
    + finite(pick.confidence) * 0.2
    + clamp(finite(pick.edge), 0, 0.2) * 0.5;
}

export function selectAutonomousV12Picks({ picks = [], policy = {}, bankroll = {}, openBets = [], todayRows = [] } = {}) {
  const candidates = Array.isArray(picks) ? picks : [];
  if (policy.state === "PAUSED" || finite(policy.maxPicks) <= 0 || finite(policy.riskScale) <= 0) {
    return {
      selected: [],
      skipped: candidates.map((pick) => ({ pick, reasons: ["circuit_breaker_paused"] })),
      audit: candidates.map((pick) => ({
        eventId: eventIdOf(pick),
        selection: selectionOf(pick),
        league: leagueOf(pick),
        selected: false,
        skipReasons: ["circuit_breaker_paused"]
      }))
    };
  }

  const bankrollValue = Math.max(1, finite(bankroll.bankroll, 1000));
  const totalCap = bankrollValue * finite(policy.maxTotalExposurePercent) / 100;
  const leagueCap = bankrollValue * finite(policy.maxLeagueExposurePercent) / 100;
  const singleCap = bankrollValue * finite(policy.maxStakePercent) / 100;
  let totalExposure = (Array.isArray(openBets) ? openBets : []).reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const leagueExposure = new Map();
  const usedEvents = new Set();

  for (const row of Array.isArray(openBets) ? openBets : []) {
    const league = normalized(row.league || row.sport || "unknown");
    leagueExposure.set(league, (leagueExposure.get(league) || 0) + Math.max(0, finite(row.stake)));
    const event = normalized(row.raw_pick?.eventId || row.event_id || row.match);
    if (event) usedEvents.add(event);
  }
  for (const row of Array.isArray(todayRows) ? todayRows : []) {
    const event = normalized(row.raw_pick?.eventId || row.event_id || row.match);
    if (event) usedEvents.add(event);
  }

  const ranked = candidates
    .map((pick, index) => ({ pick, index, score: rankScore(pick) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = [];
  const skipped = [];

  for (const entry of ranked) {
    const pick = entry.pick;
    const reasons = candidateSkipReasons(pick, policy);
    const eventKey = normalized(eventIdOf(pick));
    const leagueKey = normalized(leagueOf(pick));
    if (eventKey && usedEvents.has(eventKey)) reasons.push("event_already_used");
    if (selected.length >= finite(policy.maxPicks)) reasons.push("daily_pick_limit");
    if (reasons.length) {
      skipped.push({ pick, reasons: [...new Set(reasons)] });
      continue;
    }

    const odds = finite(pick.odds);
    const probability = probabilityForStake(pick);
    const kellyPercent = fractionalKellyPercent(probability, odds, finite(policy.kellyFraction));
    const policyPercent = kellyPercent > 0
      ? Math.min(finite(policy.maxStakePercent), kellyPercent)
      : finite(policy.maxStakePercent) * 0.5;
    const policyStake = bankrollValue * policyPercent / 100;
    const suggestedStake = optionalFinite(pick.allocatedStake ?? pick.suggestedStake);
    const remainingTotal = Math.max(0, totalCap - totalExposure);
    const remainingLeague = Math.max(0, leagueCap - (leagueExposure.get(leagueKey) || 0));
    const stake = round(Math.min(
      singleCap,
      policyStake,
      suggestedStake !== null && suggestedStake > 0 ? suggestedStake : policyStake,
      remainingTotal,
      remainingLeague
    ), 2);

    if (stake === null || stake < 0.5) {
      skipped.push({ pick, reasons: [remainingTotal < 0.5 ? "total_exposure_full" : "league_exposure_full"] });
      continue;
    }

    selected.push({
      ...pick,
      autonomousStake: stake,
      autonomousV12Score: round(entry.score, 6),
      autonomousV12Policy: policy.version
    });
    totalExposure += stake;
    leagueExposure.set(leagueKey, (leagueExposure.get(leagueKey) || 0) + stake);
    if (eventKey) usedEvents.add(eventKey);
  }

  const selectedKeys = new Set(selected.map((pick) => `${eventIdOf(pick)}|${selectionOf(pick)}`));
  const skippedByKey = new Map(skipped.map((entry) => [`${eventIdOf(entry.pick)}|${selectionOf(entry.pick)}`, entry.reasons]));
  const audit = ranked.map(({ pick }) => {
    const key = `${eventIdOf(pick)}|${selectionOf(pick)}`;
    return {
      eventId: eventIdOf(pick),
      selection: selectionOf(pick),
      league: leagueOf(pick),
      odds: round(pick.odds, 4),
      edge: round(pick.edge, 4),
      confidence: round(pick.confidence, 4),
      priorityScore: round(pick.priorityScore, 4),
      verifiedCoverage: round(pick.unifiedSportsData?.coverage?.verifiedCoverageRate, 4),
      contextImpact: round(pick.contextImpact, 4),
      selected: selectedKeys.has(key),
      skipReasons: skippedByKey.get(key) || []
    };
  });

  return { selected, skipped, audit };
}

export function nextAutonomousV12Check({ result = {}, circuit = {}, learning = {}, now = new Date() } = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(clock.getTime())) throw new Error("Autonomous V12 scheduling requires a valid clock");
  let minutes = 120;
  if (circuit.paused) minutes = Array.isArray(circuit.reasons) && circuit.reasons.includes("manual_kill_switch") ? 24 * 60 : 60;
  else if (finite(result.savedCount) > 0) minutes = 180;
  else if (finite(result.candidateCount) > 0) minutes = 60;
  else minutes = 90;
  if (learning.status === "critical") minutes = Math.max(minutes, 180);
  return new Date(clock.getTime() + minutes * 60_000).toISOString();
}

export function autonomousV12RunFingerprint(userId, now = new Date()) {
  const clock = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(clock.getTime())) throw new Error("Autonomous V12 fingerprint requires a valid clock");
  return `${clean(userId, 80)}:${clock.toISOString().slice(0, 13)}`;
}
