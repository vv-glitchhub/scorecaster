const MODE_RANK = Object.freeze({ FROZEN: 0, DEGRADED: 1, BOOTSTRAP: 2, GUARDED: 3, ACTIVE: 4 });

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

function settledOutcome(row = {}) {
  const status = String(row.result || row.status || "").toLowerCase();
  if (["win", "won"].includes(status)) return "win";
  if (["loss", "lost"].includes(status)) return "loss";
  if (["push", "void"].includes(status)) return "push";
  return null;
}

function rowTime(row = {}, index = 0) {
  const parsed = Date.parse(row.settledAt || row.settled_at || row.updatedAt || row.updated_at || row.createdAt || row.created_at || "");
  return Number.isFinite(parsed) ? parsed : index;
}

function rowProfit(row = {}) {
  const explicit = optionalFinite(row.profit);
  if (explicit !== null) return explicit;
  const outcome = settledOutcome(row);
  const stake = Math.max(0, finite(row.stake));
  const odds = Math.max(1, finite(row.odds, 1));
  if (outcome === "win") return stake * (odds - 1);
  if (outcome === "loss") return -stake;
  if (outcome === "push") return 0;
  return null;
}

function rowClv(row = {}) {
  const explicit = optionalFinite(row.clv);
  if (explicit !== null) return Math.abs(explicit) > 1 ? explicit / 100 : explicit;
  const odds = optionalFinite(row.odds);
  const closing = optionalFinite(row.closingOdds ?? row.closing_odds);
  return odds && closing && odds > 1 && closing > 1 ? odds / closing - 1 : null;
}

export function summarizeAutonomousHistory(rows = [], { bankroll = 1000 } = {}) {
  const settled = (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({ ...row, _outcome: settledOutcome(row), _time: rowTime(row, index), _profit: rowProfit(row), _clv: rowClv(row) }))
    .filter((row) => row._outcome)
    .sort((left, right) => left._time - right._time);

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let losingStreak = 0;
  let currentLosingStreak = 0;
  let staked = 0;
  let profit = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  const clvRows = [];

  for (const row of settled) {
    const stake = Math.max(0, finite(row.stake));
    const rowResult = finite(row._profit);
    staked += stake;
    profit += rowResult;
    cumulative += rowResult;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    if (row._outcome === "win") {
      wins += 1;
      currentLosingStreak = 0;
    } else if (row._outcome === "loss") {
      losses += 1;
      currentLosingStreak += 1;
      losingStreak = Math.max(losingStreak, currentLosingStreak);
    } else {
      pushes += 1;
    }
    if (row._clv !== null) clvRows.push(row._clv);
  }

  const recent = settled.slice(-30);
  const recentProfit = recent.reduce((sum, row) => sum + finite(row._profit), 0);
  const recentStake = recent.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const last = settled.at(-1) || null;
  const averageClv = clvRows.length ? clvRows.reduce((sum, value) => sum + value, 0) / clvRows.length : null;
  const positiveClvRate = clvRows.length ? clvRows.filter((value) => value > 0).length / clvRows.length : null;
  const safeBankroll = Math.max(1, finite(bankroll, 1000));

  return {
    settledCount: settled.length,
    wins,
    losses,
    pushes,
    hitRate: wins + losses ? round(wins / (wins + losses), 4) : null,
    staked: round(staked, 2),
    profit: round(profit, 2),
    roi: staked > 0 ? round(profit / staked, 4) : null,
    maxDrawdown: round(maxDrawdown, 2),
    maxDrawdownRate: round(maxDrawdown / safeBankroll, 4),
    currentLosingStreak,
    longestLosingStreak: losingStreak,
    recent30: {
      count: recent.length,
      profit: round(recentProfit, 2),
      roi: recentStake > 0 ? round(recentProfit / recentStake, 4) : null,
      bankrollImpact: round(recentProfit / safeBankroll, 4)
    },
    clv: {
      count: clvRows.length,
      average: round(averageClv, 4),
      positiveRate: round(positiveClvRate, 4)
    },
    lastSettledAt: last ? new Date(last._time).toISOString() : null
  };
}

