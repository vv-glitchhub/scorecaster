const DEFAULTS = Object.freeze({
  minDataCoverage: 0.6,
  minProviderCount: 1,
  maxProviderDisagreement: 0.12,
  maxDrawdownPercent: 12,
  maxDailyLossPercent: 4,
  pauseAfterLosses: 5,
  cooldownHours: 12,
  maxOpenPicks: 12,
  minimumMinutesBeforeStart: 20,
  maximumHoursBeforeStart: 72,
  autoPauseOnIncident: true,
  requireUnifiedData: true,
  adaptiveCadence: true,
  shadowLearningEnabled: true
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value)));
}

function round(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function clean(value, maximum = 300) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function resultPnl(row = {}) {
  const stake = Math.max(0, finite(row.stake));
  const odds = Math.max(1, finite(row.odds, 1));
  if (row.result === "win") return stake * (odds - 1);
  if (row.result === "loss") return -stake;
  return 0;
}

function resolvedHistory(history = []) {
  return history
    .filter((row) => ["win", "loss", "push"].includes(row?.result))
    .map((row) => ({ ...row, createdAtMs: Date.parse(row.createdAt || row.created_at || "") }))
    .sort((left, right) => (left.createdAtMs || 0) - (right.createdAtMs || 0));
}

function maximumDrawdown(rows = []) {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const row of rows) {
    equity += resultPnl(row);
    peak = Math.max(peak, equity);
    const denominator = Math.max(1, Math.abs(peak) + rows.reduce((sum, item) => sum + Math.max(0, finite(item.stake)), 0) / Math.max(1, rows.length));
    worst = Math.max(worst, (peak - equity) / denominator);
  }
  return worst;
}

function currentLossStreak(rows = []) {
  let streak = 0;
  for (const row of [...rows].reverse()) {
    if (row.result === "loss") streak += 1;
    else if (row.result === "win") break;
  }
  return streak;
}

function dailyLossRate(rows = [], bankroll = 1000, now = Date.now()) {
  const since = now - 24 * 60 * 60 * 1000;
  const pnl = rows
    .filter((row) => Number.isFinite(row.createdAtMs) && row.createdAtMs >= since)
    .reduce((sum, row) => sum + resultPnl(row), 0);
  return pnl < 0 ? Math.abs(pnl) / Math.max(1, finite(bankroll, 1000)) : 0;
}

function clvStats(rows = []) {
  const values = rows
    .map((row) => {
      const placed = finite(row.odds);
      const closing = finite(row.closingOdds ?? row.closing_odds);
      return placed > 1 && closing > 1 ? placed / closing - 1 : null;
    })
    .filter((value) => value !== null && Number.isFinite(value));
  if (!values.length) return { sample: 0, average: null, positiveRate: null };
  return {
    sample: values.length,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    positiveRate: values.filter((value) => value > 0).length / values.length
  };
}

export function normalizeAutonomousV2Settings(settings = {}) {
  return {
    minDataCoverage: clamp(settings.minDataCoverage ?? settings.min_data_coverage ?? DEFAULTS.minDataCoverage, 0, 1),
    minProviderCount: Math.trunc(clamp(settings.minProviderCount ?? settings.min_provider_count ?? DEFAULTS.minProviderCount, 1, 5)),
    maxProviderDisagreement: clamp(settings.maxProviderDisagreement ?? settings.max_provider_disagreement ?? DEFAULTS.maxProviderDisagreement, 0.01, 0.5),
    maxDrawdownPercent: clamp(settings.maxDrawdownPercent ?? settings.max_drawdown_percent ?? DEFAULTS.maxDrawdownPercent, 2, 50),
    maxDailyLossPercent: clamp(settings.maxDailyLossPercent ?? settings.max_daily_loss_percent ?? DEFAULTS.maxDailyLossPercent, 1, 25),
    pauseAfterLosses: Math.trunc(clamp(settings.pauseAfterLosses ?? settings.pause_after_losses ?? DEFAULTS.pauseAfterLosses, 2, 20)),
    cooldownHours: Math.trunc(clamp(settings.cooldownHours ?? settings.cooldown_hours ?? DEFAULTS.cooldownHours, 1, 168)),
    maxOpenPicks: Math.trunc(clamp(settings.maxOpenPicks ?? settings.max_open_picks ?? DEFAULTS.maxOpenPicks, 1, 100)),
    minimumMinutesBeforeStart: Math.trunc(clamp(settings.minimumMinutesBeforeStart ?? settings.minimum_minutes_before_start ?? DEFAULTS.minimumMinutesBeforeStart, 5, 240)),
    maximumHoursBeforeStart: Math.trunc(clamp(settings.maximumHoursBeforeStart ?? settings.maximum_hours_before_start ?? DEFAULTS.maximumHoursBeforeStart, 2, 168)),
    autoPauseOnIncident: settings.autoPauseOnIncident ?? settings.auto_pause_on_incident ?? DEFAULTS.autoPauseOnIncident,
    requireUnifiedData: settings.requireUnifiedData ?? settings.require_unified_data ?? DEFAULTS.requireUnifiedData,
    adaptiveCadence: settings.adaptiveCadence ?? settings.adaptive_cadence ?? DEFAULTS.adaptiveCadence,
    shadowLearningEnabled: settings.shadowLearningEnabled ?? settings.shadow_learning_enabled ?? DEFAULTS.shadowLearningEnabled
  };
}

