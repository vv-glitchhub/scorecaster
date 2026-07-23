const EPSILON = 1e-9;

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function text(value, maximum = 300) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function timestamp(row = {}, index = 0) {
  const parsed = Date.parse(row.settledAt || row.settled_at || row.updatedAt || row.updated_at || row.createdAt || row.created_at || "");
  return Number.isFinite(parsed) ? parsed : index;
}

function outcome(row = {}) {
  const value = String(row.result || row.status || "").toLowerCase();
  if (["win", "won"].includes(value)) return "win";
  if (["loss", "lost"].includes(value)) return "loss";
  if (["push", "void"].includes(value)) return "push";
  return null;
}

function profitFor(row = {}) {
  const explicit = finite(row.profit);
  if (explicit !== null) return explicit;
  const stake = Math.max(0, finite(row.stake, 0));
  const odds = Math.max(1, finite(row.odds, 1));
  const result = outcome(row);
  if (result === "win") return stake * (odds - 1);
  if (result === "loss") return -stake;
  if (result === "push") return 0;
  return null;
}

function clvFor(row = {}) {
  const explicit = finite(row.clv);
  if (explicit !== null) return Math.abs(explicit) > 1 ? explicit / 100 : explicit;
  const odds = finite(row.odds);
  const closing = finite(row.closingOdds ?? row.closing_odds);
  return odds && closing && odds > 1 && closing > 1 ? odds / closing - 1 : null;
}

function probabilityFor(row = {}) {
  const probability = finite(row.modelProbability ?? row.consensusProbability ?? row.raw_pick?.modelProbability ?? row.rawPick?.modelProbability);
  return probability !== null && probability > 0 && probability < 1 ? probability : null;
}

export function normalizeAutonomousHistory(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const result = outcome(row);
      const profit = profitFor(row);
      if (!result || profit === null) return null;
      return {
        id: text(row.id || `history-${index}`, 180),
        timestamp: timestamp(row, index),
        result,
        stake: Math.max(0, finite(row.stake, 0)),
        odds: Math.max(1, finite(row.odds, 1)),
        profit,
        clv: clvFor(row),
        probability: probabilityFor(row),
        league: text(row.league || row.sportKey || row.sport || "unknown", 120),
        market: text(row.marketKey || row.market || "h2h", 80)
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.timestamp - right.timestamp || left.id.localeCompare(right.id));
}

function maximumDrawdown(samples = []) {
  let cumulative = 0;
  let peak = 0;
  let drawdown = 0;
  for (const sample of samples) {
    cumulative += sample.profit;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }
  return drawdown;
}

function currentLossStreak(samples = []) {
  let streak = 0;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index].result === "loss") streak += 1;
    else if (samples[index].result === "push") continue;
    else break;
  }
  return streak;
}

function summarizeWindow(samples = []) {
  const settled = samples.length;
  const wins = samples.filter((row) => row.result === "win").length;
  const losses = samples.filter((row) => row.result === "loss").length;
  const pushes = settled - wins - losses;
  const stake = samples.reduce((sum, row) => sum + row.stake, 0);
  const profit = samples.reduce((sum, row) => sum + row.profit, 0);
  const clvRows = samples.filter((row) => row.clv !== null);
  const probabilityRows = samples.filter((row) => row.probability !== null && ["win", "loss"].includes(row.result));
  const brier = probabilityRows.length
    ? probabilityRows.reduce((sum, row) => sum + (row.probability - (row.result === "win" ? 1 : 0)) ** 2, 0) / probabilityRows.length
    : null;
  return {
    settled,
    wins,
    losses,
    pushes,
    winRate: wins + losses ? wins / (wins + losses) : null,
    stake: round(stake, 2),
    profit: round(profit, 2),
    roi: stake > 0 ? round(profit / stake, 4) : null,
    averageClv: clvRows.length ? round(clvRows.reduce((sum, row) => sum + row.clv, 0) / clvRows.length, 4) : null,
    positiveClvRate: clvRows.length ? round(clvRows.filter((row) => row.clv > 0).length / clvRows.length, 4) : null,
    brierScore: brier === null ? null : round(brier, 4),
    maximumDrawdown: round(maximumDrawdown(samples), 2),
    lossStreak: currentLossStreak(samples)
  };
}

