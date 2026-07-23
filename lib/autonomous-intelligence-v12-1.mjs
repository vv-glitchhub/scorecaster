function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function round(value, digits = 4) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(digits));
}

function outcome(row = {}) {
  const value = String(row.result || row.status || "").toLowerCase();
  if (["win", "won"].includes(value)) return "win";
  if (["loss", "lost"].includes(value)) return "loss";
  if (["push", "void"].includes(value)) return "push";
  return null;
}

function probability(row = {}) {
  const value = finite(row.modelProbability ?? row.raw_pick?.modelProbability ?? row.rawPick?.modelProbability);
  return value !== null && value > 0 && value < 1 ? value : null;
}

function profit(row = {}) {
  const explicit = finite(row.profit);
  if (explicit !== null) return explicit;
  const result = outcome(row);
  const stake = Math.max(0, finite(row.stake, 0));
  const odds = Math.max(1, finite(row.odds, 1));
  if (result === "win") return stake * (odds - 1);
  if (result === "loss") return -stake;
  if (result === "push") return 0;
  return null;
}

function clv(row = {}) {
  const explicit = finite(row.clv);
  if (explicit !== null) return Math.abs(explicit) > 1 ? explicit / 100 : explicit;
  const odds = finite(row.odds);
  const closing = finite(row.closingOdds ?? row.closing_odds);
  return odds && closing && odds > 1 && closing > 1 ? odds / closing - 1 : null;
}

function chronology(row = {}, index = 0) {
  const parsed = Date.parse(row.settledAt || row.settled_at || row.updatedAt || row.updated_at || row.createdAt || row.created_at || "");
  return Number.isFinite(parsed) ? parsed : index;
}

function normalizeHistory(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const result = outcome(row);
    const rowProfit = profit(row);
    if (!result || rowProfit === null) return null;
    return {
      ...row,
      result,
      _time: chronology(row, index),
      _profit: rowProfit,
      _clv: clv(row),
      _probability: probability(row),
      stake: Math.max(0, finite(row.stake, 0))
    };
  }).filter(Boolean).sort((a, b) => a._time - b._time);
}

function summarize(rows = []) {
  const stake = rows.reduce((sum, row) => sum + row.stake, 0);
  const totalProfit = rows.reduce((sum, row) => sum + row._profit, 0);
  const clvRows = rows.filter((row) => row._clv !== null);
  const probabilityRows = rows.filter((row) => row._probability !== null && ["win", "loss"].includes(row.result));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let lossStreak = 0;
  for (const row of rows) {
    cumulative += row._profit;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
  }
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].result === "loss") lossStreak += 1;
    else if (rows[index].result !== "push") break;
  }
  const brier = probabilityRows.length
    ? probabilityRows.reduce((sum, row) => sum + (row._probability - (row.result === "win" ? 1 : 0)) ** 2, 0) / probabilityRows.length
    : null;
  return {
    count: rows.length,
    stake: round(stake, 2),
    profit: round(totalProfit, 2),
    roi: stake > 0 ? round(totalProfit / stake, 4) : null,
    averageClv: clvRows.length ? round(clvRows.reduce((sum, row) => sum + row._clv, 0) / clvRows.length, 4) : null,
    positiveClvRate: clvRows.length ? round(clvRows.filter((row) => row._clv > 0).length / clvRows.length, 4) : null,
    brierScore: brier === null ? null : round(brier, 4),
    maxDrawdown: round(maxDrawdown, 2),
    lossStreak
  };
}

export function summarizeV121Performance(rows = [], { bankroll = 1000 } = {}) {
  const normalized = normalizeHistory(rows);
  const recent20 = normalized.slice(-20);
  const reference = normalized.slice(-50, -20);
  const all = summarize(normalized);
  const recent = summarize(recent20);
  const baseline = summarize(reference);
  return {
    version: "autonomous-performance-v12.1",
    sampleSize: normalized.length,
    all,
    recent,
    reference: baseline,
    drawdownRate: round((all.maxDrawdown || 0) / Math.max(1, finite(bankroll, 1000)), 4),
    roiTrend: recent.roi !== null && baseline.roi !== null ? round(recent.roi - baseline.roi, 4) : null,
    clvTrend: recent.averageClv !== null && baseline.averageClv !== null ? round(recent.averageClv - baseline.averageClv, 4) : null,
    brierTrend: recent.brierScore !== null && baseline.brierScore !== null ? round(recent.brierScore - baseline.brierScore, 4) : null
  };
}

