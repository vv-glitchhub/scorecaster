export const DIXON_COLES_1X2_VERSION = "scorecaster-dixon-coles-1x2-challenger-v1";

const MAX_GOALS = 10;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;

function factorial(number) {
  let result = 1;
  for (let index = 2; index <= number; index += 1) result *= index;
  return result;
}

function poisson(lambda, goals) {
  return Math.exp(-lambda) * (lambda ** goals) / factorial(goals);
}

function tau(homeGoals, awayGoals, homeLambda, awayLambda, rho) {
  if (homeGoals === 0 && awayGoals === 0) return 1 - (homeLambda * awayLambda * rho);
  if (homeGoals === 0 && awayGoals === 1) return 1 + (homeLambda * rho);
  if (homeGoals === 1 && awayGoals === 0) return 1 + (awayLambda * rho);
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function normalizeThree(home, draw, away) {
  const total = home + draw + away;
  if (!Number.isFinite(total) || total <= 0) return null;
  return { home: home / total, draw: draw / total, away: away / total };
}

export function buildDixonColes1X2({ homeLambda, awayLambda, rho = 0 } = {}) {
  const homeExpected = Number(homeLambda);
  const awayExpected = Number(awayLambda);
  const correction = clamp(Number(rho) || 0, -0.25, 0.25);
  if (!Number.isFinite(homeExpected) || !Number.isFinite(awayExpected) || homeExpected <= 0 || awayExpected <= 0) {
    return {
      ok: false,
      version: DIXON_COLES_1X2_VERSION,
      reason: "invalid-expected-goals",
      paperOnly: true
    };
  }

  const scorelines = [];
  let baseMass = 0;
  let adjustedMass = 0;
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
      const baseProbability = poisson(homeExpected, homeGoals) * poisson(awayExpected, awayGoals);
      const lowScoreFactor = Math.max(0, tau(homeGoals, awayGoals, homeExpected, awayExpected, correction));
      const adjustedProbability = baseProbability * lowScoreFactor;
      baseMass += baseProbability;
      adjustedMass += adjustedProbability;
      if (homeGoals > awayGoals) home += adjustedProbability;
      else if (homeGoals === awayGoals) draw += adjustedProbability;
      else away += adjustedProbability;
      scorelines.push({ homeGoals, awayGoals, baseProbability, adjustedProbability, lowScoreFactor });
    }
  }

  const probabilities = normalizeThree(home, draw, away);
  if (!probabilities || adjustedMass <= 0) {
    return {
      ok: false,
      version: DIXON_COLES_1X2_VERSION,
      reason: "invalid-adjusted-mass",
      paperOnly: true
    };
  }

  const topScorelines = scorelines
    .map((row) => ({
      homeGoals: row.homeGoals,
      awayGoals: row.awayGoals,
      probability: row.adjustedProbability / adjustedMass,
      lowScoreFactor: row.lowScoreFactor
    }))
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 8)
    .map((row) => ({ ...row, probability: round(row.probability), lowScoreFactor: round(row.lowScoreFactor) }));

  return {
    ok: true,
    version: DIXON_COLES_1X2_VERSION,
    role: "challenger-scoreline-model",
    rho: correction,
    correctionApplied: Math.abs(correction) > 1e-12,
    expectedGoals: { home: round(homeExpected, 4), away: round(awayExpected, 4) },
    probabilities: Object.fromEntries(Object.entries(probabilities).map(([key, value]) => [key, round(value)])),
    mostLikelyScorelines: topScorelines,
    diagnostics: {
      baseCoveredMass: round(baseMass),
      adjustedMassBeforeNormalization: round(adjustedMass),
      maxGoals: MAX_GOALS
    },
    formula: {
      base: "P(X=x,Y=y) = Poisson(lambda_home,x) * Poisson(lambda_away,y)",
      correction: "P_DC(x,y) proportional to tau(x,y,lambda_home,lambda_away,rho) * P(X=x,Y=y)",
      lowScores: {
        "0-0": "1 - lambda_home * lambda_away * rho",
        "0-1": "1 + lambda_home * rho",
        "1-0": "1 + lambda_away * rho",
        "1-1": "1 - rho"
      }
    },
    calibrationBoundary: "rho must come from chronology-safe validation before it can influence the production ensemble",
    canPromotePlayByItself: false,
    realMoneyExecution: false,
    paperOnly: true
  };
}