export function summarizeAutonomousPerformance(rows = [], { bankroll = 1000 } = {}) {
  const samples = normalizeAutonomousHistory(rows);
  const recent20 = samples.slice(-20);
  const recent50 = samples.slice(-50);
  const all = summarizeWindow(samples);
  const recent = summarizeWindow(recent20);
  const reference = summarizeWindow(recent50.length > recent20.length ? recent50.slice(0, -recent20.length) : []);
  const safeBankroll = Math.max(1, finite(bankroll, 1000));
  return {
    version: "autonomous-performance-v12",
    sampleSize: samples.length,
    all,
    recent,
    reference,
    drawdownPercent: round((all.maximumDrawdown || 0) / safeBankroll, 4),
    recentProfitTrend: recent.profit !== null && reference.profit !== null ? round(recent.profit - reference.profit, 2) : null,
    recentRoiTrend: recent.roi !== null && reference.roi !== null ? round(recent.roi - reference.roi, 4) : null,
    recentClvTrend: recent.averageClv !== null && reference.averageClv !== null ? round(recent.averageClv - reference.averageClv, 4) : null
  };
}

export function summarizeProviderReadiness(observations = [], incidents = []) {
  const rows = Array.isArray(observations) ? observations : [];
  const live = rows.filter((row) => row.ok === true || row.mode === "live");
  const trustRows = rows.map((row) => finite(row.trust_score ?? row.trust)).filter((value) => value !== null);
  const divergenceRows = rows.map((row) => finite(row.divergence)).filter((value) => value !== null);
  const activeIncidents = (Array.isArray(incidents) ? incidents : []).filter((row) => row.active !== false);
  const highIncidents = activeIncidents.filter((row) => String(row.severity).toLowerCase() === "high");
  const availabilityRate = rows.length ? live.length / rows.length : null;
  const averageTrust = trustRows.length ? trustRows.reduce((sum, value) => sum + value, 0) / trustRows.length : null;
  const averageDivergence = divergenceRows.length ? divergenceRows.reduce((sum, value) => sum + value, 0) / divergenceRows.length : null;
  let score = rows.length ? 100 : 55;
  if (availabilityRate !== null) score -= Math.max(0, 0.9 - availabilityRate) * 90;
  if (averageTrust !== null) score -= Math.max(0, 0.72 - averageTrust) * 80;
  if (averageDivergence !== null) score -= Math.max(0, averageDivergence - 0.05) * 160;
  score -= highIncidents.length * 35;
  score -= Math.max(0, activeIncidents.length - highIncidents.length) * 10;
  score = clamp(score, 0, 100);
  return {
    score: round(score, 1),
    status: score < 40 ? "offline" : score < 70 ? "degraded" : "healthy",
    samples: rows.length,
    availabilityRate: availabilityRate === null ? null : round(availabilityRate, 4),
    averageTrust: averageTrust === null ? null : round(averageTrust, 4),
    averageDivergence: averageDivergence === null ? null : round(averageDivergence, 4),
    activeIncidentCount: activeIncidents.length,
    highIncidentCount: highIncidents.length,
    activeIncidents: activeIncidents.slice(0, 12).map((row) => ({
      type: text(row.incident_type || row.incidentType, 100),
      severity: text(row.severity, 20),
      title: text(row.title, 180)
    }))
  };
}

