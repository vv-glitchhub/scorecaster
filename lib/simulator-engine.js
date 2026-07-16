function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value = "scorecaster") {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda, random) {
  const safeLambda = clamp(Number(lambda || 0), 0.05, 8);
  const threshold = Math.exp(-safeLambda);
  let product = 1;
  let count = 0;

  do {
    count += 1;
    product *= random();
  } while (product > threshold && count < 30);

  return Math.max(0, count - 1);
}

function confidenceInterval(probability, simulations) {
  const p = clamp(Number(probability || 0), 0, 1);
  const n = Math.max(1, Number(simulations || 1));
  const margin = 1.96 * Math.sqrt((p * (1 - p)) / n);
  return {
    low: clamp(p - margin, 0, 1),
    high: clamp(p + margin, 0, 1),
    margin
  };
}

function expectedGoals(homeRating, awayRating, homeAdvantage) {
  const home = clamp(Number(homeRating || 55), 0, 100);
  const away = clamp(Number(awayRating || 55), 0, 100);
  const advantage = clamp(Number(homeAdvantage || 0), -15, 15);
  const difference = home - away;

  return {
    home: clamp(1.35 + (difference / 32) + (advantage / 20), 0.2, 4.5),
    away: clamp(1.15 - (difference / 38), 0.2, 4.2)
  };
}

export function simulateMatch({
  homeTeam,
  awayTeam,
  homeRating = 55,
  awayRating = 50,
  homeAdvantage = 3,
  simulations = 10000,
  seed
}) {
  const safeSimulations = Math.round(clamp(Number(simulations || 10000), 1000, 100000));
  const resolvedSeed = seed === undefined || seed === null || seed === ""
    ? `${homeTeam}|${awayTeam}|${homeRating}|${awayRating}|${homeAdvantage}|${safeSimulations}`
    : String(seed);
  const random = mulberry32(hashSeed(resolvedSeed));
  const goals = expectedGoals(homeRating, awayRating, homeAdvantage);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalHomeScore = 0;
  let totalAwayScore = 0;

  for (let i = 0; i < safeSimulations; i += 1) {
    const homeScore = poisson(goals.home, random);
    const awayScore = poisson(goals.away, random);

    totalHomeScore += homeScore;
    totalAwayScore += awayScore;

    if (homeScore > awayScore) homeWins += 1;
    else if (awayScore > homeScore) awayWins += 1;
    else draws += 1;
  }

  const homeWinProbability = homeWins / safeSimulations;
  const awayWinProbability = awayWins / safeSimulations;
  const drawProbability = draws / safeSimulations;

  return {
    homeTeam,
    awayTeam,
    simulations: safeSimulations,
    seed: resolvedSeed,
    homeWinProbability,
    awayWinProbability,
    drawProbability,
    homeWinInterval: confidenceInterval(homeWinProbability, safeSimulations),
    drawInterval: confidenceInterval(drawProbability, safeSimulations),
    awayWinInterval: confidenceInterval(awayWinProbability, safeSimulations),
    averageHomeScore: totalHomeScore / safeSimulations,
    averageAwayScore: totalAwayScore / safeSimulations,
    projectedTotal: (totalHomeScore + totalAwayScore) / safeSimulations,
    expectedHomeGoals: goals.home,
    expectedAwayGoals: goals.away,
    upsetRisk:
      Number(homeRating) + Number(homeAdvantage) >= Number(awayRating)
        ? awayWinProbability
        : homeWinProbability,
    modelMode: "seeded-poisson-rating-simulation",
    reproducible: true
  };
}

export function compareToMarket(modelProbability, decimalOdds) {
  const marketProbability = decimalOdds > 1 ? 1 / decimalOdds : 0;
  const edge = modelProbability - marketProbability;

  return {
    modelProbability,
    marketProbability,
    edge
  };
}

export function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}