export function buildPerformanceGuard({ history = [], bankroll = 1000, settings = {}, now = Date.now() } = {}) {
  const config = normalizeAutonomousV2Settings(settings);
  const rows = resolvedHistory(history);
  const stake = rows.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const pnl = rows.reduce((sum, row) => sum + resultPnl(row), 0);
  const roi = stake > 0 ? pnl / stake : null;
  const drawdown = maximumDrawdown(rows);
  const lossStreak = currentLossStreak(rows);
  const dailyLoss = dailyLossRate(rows, bankroll, now);
  const clv = clvStats(rows);
  const reasons = [];
  const warnings = [];

  if (drawdown * 100 >= config.maxDrawdownPercent) reasons.push("maximum_drawdown_reached");
  if (dailyLoss * 100 >= config.maxDailyLossPercent) reasons.push("daily_loss_limit_reached");
  if (lossStreak >= config.pauseAfterLosses) reasons.push("loss_streak_limit_reached");
  if (clv.sample >= 40 && clv.average !== null && clv.average <= -0.02) reasons.push("persistent_negative_clv");
  if (rows.length >= 40 && roi !== null && roi <= -0.12) reasons.push("persistent_negative_roi");

  if (!reasons.length && rows.length < 30) warnings.push("performance_sample_is_small");
  if (!reasons.length && clv.sample >= 15 && clv.average !== null && clv.average < -0.01) warnings.push("clv_is_worsening");
  if (!reasons.length && rows.length >= 20 && roi !== null && roi < -0.05) warnings.push("roi_is_worsening");

  const status = reasons.length ? "paused" : warnings.length ? "watch" : rows.length < 30 ? "learning" : "healthy";
  const score = clamp(
    100
      - drawdown * 220
      - dailyLoss * 300
      - Math.max(0, lossStreak - 1) * 5
      - (clv.average !== null && clv.average < 0 ? Math.abs(clv.average) * 250 : 0)
      - (roi !== null && roi < 0 ? Math.abs(roi) * 80 : 0),
    0,
    100
  );

  return {
    version: "autonomous-performance-guard-v2",
    status,
    score: round(score, 1),
    reasons,
    warnings,
    resolvedSample: rows.length,
    staked: round(stake, 2),
    pnl: round(pnl, 2),
    roi: round(roi, 4),
    drawdown: round(drawdown, 4),
    dailyLoss: round(dailyLoss, 4),
    consecutiveLosses: lossStreak,
    clv: { sample: clv.sample, average: round(clv.average, 4), positiveRate: round(clv.positiveRate, 4) },
    stakeMultiplier: reasons.length ? 0 : warnings.length ? 0.5 : rows.length < 30 ? 0.5 : 1,
    cooldownHours: config.cooldownHours,
    shadowLearningOnly: true
  };
}

function safetyIncidentType(item = {}) {
  return clean(item.alert_type || item.alertType || item.incident_type || item.incidentType, 100).toLowerCase();
}

function safetyIncidentFamily(item = {}) {
  const details = item.details && typeof item.details === "object" ? item.details : {};
  return clean(details.family || details.providerFamily || details.provider_family, 80).toLowerCase();
}

function safetyIncidentEventId(item = {}) {
  return clean(item.event_id || item.eventId, 180);
}

function primaryProviderStatus(diagnostics = null) {
  return clean(diagnostics?.provider_health?.status || diagnostics?.providerHealth?.status, 40).toLowerCase();
}

function decisionAlertBlocksSystem(item = {}, providerBlocked = false) {
  const type = safetyIncidentType(item);
  if (type === "provider_health") return providerBlocked;
  const blockingTypes = new Set(["provider_outage", "all_skip", "stale_data", "weak_coverage", "worker_failure", "capture_stale"]);
  return item?.severity === "high" || blockingTypes.has(type);
}

function unifiedIncidentBlocksSystem(item = {}, { providerBlocked = false, providerStatusKnown = false } = {}) {
  if (safetyIncidentEventId(item)) return false;
  const type = safetyIncidentType(item);
  if (type === "provider_health") {
    const family = safetyIncidentFamily(item);
    if (family && family !== "odds") return false;
    if (providerBlocked) return true;
    return !providerStatusKnown && item?.severity === "high";
  }
  const blockingTypes = new Set(["provider_outage", "worker_failure", "capture_stale"]);
  return item?.severity === "high" || blockingTypes.has(type);
}