function profileDefaults(profile) {
  if (profile === "balanced") return { activeStake: 0.85, cautiousStake: 0.45, learningStake: 0.25, activePicks: 3 };
  if (profile === "research") return { activeStake: 0.5, cautiousStake: 0.25, learningStake: 0.15, activePicks: 2 };
  return { activeStake: 0.65, cautiousStake: 0.35, learningStake: 0.2, activePicks: 2 };
}

export function normalizeAutonomySettings(settings = {}) {
  const profile = ["conservative", "balanced", "research"].includes(settings.autonomyProfile || settings.autonomy_profile)
    ? settings.autonomyProfile || settings.autonomy_profile
    : "conservative";
  return {
    autonomyProfile: profile,
    learningEnabled: settings.learningEnabled ?? settings.learning_enabled ?? true,
    autoPaperPromotion: settings.autoPaperPromotion ?? settings.auto_paper_promotion ?? true,
    maxConsecutiveLosses: Math.trunc(clamp(settings.maxConsecutiveLosses ?? settings.max_consecutive_losses ?? 6, 3, 20)),
    maxDrawdownPercent: clamp(settings.maxDrawdownPercent ?? settings.max_drawdown_percent ?? 12, 3, 30),
    minimumProviderHealth: clamp(settings.minimumProviderHealth ?? settings.minimum_provider_health ?? 60, 30, 90),
    dailyPickLimit: Math.trunc(clamp(settings.dailyPickLimit ?? settings.daily_pick_limit ?? 3, 1, 3)),
    ...profileDefaults(profile)
  };
}

function promotionDecision({ modelLab, performance, provider, settings, previous = {} }) {
  const reasons = [];
  const sampleSize = finite(modelLab?.sampleSize, 0);
  const readyStreak = Math.max(0, Math.trunc(finite(previous.promotionReadyStreak ?? previous.promotion_ready_streak, 0)));
  if (!settings.learningEnabled) reasons.push("learning_disabled");
  if (!settings.autoPaperPromotion) reasons.push("automatic_paper_promotion_disabled");
  if (!modelLab?.promotion?.eligible) reasons.push("challenger_not_holdout_eligible");
  if (sampleSize < 300) reasons.push("minimum_300_settled_samples_not_met");
  if (modelLab?.drift?.status !== "stable") reasons.push("drift_not_stable");
  if (provider.score < Math.max(70, settings.minimumProviderHealth)) reasons.push("provider_health_below_promotion_gate");
  if (performance.recent.settled < 20) reasons.push("recent_sample_below_20");
  if (performance.recent.averageClv !== null && performance.recent.averageClv < 0) reasons.push("recent_clv_negative");
  if (performance.recent.roi !== null && performance.recent.roi < -0.03) reasons.push("recent_roi_below_minus_3_percent");
  if (readyStreak < 1) reasons.push("requires_two_consecutive_ready_snapshots");
  const eligible = reasons.length === 0;
  const challenger = modelLab?.challenger || null;
  return {
    eligible,
    action: eligible ? "PROMOTE_PAPER_CHAMPION" : "KEEP_CHALLENGER_SHADOW",
    reasons,
    readyStreak: modelLab?.promotion?.eligible ? readyStreak + 1 : 0,
    championKey: eligible ? text(challenger?.id || "identity", 120) : text(previous.championModelKey || previous.champion_model_key || "identity", 120),
    challengerKey: text(challenger?.id || "identity", 120),
    probabilityAppliedToPublishedModel: false,
    affectsPaperRiskPolicyOnly: true
  };
}

