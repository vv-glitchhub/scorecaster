const HARD_MAX_STAKE_PERCENT = 1;
const HARD_MAX_DAILY_EXPOSURE_PERCENT = 5;
const HARD_MAX_LEAGUE_EXPOSURE_PERCENT = 2.5;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function resultFromRow(row = {}) {
  const value = normalized(row.result || row.status);
  if (["win", "won"].includes(value)) return "win";
  if (["loss", "lost"].includes(value)) return "loss";
  if (["push", "void"].includes(value)) return "push";
  return "pending";
}

function timestampFromRow(row = {}) {
  const value = Date.parse(row.createdAt || row.created_at || row.settledAt || row.settled_at || "");
  return Number.isFinite(value) ? value : 0;
}

function modelProbability(row = {}) {
  const value = finite(
    row.modelProbability ??
    row.consensusProbability ??
    row.raw_pick?.modelProbability ??
    row.rawPick?.modelProbability,
    NaN
  );
  return value > 0 && value < 1 ? value : null;
}

function closingOdds(row = {}) {
  const value = finite(row.closingOdds ?? row.closing_odds, NaN);
  return value > 1 ? value : null;
}

function clvFromRow(row = {}) {
  const odds = finite(row.odds, NaN);
  const closing = closingOdds(row);
  if (!(odds > 1) || closing === null) return null;
  return (odds / closing) - 1;
}

function profitFromRow(row = {}) {
  const stake = Math.max(0, finite(row.stake));
  const odds = finite(row.odds);
  const result = resultFromRow(row);
  if (result === "win") return stake * Math.max(0, odds - 1);
  if (result === "loss") return -stake;
  return 0;
}

function summarizeWindow(rows = []) {
  const decisions = rows.filter((row) => ["win", "loss"].includes(resultFromRow(row)));
  const totalStake = decisions.reduce((sum, row) => sum + Math.max(0, finite(row.stake)), 0);
  const profit = decisions.reduce((sum, row) => sum + profitFromRow(row), 0);
  const clvValues = rows.map(clvFromRow).filter((value) => value !== null);
  const calibrated = decisions
    .map((row) => ({ probability: modelProbability(row), outcome: resultFromRow(row) === "win" ? 1 : 0 }))
    .filter((row) => row.probability !== null);
  const expectedWinRate = calibrated.length
    ? calibrated.reduce((sum, row) => sum + row.probability, 0) / calibrated.length
    : null;
  const actualWinRate = calibrated.length
    ? calibrated.reduce((sum, row) => sum + row.outcome, 0) / calibrated.length
    : null;
  const brierScore = calibrated.length
    ? calibrated.reduce((sum, row) => sum + ((row.probability - row.outcome) ** 2), 0) / calibrated.length
    : null;

  return {
    decisions: decisions.length,
    totalStake,
    profit,
    roi: totalStake > 0 ? profit / totalStake : null,
    clvCount: clvValues.length,
    averageClv: clvValues.length ? clvValues.reduce((sum, value) => sum + value, 0) / clvValues.length : null,
    calibrationCount: calibrated.length,
    brierScore,
    calibrationGap: expectedWinRate !== null && actualWinRate !== null
      ? actualWinRate - expectedWinRate
      : null
  };
}

function losingStreak(rows = []) {
  let streak = 0;
  for (const row of rows) {
    const result = resultFromRow(row);
    if (result === "loss") streak += 1;
    else if (result === "win") break;
  }
  return streak;
}

export function applyAutonomousSystemCaps(bankroll = {}) {
  return {
    ...bankroll,
    maxStakePercent: clamp(bankroll.maxStakePercent ?? bankroll.max_stake_percent ?? 0.75, 0.1, HARD_MAX_STAKE_PERCENT),
    maxTotalExposurePercent: clamp(
      bankroll.maxTotalExposurePercent ?? bankroll.max_daily_exposure_percent ?? 4,
      0.5,
      HARD_MAX_DAILY_EXPOSURE_PERCENT
    ),
    maxLeagueExposurePercent: clamp(
      bankroll.maxLeagueExposurePercent ?? bankroll.max_single_league_exposure_percent ?? 2.5,
      0.25,
      HARD_MAX_LEAGUE_EXPOSURE_PERCENT
    )
  };
}