export function summarizeV121ProviderHealth(observations = [], incidents = []) {
  const rows = Array.isArray(observations) ? observations : [];
  const activeIncidents = (Array.isArray(incidents) ? incidents : []).filter((row) => row.active !== false);
  const live = rows.filter((row) => row.ok === true || row.mode === "live");
  const trust = rows.map((row) => finite(row.trust_score ?? row.trust)).filter((value) => value !== null);
  const divergence = rows.map((row) => finite(row.divergence)).filter((value) => value !== null);
  const availabilityRate = rows.length ? live.length / rows.length : null;
  const averageTrust = trust.length ? trust.reduce((sum, value) => sum + value, 0) / trust.length : null;
  const averageDivergence = divergence.length ? divergence.reduce((sum, value) => sum + value, 0) / divergence.length : null;
  const highIncidents = activeIncidents.filter((row) => String(row.severity).toLowerCase() === "high");
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
    highIncidentCount: highIncidents.length
  };
}

export function normalizeV121Settings(row = {}) {
  const profile = ["conservative", "balanced", "research"].includes(row.autonomy_profile || row.autonomyProfile)
    ? row.autonomy_profile || row.autonomyProfile
    : "conservative";
  return {
    profile,
    learningEnabled: row.learning_enabled ?? row.learningEnabled ?? true,
    autoPaperPromotion: row.auto_paper_promotion ?? row.autoPaperPromotion ?? true,
    maxConsecutiveLosses: Math.trunc(clamp(row.max_consecutive_losses ?? row.maxConsecutiveLosses ?? 6, 3, 20)),
    maxDrawdownPercent: clamp(row.max_drawdown_percent ?? row.maxDrawdownPercent ?? 12, 3, 30),
    minimumProviderHealth: clamp(row.minimum_provider_health ?? row.minimumProviderHealth ?? 60, 30, 90)
  };
}

function adaptiveInterval(mode, providerScore) {
  if (mode === "FROZEN") return 180;
  if (mode === "RECOVERY") return 90;
  if (mode === "DEGRADED") return providerScore < 60 ? 60 : 120;
  if (mode === "BOOTSTRAP") return 180;
  if (mode === "GUARDED") return 120;
  return 60;
}

function promotionDecision({ modelLab, performance, provider, settings, previousState }) {
  const reasons = [];
  const readyStreak = Math.max(0, Math.trunc(finite(previousState?.promotion_ready_streak ?? previousState?.promotionReadyStreak, 0)));
  if (!settings.learningEnabled) reasons.push("learning_disabled");
  if (!settings.autoPaperPromotion) reasons.push("paper_promotion_disabled");
  if (!modelLab?.promotion?.eligible) reasons.push("challenger_not_holdout_eligible");
  if (performance.sampleSize < 300) reasons.push("minimum_300_samples_not_met");
  if (modelLab?.drift?.status !== "stable") reasons.push("drift_not_stable");
  if (provider.score < Math.max(70, settings.minimumProviderHealth)) reasons.push("provider_health_below_promotion_gate");
  if (performance.recent.count < 20) reasons.push("recent_sample_below_20");
  if (performance.recent.averageClv !== null && performance.recent.averageClv < 0) reasons.push("recent_clv_negative");
  if (performance.recent.roi !== null && performance.recent.roi < -0.03) reasons.push("recent_roi_below_minus_3_percent");
  if (readyStreak < 1) reasons.push("requires_two_ready_snapshots");
  const eligible = reasons.length === 0;
  const challengerKey = modelLab?.challenger?.id || "identity";
  return {
    eligible,
    action: eligible ? "PROMOTE_PAPER_CHAMPION" : "KEEP_CHALLENGER_SHADOW",
    reasons,
    readyStreak: modelLab?.promotion?.eligible ? readyStreak + 1 : 0,
    championKey: eligible ? challengerKey : previousState?.champion_model_key || previousState?.championModelKey || "identity",
    challengerKey,
    probabilityAppliedToPublishedModel: false,
    paperRiskPolicyOnly: true
  };
}