export function buildAutonomousControlPlane({
  history = [],
  bankroll = 1000,
  modelLab = null,
  providerObservations = [],
  providerIncidents = [],
  settings = {},
  previousState = {}
} = {}) {
  const normalizedSettings = normalizeAutonomySettings(settings);
  const performance = summarizeAutonomousPerformance(history, { bankroll });
  const provider = summarizeProviderReadiness(providerObservations, providerIncidents);
  const blockers = [];
  const warnings = [];
  let score = 100;

  if (!normalizedSettings.learningEnabled) warnings.push("learning_disabled");
  if (modelLab?.drift?.status === "critical") { blockers.push("critical_model_drift"); score -= 100; }
  else if (modelLab?.drift?.status === "warning") { warnings.push("model_drift_warning"); score -= 22; }
  if (provider.score < 40 || provider.highIncidentCount > 0) { blockers.push("provider_outage_or_high_incident"); score -= 70; }
  else if (provider.score < normalizedSettings.minimumProviderHealth) { warnings.push("provider_health_below_user_gate"); score -= 28; }
  if (performance.all.lossStreak >= normalizedSettings.maxConsecutiveLosses) { blockers.push("consecutive_loss_limit"); score -= 65; }
  if ((performance.drawdownPercent || 0) * 100 >= normalizedSettings.maxDrawdownPercent) { blockers.push("paper_drawdown_limit"); score -= 70; }
  if (performance.recent.settled >= 20 && performance.recent.roi !== null && performance.recent.roi < -0.12) { warnings.push("recent_roi_below_minus_12_percent"); score -= 24; }
  if (performance.recent.settled >= 20 && performance.recent.averageClv !== null && performance.recent.averageClv < -0.03) { warnings.push("recent_clv_below_minus_3_percent"); score -= 22; }
  if (performance.sampleSize < 30) { warnings.push("learning_sample_below_30"); score -= 12; }
  score = clamp(score, 0, 100);

  const killSwitchActive = blockers.length > 0;
  let operatingMode = "active";
  if (killSwitchActive) operatingMode = "frozen";
  else if (performance.sampleSize < 30) operatingMode = "learning";
  else if (score < 70 || warnings.length) operatingMode = "cautious";
  else if (previousState.killSwitchActive || previousState.kill_switch_active) operatingMode = "recovery";

  let stakeMultiplier = normalizedSettings.activeStake;
  let maxPicks = Math.min(normalizedSettings.dailyPickLimit, normalizedSettings.activePicks);
  let nextCheckMinutes = 60;
  if (operatingMode === "frozen") { stakeMultiplier = 0; maxPicks = 0; nextCheckMinutes = 180; }
  if (operatingMode === "learning") { stakeMultiplier = normalizedSettings.learningStake; maxPicks = 1; nextCheckMinutes = 180; }
  if (operatingMode === "cautious") { stakeMultiplier = normalizedSettings.cautiousStake; maxPicks = 1; nextCheckMinutes = 120; }
  if (operatingMode === "recovery") { stakeMultiplier = Math.min(0.35, normalizedSettings.cautiousStake); maxPicks = 1; nextCheckMinutes = 90; }
  if (provider.score < normalizedSettings.minimumProviderHealth && !killSwitchActive) nextCheckMinutes = Math.min(nextCheckMinutes, 60);

  const promotion = promotionDecision({ modelLab, performance, provider, settings: normalizedSettings, previous: previousState });
  return {
    version: "autonomous-intelligence-v12",
    paperOnly: true,
    realMoneyBetting: false,
    operatingMode,
    healthScore: round(score, 1),
    killSwitch: {
      active: killSwitchActive,
      reason: blockers[0] || null,
      blockers,
      warnings,
      automaticRecoveryAllowed: true
    },
    riskPolicy: {
      stakeMultiplier: round(stakeMultiplier, 3),
      maximumPicks: maxPicks,
      nextCheckMinutes,
      publishedProbabilityChanged: false,
      contextCanUpgradeToPlay: false
    },
    settings: normalizedSettings,
    performance,
    provider,
    modelLab: {
      version: modelLab?.version || null,
      status: modelLab?.status || "unavailable",
      sampleSize: finite(modelLab?.sampleSize, 0),
      driftStatus: modelLab?.drift?.status || "unknown",
      promotion
    },
    reasons: [...blockers, ...warnings]
  };
}