function summarizeSafetyIncident(item = {}) {
  return {
    type: safetyIncidentType(item),
    severity: clean(item?.severity, 30),
    title: clean(item?.title, 180),
    provider: clean(item?.provider_key || item?.providerKey, 100) || null,
    family: safetyIncidentFamily(item) || null,
    eventScoped: Boolean(safetyIncidentEventId(item))
  };
}

export function buildSystemGuard({ decisionAlerts = [], unifiedIncidents = [], diagnostics = null, settings = {} } = {}) {
  const config = normalizeAutonomousV2Settings(settings);
  const activeDecisionAlerts = decisionAlerts.filter((item) => item?.active !== false);
  const activeUnifiedIncidents = unifiedIncidents.filter((item) => item?.active !== false);
  const active = [...activeDecisionAlerts, ...activeUnifiedIncidents];
  const providerStatus = primaryProviderStatus(diagnostics);
  const providerStatusKnown = Boolean(providerStatus);
  const providerBlocked = ["offline", "blocked", "down"].includes(providerStatus);
  const blockers = [
    ...activeDecisionAlerts.filter((item) => decisionAlertBlocksSystem(item, providerBlocked)),
    ...activeUnifiedIncidents.filter((item) => unifiedIncidentBlocksSystem(item, { providerBlocked, providerStatusKnown }))
  ];
  const blockerSet = new Set(blockers);
  const watched = active.filter((item) => !blockerSet.has(item));
  const reasons = [];
  if (config.autoPauseOnIncident && blockers.length) reasons.push("active_system_incident");
  if (providerBlocked) reasons.push("provider_health_blocked");
  return {
    version: "autonomous-system-guard-v3",
    status: reasons.length ? "blocked" : active.length ? "watch" : "healthy",
    score: reasons.length ? 0 : active.length ? 65 : 100,
    reasons,
    primaryProviderStatus: providerStatus || null,
    activeIncidentCount: active.length,
    blockingIncidentCount: blockers.length,
    watchedIncidentCount: watched.length,
    blockingIncidents: blockers.slice(0, 10).map(summarizeSafetyIncident),
    watchedIncidents: watched.slice(0, 10).map(summarizeSafetyIncident)
  };
}

function candidateTimeWindow(decision = {}, now = Date.now()) {
  const commence = Date.parse(decision.commenceTime || decision.commence_time || decision.startTime || "");
  if (!Number.isFinite(commence)) return { minutes: null, hours: null };
  return { minutes: (commence - now) / 60000, hours: (commence - now) / 3600000 };
}

function unifiedMetrics(decision = {}) {
  const ledger = decision.unifiedSportsData || decision.unified_data || null;
  const oddsFactor = ledger?.factors?.find?.((item) => item.key === "odds-consensus") || null;
  const disagreementEvidence = oddsFactor?.evidence?.find?.((item) => item.label === "providerDisagreement")?.value;
  return {
    ledger,
    coverage: finite(ledger?.coverage?.verifiedCoverageRate, 0),
    providerCount: Math.max(0, finite(ledger?.coverage?.independentOddsProviders, 0)),
    disagreement: disagreementEvidence === null || disagreementEvidence === undefined ? null : finite(disagreementEvidence),
    safetyAction: ledger?.safetyRecommendation?.action || null,
    paperOnly: ledger?.paperOnly !== false
  };
}