export function buildV121Control({ baseState = {}, history = [], bankroll = 1000, modelLab = null, providerObservations = [], providerIncidents = [], settings = {}, previousState = {} } = {}) {
  const normalizedSettings = normalizeV121Settings(settings);
  const performance = summarizeV121Performance(history, { bankroll });
  const provider = summarizeV121ProviderHealth(providerObservations, providerIncidents);
  const blockers = [...(baseState.blockers || [])];
  const warnings = [...(baseState.warnings || [])];
  if (provider.status === "offline" || provider.highIncidentCount > 0) blockers.push("provider_outage_or_high_incident");
  else if (provider.score < normalizedSettings.minimumProviderHealth) warnings.push("provider_health_below_user_gate");
  if (performance.all.lossStreak >= normalizedSettings.maxConsecutiveLosses) blockers.push("configured_loss_streak_limit");
  if ((performance.drawdownRate || 0) * 100 >= normalizedSettings.maxDrawdownPercent) blockers.push("configured_drawdown_limit");
  if (performance.recent.count >= 20 && performance.recent.roi !== null && performance.recent.roi < -0.12) warnings.push("recent_roi_below_minus_12_percent");
  if (performance.recent.count >= 20 && performance.recent.averageClv !== null && performance.recent.averageClv < -0.03) warnings.push("recent_clv_below_minus_3_percent");

  let mode = baseState.mode || "BOOTSTRAP";
  if (blockers.length) mode = "FROZEN";
  else if (previousState?.kill_switch_active && mode !== "FROZEN") mode = "RECOVERY";
  else if (provider.status === "degraded" && ["ACTIVE", "GUARDED"].includes(mode)) mode = "DEGRADED";

  let healthScore = 100;
  healthScore -= blockers.length * 55;
  healthScore -= warnings.length * 12;
  healthScore -= Math.max(0, 70 - provider.score) * 0.7;
  if (performance.sampleSize < 30) healthScore -= 12;
  healthScore = clamp(healthScore, 0, 100);
  const promotion = promotionDecision({ modelLab, performance, provider, settings: normalizedSettings, previousState });

  return {
    version: "autonomous-intelligence-v12.1",
    mode,
    healthScore: round(healthScore, 1),
    killSwitchActive: mode === "FROZEN",
    killSwitchReason: blockers[0] || null,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    nextIntervalMinutes: adaptiveInterval(mode, provider.score),
    settings: normalizedSettings,
    performance,
    provider,
    modelLab: {
      version: modelLab?.version || null,
      status: modelLab?.status || "unavailable",
      driftStatus: modelLab?.drift?.status || "unknown",
      sampleSize: finite(modelLab?.sampleSize, 0),
      promotion
    },
    baseState,
    paperOnly: true,
    realMoneyBetting: false,
    publishedProbabilityChanged: false
  };
}

export function buildV121Incidents(control = {}) {
  const incidents = [];
  const add = (type, severity, title, message, details = {}) => incidents.push({ fingerprint: `autonomous-v12.1:${type}`, incidentType: type, severity, title, message, details });
  if (control.killSwitchActive) add("kill_switch", "high", "Autonomous paper exposure frozen", `New paper exposure is frozen because ${control.killSwitchReason || "a safety gate failed"}.`, { blockers: control.blockers });
  if (control.modelLab?.driftStatus === "warning") add("model_drift", "medium", "Model drift warning", "The challenger remains shadow-only and autonomy stays guarded.");
  if (control.provider?.status === "degraded") add("provider_degraded", "medium", "Provider quality is degraded", `Provider health is ${control.provider.score}/100.`);
  if (control.provider?.status === "offline") add("provider_offline", "high", "Provider quality is unsafe", `Provider health is ${control.provider.score}/100.`);
  if (control.performance?.all?.lossStreak >= control.settings?.maxConsecutiveLosses) add("loss_streak", "high", "Consecutive-loss limit reached", `The current paper loss streak is ${control.performance.all.lossStreak}.`);
  if ((control.performance?.drawdownRate || 0) * 100 >= (control.settings?.maxDrawdownPercent || 12)) add("drawdown", "high", "Paper drawdown limit reached", `Paper drawdown is ${((control.performance.drawdownRate || 0) * 100).toFixed(1)}%.`);
  return incidents;
}