export function applyAutonomousControl(decisions = [], control = {}) {
  const mode = control.operatingMode || "frozen";
  const multiplier = clamp(control.riskPolicy?.stakeMultiplier ?? 0, 0, 1);
  const maximumPicks = Math.max(0, Math.trunc(finite(control.riskPolicy?.maximumPicks, 0)));
  let playIndex = 0;
  return (Array.isArray(decisions) ? decisions : []).map((decision) => {
    const isPlay = decision.decision === "PLAY";
    const allowed = isPlay && mode !== "frozen" && playIndex < maximumPicks;
    if (isPlay) playIndex += 1;
    const originalStake = Math.max(0, finite(decision.allocatedStake ?? decision.suggestedStake, 0));
    const controlledStake = allowed ? round(originalStake * multiplier, 2) : 0;
    const blockedReason = !isPlay
      ? null
      : mode === "frozen"
        ? control.killSwitch?.reason || "autonomous_kill_switch"
        : playIndex > maximumPicks
          ? "autonomous_pick_limit"
          : controlledStake < 0.01
            ? "autonomous_stake_below_minimum"
            : null;
    return {
      ...decision,
      decision: isPlay && !allowed ? "WATCH" : decision.decision,
      suggestedStake: isPlay ? controlledStake : decision.suggestedStake,
      allocatedStake: isPlay ? controlledStake : decision.allocatedStake,
      agentVersion: "V12-autonomous-intelligence",
      autonomousV12: {
        mode,
        healthScore: control.healthScore,
        stakeMultiplier: multiplier,
        killSwitchActive: Boolean(control.killSwitch?.active),
        blockedReason,
        championModelKey: control.modelLab?.promotion?.championKey || "identity",
        challengerModelKey: control.modelLab?.promotion?.challengerKey || "identity",
        probabilityAdjustedByLearning: false,
        paperOnly: true
      },
      portfolioReason: blockedReason
        ? `Autonomous Intelligence V12 blocked new paper exposure: ${blockedReason}.`
        : decision.portfolioReason
    };
  });
}

export function buildAutonomousIncidents(control = {}) {
  const incidents = [];
  const add = (type, severity, title, message, details = {}) => incidents.push({
    fingerprint: `autonomous-v12:${type}`,
    incidentType: type,
    severity,
    title,
    message,
    details
  });
  if (control.killSwitch?.active) add("kill_switch", "high", "Autonomous paper execution frozen", `New paper exposure is frozen because ${control.killSwitch.reason || "a safety gate failed"}.`, { blockers: control.killSwitch.blockers });
  if (control.modelLab?.driftStatus === "warning") add("model_drift", "medium", "Model drift warning", "The challenger remains shadow-only and paper stake is reduced.");
  if (control.provider?.status === "degraded") add("provider_degraded", "medium", "Provider quality is degraded", `Provider health is ${control.provider.score}/100.`);
  if (control.provider?.status === "offline") add("provider_offline", "high", "Provider quality is unsafe", `Provider health is ${control.provider.score}/100.`);
  if (control.performance?.all?.lossStreak >= control.settings?.maxConsecutiveLosses) add("loss_streak", "high", "Consecutive-loss limit reached", `The current paper loss streak is ${control.performance.all.lossStreak}.`);
  if ((control.performance?.drawdownPercent || 0) * 100 >= (control.settings?.maxDrawdownPercent || 12)) add("drawdown", "high", "Paper drawdown limit reached", `Paper drawdown is ${((control.performance.drawdownPercent || 0) * 100).toFixed(1)}%.`);
  return incidents;
}

export const AUTONOMOUS_V12_DEFAULTS = Object.freeze({
  autonomyProfile: "conservative",
  learningEnabled: true,
  autoPaperPromotion: true,
  maxConsecutiveLosses: 6,
  maxDrawdownPercent: 12,
  minimumProviderHealth: 60
});
