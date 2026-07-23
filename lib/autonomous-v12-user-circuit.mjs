function finite(value, fallback = 0) {
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
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
}

function profit(row = {}) {
  const stake = Math.max(0, finite(row.stake));
  const odds = Math.max(1.01, finite(row.odds, 1.01));
  const status = String(row.status || "").toLowerCase();
  if (status === "won" || status === "win") return stake * (odds - 1);
  if (status === "lost" || status === "loss") return -stake;
  return 0;
}

export function applyAutonomousV12UserCircuitControls({
  circuit = {},
  controls = {},
  learning = {},
  bankroll = {},
  todayRows = []
} = {}) {
  const reasons = new Set(Array.isArray(circuit.reasons) ? circuit.reasons : []);
  const warnings = new Set(Array.isArray(circuit.warnings) ? circuit.warnings : []);

  // These thresholds are user-owned. Remove default-engine versions and rebuild them
  // from the persisted controls so both stricter and looser allowed values are honored.
  for (const reason of ["daily_loss_stop", "drawdown_stop", "loss_streak_stop"]) reasons.delete(reason);
  for (const warning of ["daily_loss_watch", "drawdown_watch", "loss_streak_watch"]) warnings.delete(warning);

  const bankrollValue = Math.max(1, finite(bankroll.bankroll, 1000));
  const dailyProfit = todayRows.reduce((sum, row) => sum + profit(row), 0);
  const dailyLossRate = dailyProfit < 0 ? Math.abs(dailyProfit) / bankrollValue : 0;
  const drawdownRate = Math.max(0, finite(learning.performance?.maxDrawdown)) / bankrollValue;
  const losingStreak = Math.max(0, Math.trunc(finite(learning.performance?.currentLosingStreak)));
  const dailyLossStopRate = clamp(finite(controls.max_daily_loss_percent, 4) / 100, 0.005, 0.1);
  const drawdownStopRate = clamp(finite(controls.max_drawdown_percent, 15) / 100, 0.02, 0.3);
  const lossStreakStop = Math.max(3, Math.min(20, Math.trunc(finite(controls.max_loss_streak, 10))));

  if (dailyLossRate >= dailyLossStopRate) reasons.add("daily_loss_stop");
  if (drawdownRate >= drawdownStopRate) reasons.add("drawdown_stop");
  if (losingStreak >= lossStreakStop) reasons.add("loss_streak_stop");

  if (dailyLossRate >= dailyLossStopRate * 0.5 && dailyLossRate < dailyLossStopRate) warnings.add("daily_loss_watch");
  if (drawdownRate >= drawdownStopRate * 0.7 && drawdownRate < drawdownStopRate) warnings.add("drawdown_watch");
  if (losingStreak >= Math.max(2, lossStreakStop - 2) && losingStreak < lossStreakStop) warnings.add("loss_streak_watch");

  // Autonomous operation requires verifiable provider, market-freshness and capture metrics.
  // Null is not treated as healthy; it pauses the paper agent until the health layer recovers.
  const providerScore = optionalFinite(circuit.metrics?.providerScore);
  const staleRate = optionalFinite(circuit.metrics?.staleRate);
  const captureAgeMinutes = optionalFinite(circuit.metrics?.captureAgeMinutes);
  if (providerScore === null) reasons.add("provider_health_unverified");
  if (staleRate === null) reasons.add("market_freshness_unverified");
  if (captureAgeMinutes === null) reasons.add("unified_data_freshness_unverified");

  const nextReasons = [...reasons];
  const nextWarnings = [...warnings];
  return {
    ...circuit,
    paused: nextReasons.length > 0,
    state: nextReasons.length ? "PAUSED" : nextWarnings.length ? "CAUTION" : "RUNNING",
    reasons: nextReasons,
    warnings: nextWarnings,
    metrics: {
      ...(circuit.metrics || {}),
      dailyProfit: round(dailyProfit, 2),
      dailyLossRate: round(dailyLossRate, 4),
      drawdownRate: round(drawdownRate, 4),
      currentLosingStreak: losingStreak,
      healthVerified: providerScore !== null && staleRate !== null && captureAgeMinutes !== null,
      userLimits: {
        dailyLossStopRate: round(dailyLossStopRate, 4),
        drawdownStopRate: round(drawdownStopRate, 4),
        lossStreakStop
      }
    }
  };
}