function ledgerOf(decision = {}) {
  return decision.unifiedSportsData || decision.ledger || null;
}

export function summarizeAutonomousDataReadiness(decisions = []) {
  const rows = Array.isArray(decisions) ? decisions : [];
  const ledgers = rows.map(ledgerOf).filter(Boolean);
  const verified = ledgers.map((ledger) => finite(ledger?.coverage?.verifiedCoverageRate));
  const coverage = ledgers.map((ledger) => finite(ledger?.coverage?.coverageRate));
  const providers = ledgers.map((ledger) => Math.max(0, finite(ledger?.coverage?.independentOddsProviders, 1)));
  const downgradeCount = ledgers.filter((ledger) => ledger?.safetyRecommendation?.action === "DOWNGRADE_TO_CAUTION").length;
  const missingFamilies = new Map();
  for (const ledger of ledgers) {
    for (const item of ledger?.missingData || []) {
      const key = String(item.factor || "unknown");
      missingFamilies.set(key, (missingFamilies.get(key) || 0) + 1);
    }
  }
  return {
    candidateCount: rows.length,
    ledgerCount: ledgers.length,
    ledgerRate: rows.length ? round(ledgers.length / rows.length, 4) : 0,
    averageVerifiedCoverage: verified.length ? round(verified.reduce((sum, value) => sum + value, 0) / verified.length, 4) : 0,
    averageCoverage: coverage.length ? round(coverage.reduce((sum, value) => sum + value, 0) / coverage.length, 4) : 0,
    averageOddsProviders: providers.length ? round(providers.reduce((sum, value) => sum + value, 0) / providers.length, 3) : 0,
    multiProviderRate: providers.length ? round(providers.filter((value) => value >= 2).length / providers.length, 4) : 0,
    downgradeCount,
    missingFamilies: [...missingFamilies.entries()].map(([factor, count]) => ({ factor, count })).sort((a, b) => b.count - a.count || a.factor.localeCompare(b.factor))
  };
}

function hoursSince(value, now) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 3_600_000) : null;
}