export function buildDailyPaperUsage(rows = []) {
  const autonomousRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const source = normalized(row.raw_pick?.source || row.rawPick?.source);
    return source.startsWith("scorecaster-autonomous-");
  });
  const events = new Set();
  let totalStake = 0;
  for (const row of autonomousRows) {
    totalStake += Math.max(0, finite(row.stake));
    const event = normalized(row.raw_pick?.eventId || row.rawPick?.eventId || row.match);
    if (event) events.add(event);
  }
  return {
    pickCount: autonomousRows.length,
    totalStake,
    events,
    rows: autonomousRows
  };
}

export function buildAutonomousRiskGovernor(history = [], { modelLab = null } = {}) {
  const ordered = (Array.isArray(history) ? history : [])
    .filter((row) => ["win", "loss", "push"].includes(resultFromRow(row)))
    .sort((left, right) => timestampFromRow(right) - timestampFromRow(left));
  const recent20 = summarizeWindow(ordered.slice(0, 20));
  const recent50 = summarizeWindow(ordered.slice(0, 50));
  const streak = losingStreak(ordered);
  const hardReasons = [];
  const cautionReasons = [];
  const driftStatus = modelLab?.drift?.status || "unknown";

  if (driftStatus === "critical") hardReasons.push("critical_model_drift");
  if (streak >= 6) hardReasons.push("loss_streak_6");
  if (recent20.decisions >= 12 && recent20.roi !== null && recent20.roi <= -0.25) hardReasons.push("recent_roi_below_-25pct");
  if (recent50.clvCount >= 20 && recent50.averageClv !== null && recent50.averageClv <= -0.04) hardReasons.push("recent_clv_below_-4pct");
  if (
    recent50.calibrationCount >= 30 &&
    recent50.calibrationGap !== null &&
    Math.abs(recent50.calibrationGap) >= 0.15
  ) hardReasons.push("calibration_gap_above_15pct");

  if (driftStatus === "warning") cautionReasons.push("model_drift_warning");
  if (streak >= 3) cautionReasons.push("loss_streak_3");
  if (recent20.decisions >= 10 && recent20.roi !== null && recent20.roi <= -0.1) cautionReasons.push("recent_roi_below_-10pct");
  if (recent50.clvCount >= 15 && recent50.averageClv !== null && recent50.averageClv < 0) cautionReasons.push("negative_recent_clv");
  if (recent50.calibrationCount >= 25 && recent50.brierScore !== null && recent50.brierScore >= 0.29) cautionReasons.push("weak_recent_brier");

  const paused = hardReasons.length > 0;
  const caution = !paused && cautionReasons.length > 0;
  return {
    version: "autonomous-risk-governor-v2",
    mode: paused ? "paused" : caution ? "caution" : "active",
    allowNewExposure: !paused,
    stakeMultiplier: paused ? 0 : caution ? 0.5 : 1,
    priorityPenalty: caution ? 0.03 : 0,
    hardReasons,
    cautionReasons,
    losingStreak: streak,
    driftStatus,
    recent20,
    recent50,
    hardLimits: {
      maxStakePercent: HARD_MAX_STAKE_PERCENT,
      maxDailyExposurePercent: HARD_MAX_DAILY_EXPOSURE_PERCENT,
      maxLeagueExposurePercent: HARD_MAX_LEAGUE_EXPOSURE_PERCENT
    }
  };
}

export const AUTONOMOUS_HARD_LIMITS = {
  maxStakePercent: HARD_MAX_STAKE_PERCENT,
  maxDailyExposurePercent: HARD_MAX_DAILY_EXPOSURE_PERCENT,
  maxLeagueExposurePercent: HARD_MAX_LEAGUE_EXPOSURE_PERCENT
};
