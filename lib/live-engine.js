function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safe(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function calculateMomentum(match = {}) {
  const stats = match.liveStats || {};

  const homeShots = safe(stats.homeShots, Math.random() * 25);
  const awayShots = safe(stats.awayShots, Math.random() * 25);

  const homePressure = safe(stats.homePressure, Math.random());
  const awayPressure = safe(stats.awayPressure, Math.random());

  const homePossession = safe(stats.homePossession, 50);
  const awayPossession = safe(stats.awayPossession, 50);

  const homeScore = safe(stats.homeScore, 0);
  const awayScore = safe(stats.awayScore, 0);

  const homeMomentum =
    homeShots * 0.25 +
    homePressure * 25 +
    homePossession * 0.15 +
    homeScore * 8;

  const awayMomentum =
    awayShots * 0.25 +
    awayPressure * 25 +
    awayPossession * 0.15 +
    awayScore * 8;

  const total = homeMomentum + awayMomentum || 1;

  return {
    home: clamp(homeMomentum / total, 0, 1),
    away: clamp(awayMomentum / total, 0, 1),
    diff: homeMomentum - awayMomentum,
    summary:
      homeMomentum > awayMomentum
        ? `${match.home_team} momentum`
        : `${match.away_team} momentum`,
  };
}

export function calculateLiveWinProbability(match = {}) {
  const momentum = calculateMomentum(match);

  const scoreDiff =
    safe(match.liveStats?.homeScore, 0) -
    safe(match.liveStats?.awayScore, 0);

  const time = safe(match.liveStats?.minute, 50);

  let homeProbability =
    0.5 +
    momentum.diff * 0.005 +
    scoreDiff * 0.12;

  if (time > 75) {
    homeProbability += scoreDiff * 0.08;
  }

  homeProbability = clamp(homeProbability, 0.02, 0.98);

  return {
    home: homeProbability,
    away: 1 - homeProbability,
    momentum,
  };
}

export function calculateCashoutValue(bet = {}) {
  const currentOdds = safe(bet.currentOdds, bet.odds);
  const originalOdds = safe(bet.odds);

  const impliedNow = 1 / currentOdds;
  const impliedBefore = 1 / originalOdds;

  const edge = impliedNow - impliedBefore;

  if (edge > 0.08) {
    return {
      action: "HOLD",
      reason: "Bet value has improved significantly.",
    };
  }

  if (edge < -0.08) {
    return {
      action: "CASHOUT",
      reason: "Market moved strongly against the position.",
    };
  }

  return {
    action: "NEUTRAL",
    reason: "No major edge change detected.",
  };
}