export function buildAutonomyState({ history = [], decisions = [], modelLab = null, bankroll = {}, openBets = [], now = new Date() } = {}) {
  const clock = now instanceof Date ? now : new Date(now);
  const safeClock = Number.isNaN(clock.getTime()) ? new Date() : clock;
  const historySummary = summarizeAutonomousHistory(history, { bankroll: bankroll.bankroll });
  const dataReadiness = summarizeAutonomousDataReadiness(decisions);
  const blockers = [];
  const warnings = [];

  if (bankroll.paperTradingMode === false || finite(bankroll.bankroll) <= 0) blockers.push("virtual_bankroll_inactive");
  if (modelLab?.drift?.status === "critical") blockers.push("critical_model_drift");
  if (dataReadiness.candidateCount > 0 && dataReadiness.ledgerRate < 0.5) blockers.push("unified_data_ledger_missing");
  if (dataReadiness.candidateCount > 0 && dataReadiness.averageVerifiedCoverage < 0.35) blockers.push("verified_data_coverage_critical");
  if (historySummary.recent30.bankrollImpact !== null && historySummary.recent30.bankrollImpact <= -0.06) blockers.push("rolling_loss_limit");
  const sinceLastSettlement = hoursSince(historySummary.lastSettledAt, safeClock);
  if (historySummary.currentLosingStreak >= 5 && sinceLastSettlement !== null && sinceLastSettlement < 24) blockers.push("loss_streak_cooldown");

  if (modelLab?.drift?.status === "warning") warnings.push("model_drift_warning");
  if (historySummary.maxDrawdownRate !== null && historySummary.maxDrawdownRate >= 0.05) warnings.push("drawdown_elevated");
  if (historySummary.recent30.bankrollImpact !== null && historySummary.recent30.bankrollImpact <= -0.03) warnings.push("recent_losses_elevated");
  if (historySummary.clv.count >= 20 && finite(historySummary.clv.average) < -0.015) warnings.push("negative_clv_signal");
  if (dataReadiness.candidateCount > 0 && dataReadiness.averageVerifiedCoverage < 0.55) warnings.push("verified_data_coverage_low");
  if (dataReadiness.candidateCount > 0 && dataReadiness.multiProviderRate < 0.35) warnings.push("multi_provider_coverage_low");

  let mode = "ACTIVE";
  let reason = "All autonomy gates are healthy.";
  if (blockers.length) {
    mode = "FROZEN";
    reason = "A fail-closed circuit breaker stopped new autonomous paper exposure.";
  } else if (dataReadiness.candidateCount > 0 && (dataReadiness.ledgerRate < 0.8 || dataReadiness.averageVerifiedCoverage < 0.45)) {
    mode = "DEGRADED";
    reason = "Current data readiness is too weak for normal autonomous sizing.";
  } else if (historySummary.settledCount < 30) {
    mode = "BOOTSTRAP";
    reason = "The agent is collecting an initial settled sample with minimum exposure.";
  } else if (historySummary.settledCount < 120 || warnings.length || modelLab?.status !== "promotion-ready") {
    mode = "GUARDED";
    reason = "The agent is operational but remains under conservative risk controls.";
  }

  const modeSettings = {
    FROZEN: { stakeMultiplier: 0, pickCap: 0, requireMultiProvider: true },
    DEGRADED: { stakeMultiplier: 0.2, pickCap: 1, requireMultiProvider: true },
    BOOTSTRAP: { stakeMultiplier: 0.25, pickCap: 1, requireMultiProvider: false },
    GUARDED: { stakeMultiplier: 0.5, pickCap: 2, requireMultiProvider: false },
    ACTIVE: { stakeMultiplier: 1, pickCap: 3, requireMultiProvider: false }
  }[mode];

  return {
    version: "autonomous-scorecaster-v12",
    mode,
    modeRank: MODE_RANK[mode],
    reason,
    blockers,
    warnings,
    stakeMultiplier: modeSettings.stakeMultiplier,
    pickCap: modeSettings.pickCap,
    requireMultiProvider: modeSettings.requireMultiProvider,
    history: historySummary,
    dataReadiness,
    modelLab: {
      version: modelLab?.version || null,
      status: modelLab?.status || "unavailable",
      sampleSize: finite(modelLab?.sampleSize),
      promotionEligible: Boolean(modelLab?.promotion?.eligible),
      driftStatus: modelLab?.drift?.status || "unknown",
      challengerId: modelLab?.challenger?.id || null,
      probabilityApplied: false
    },
    exposure: {
      openCount: Array.isArray(openBets) ? openBets.length : 0,
      openStake: round((Array.isArray(openBets) ? openBets : []).reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0), 2)
    },
    resumeConditions: blockers.map((blocker) => ({
      blocker,
      condition: blocker === "critical_model_drift" ? "Model drift must return below critical."
        : blocker === "rolling_loss_limit" ? "Rolling losses must recover above the hard bankroll limit."
          : blocker === "loss_streak_cooldown" ? "At least 24 hours must pass after the latest settled loss."
            : blocker === "verified_data_coverage_critical" || blocker === "unified_data_ledger_missing" ? "Verified unified-data coverage must recover."
              : "Virtual bankroll and paper mode must be active."
    })),
    generatedAt: safeClock.toISOString(),
    paperOnly: true,
    realMoneyBetting: false
  };
}

function candidateEvidence(decision = {}) {
  const ledger = ledgerOf(decision);
  const verifiedCoverage = finite(ledger?.coverage?.verifiedCoverageRate);
  const coverage = finite(ledger?.coverage?.coverageRate);
  const providers = Math.max(1, finite(ledger?.coverage?.independentOddsProviders, 1));
  const safetyAction = ledger?.safetyRecommendation?.action || "UNKNOWN";
  const missingCount = Array.isArray(ledger?.missingData) ? ledger.missingData.length : 0;
  return { ledger, verifiedCoverage, coverage, providers, safetyAction, missingCount };
}