export function evaluateAutonomousCandidate(decision = {}, { settings = {}, bankroll = {}, performance = {}, system = {}, openEventIds = new Set(), now = Date.now() } = {}) {
  const config = normalizeAutonomousV2Settings(settings);
  const reasons = [];
  const warnings = [];
  const eventId = clean(decision.eventId || decision.gameId || decision.id || decision.match, 180).toLowerCase();
  const unified = unifiedMetrics(decision);
  const time = candidateTimeWindow(decision, now);
  const odds = finite(decision.odds);
  const edge = finite(decision.edge, -1);
  const confidence = finite(decision.confidence, -1);
  const priority = finite(decision.priorityScore, -1);

  if (system.status === "blocked") reasons.push("system_guard_blocked");
  if (performance.status === "paused") reasons.push("performance_guard_paused");
  if (decision.decision !== "PLAY" && decision.productDecision !== "PLAY") reasons.push("not_play");
  if (decision.unifiedDataSafetyDowngrade === true || unified.safetyAction === "DOWNGRADE_TO_CAUTION") reasons.push("unified_data_safety_downgrade");
  if (decision.fixtureVerifiedByProvider !== true) reasons.push("fixture_not_provider_verified");
  if (config.requireUnifiedData && !unified.ledger) reasons.push("unified_data_missing");
  if (unified.ledger && unified.coverage < config.minDataCoverage) reasons.push("data_coverage_below_minimum");
  if (unified.ledger && unified.providerCount < config.minProviderCount) reasons.push("provider_count_below_minimum");
  if (unified.disagreement !== null && unified.disagreement > config.maxProviderDisagreement) reasons.push("provider_disagreement_too_high");
  if (!unified.paperOnly) reasons.push("paper_only_boundary_missing");
  if (time.minutes === null) reasons.push("commence_time_missing");
  if (time.minutes !== null && time.minutes < config.minimumMinutesBeforeStart) reasons.push("event_too_close_or_started");
  if (time.hours !== null && time.hours > config.maximumHoursBeforeStart) reasons.push("event_too_far_away");
  if (eventId && openEventIds.has(eventId)) reasons.push("event_already_exposed");
  if (odds < finite(settings.minOdds ?? settings.min_odds, 1.2) || odds > finite(settings.maxOdds ?? settings.max_odds, 5)) reasons.push("odds_outside_user_range");
  if (edge < finite(bankroll.minEdge, 0.025)) reasons.push("edge_below_bankroll_threshold");
  if (confidence < finite(bankroll.minConfidence, 0.58)) reasons.push("confidence_below_bankroll_threshold");
  if (priority < finite(settings.minPriorityScore ?? settings.min_priority_score, 0.62)) reasons.push("priority_below_user_threshold");
  if (unified.disagreement !== null && unified.disagreement > config.maxProviderDisagreement * 0.75) warnings.push("provider_disagreement_near_limit");
  if (unified.coverage < Math.min(1, config.minDataCoverage + 0.1)) warnings.push("coverage_near_minimum");
  if (performance.status === "watch" || performance.status === "learning") warnings.push(`performance_${performance.status}`);

  const qualityScore = clamp(
    priority * 35
      + confidence * 25
      + clamp(edge / 0.08, 0, 1) * 15
      + unified.coverage * 15
      + clamp(unified.providerCount / 3, 0, 1) * 10
      - (unified.disagreement || 0) * 100,
    0,
    100
  );

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings,
    qualityScore: round(qualityScore, 1),
    eventId: eventId || null,
    data: {
      coverage: round(unified.coverage, 4),
      providerCount: unified.providerCount,
      providerDisagreement: round(unified.disagreement, 4),
      contextImpact: round(unified.ledger?.totalBoundedContextImpact, 4),
      minutesBeforeStart: round(time.minutes, 1)
    },
    policy: {
      probabilityChanged: false,
      productionLearningApplied: false,
      canUpgradeToPlay: false,
      paperOnly: true
    }
  };
}

export function adaptiveNextCheckMinutes({ result = {}, settings = {}, system = {}, performance = {} } = {}) {
  const config = normalizeAutonomousV2Settings(settings);
  if (!config.adaptiveCadence) return 180;
  if (system.status === "blocked" || performance.status === "paused") return Math.max(60, config.cooldownHours * 60);
  if (result.status === "error") return 60;
  if (finite(result.savedCount) > 0) return 60;
  if (finite(result.candidateCount) > 0) return 120;
  return 180;
}

export function buildAutonomousDailyBrief({ performance = {}, system = {}, result = {}, audits = [], generatedAt = new Date().toISOString() } = {}) {
  const allowed = audits.filter((item) => item.allowed).length;
  const blocked = audits.length - allowed;
  const reasonCounts = new Map();
  for (const audit of audits) for (const reason of audit.reasons || []) reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  const commonReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => ({ reason, count }));
  return {
    version: "autonomous-daily-brief-v2",
    generatedAt,
    headline: system.status === "blocked" || performance.status === "paused"
      ? "Autonomous paper activity is paused by a safety guard."
      : finite(result.savedCount) > 0
        ? `${result.savedCount} autonomous paper selection${result.savedCount === 1 ? "" : "s"} saved.`
        : "No autonomous paper selection passed every safety gate.",
    health: {
      overall: system.status === "blocked" || performance.status === "paused" ? "paused" : performance.status === "watch" ? "watch" : "ready",
      system: system.status,
      performance: performance.status,
      performanceScore: performance.score
    },
    cycle: {
      candidates: finite(result.candidateCount),
      allowed,
      blocked,
      saved: finite(result.savedCount),
      totalVirtualStake: round(result.totalStake, 2)
    },
    commonBlockReasons: commonReasons,
    learning: {
      mode: "shadow-only",
      resolvedSample: performance.resolvedSample || 0,
      averageClv: performance.clv?.average ?? null,
      roi: performance.roi ?? null,
      productionProbabilityChanged: false
    },
    paperOnly: true,
    realMoneyBetting: false
  };
}

export const AUTONOMOUS_AGENT_V2_DEFAULTS = DEFAULTS;