export function applyAutonomyPolicy(decisions = [], autonomyState = null) {
  const state = autonomyState || buildAutonomyState({ decisions });
  return (Array.isArray(decisions) ? decisions : []).map((decision) => {
    const evidence = candidateEvidence(decision);
    const blockers = [];
    const warnings = [];
    if (state.mode === "FROZEN") blockers.push(...state.blockers.map((item) => `autonomy:${item}`));
    if (decision.decision === "PLAY" && !evidence.ledger) blockers.push("autonomy:missing_unified_ledger");
    if (decision.decision === "PLAY" && evidence.verifiedCoverage < 0.4) blockers.push("autonomy:verified_coverage_below_40pct");
    if (decision.decision === "PLAY" && evidence.safetyAction === "DOWNGRADE_TO_CAUTION") blockers.push("autonomy:verified_context_downgrade");
    if (decision.decision === "PLAY" && state.requireMultiProvider && evidence.providers < 2) blockers.push("autonomy:multi_provider_required");
    if (evidence.providers < 2) warnings.push("single_odds_provider");
    if (evidence.verifiedCoverage < 0.6) warnings.push("limited_verified_context");
    if (evidence.missingCount >= 5) warnings.push("many_missing_data_families");

    const evidenceMultiplier = evidence.providers >= 2 ? 1 : 0.65;
    const coverageMultiplier = clamp(0.5 + evidence.verifiedCoverage * 0.75, 0.5, 1);
    const multiplier = round(state.stakeMultiplier * evidenceMultiplier * coverageMultiplier, 4);
    const originalStake = Math.max(0, finite(decision.allocatedStake || decision.suggestedStake));
    const blocked = blockers.length > 0;
    const nextStake = blocked ? 0 : round(originalStake * multiplier, 2);

    return {
      ...decision,
      decision: blocked && decision.decision === "PLAY" ? "WATCH" : decision.decision,
      suggestedStake: nextStake,
      allocatedStake: nextStake,
      blockers: [...(decision.blockers || []), ...blockers],
      warnings: [...(decision.warnings || []), ...warnings],
      portfolioReason: blocked
        ? "Autonomous Scorecaster V12 blocked new paper exposure because a safety or data gate failed."
        : `${decision.portfolioReason || "Candidate retained."} V12 autonomy multiplier ${multiplier}.`,
      autonomyV12: {
        mode: state.mode,
        stakeMultiplier: multiplier,
        originalStake: round(originalStake, 2),
        finalStake: nextStake,
        blocked,
        blockers,
        warnings,
        evidence: {
          verifiedCoverage: round(evidence.verifiedCoverage, 4),
          coverage: round(evidence.coverage, 4),
          oddsProviders: evidence.providers,
          missingFamilies: evidence.missingCount,
          safetyAction: evidence.safetyAction
        },
        probabilityChanged: false,
        productionDecisionUpgraded: false,
        paperOnly: true
      },
      agentVersion: `${decision.agentVersion || "V11-model-lab-shadow"}+autonomous-v12`
    };
  });
}

export function buildAutonomyJournal({ state, decisions = [], selected = [], skipped = [] } = {}) {
  const governed = Array.isArray(decisions) ? decisions : [];
  return {
    version: "autonomy-journal-v12",
    mode: state?.mode || "UNKNOWN",
    headline: state?.reason || "Autonomy state unavailable.",
    blockers: state?.blockers || [],
    warnings: state?.warnings || [],
    candidateCount: governed.length,
    playAfterGovernance: governed.filter((item) => item.decision === "PLAY").length,
    blockedByAutonomy: governed.filter((item) => item.autonomyV12?.blocked).length,
    selectedCount: selected.length,
    skippedCount: skipped.length,
    stakeMultiplier: state?.stakeMultiplier ?? 0,
    modelLab: state?.modelLab || null,
    dataReadiness: state?.dataReadiness || null,
    history: state?.history || null,
    generatedAt: state?.generatedAt || new Date().toISOString(),
    probabilityChanged: false,
    realMoneyBetting: false,
    paperOnly: true
  };
}

export const AUTONOMOUS_V12_MODE_RANK = MODE_RANK;
