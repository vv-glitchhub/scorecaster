const MODEL_VERSION = "scorecaster-transparent-1x2-baseline-v1";
const MAX_GOALS = 10;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;

function normalizePercentMetric(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number >= -1 && number <= 1) return clamp(50 + (number * 50), 0, 100);
  return clamp(number, 0, 100);
}

function factorial(number) {
  let result = 1;
  for (let index = 2; index <= number; index += 1) result *= index;
  return result;
}

function poissonProbability(lambda, goals) {
  return Math.exp(-lambda) * (lambda ** goals) / factorial(goals);
}

function normalizeThree(home, draw, away) {
  const total = home + draw + away;
  if (!Number.isFinite(total) || total <= 0) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };
  return { home: home / total, draw: draw / total, away: away / total };
}

function teamProfile(input = {}, role = "team") {
  const rating = finite(input.rating ?? input.elo ?? input.power_rating);
  const attack = normalizePercentMetric(input.attack ?? input.attack_rating);
  const defense = normalizePercentMetric(input.defense ?? input.defence ?? input.defense_rating);
  const form = normalizePercentMetric(input.form ?? input.form_rating);
  const name = String(input.team ?? input.name ?? role).trim().slice(0, 120);
  const missing = [];
  if (rating === null) missing.push(`${role}.rating`);
  if (attack === null) missing.push(`${role}.attack`);
  if (defense === null) missing.push(`${role}.defense`);
  if (form === null) missing.push(`${role}.form`);
  return { name, rating, attack, defense, form, missing };
}

function eloDavidson(home, away, options) {
  const homeAdvantageElo = options.neutralVenue ? 0 : options.homeAdvantageElo;
  const homeStrength = 10 ** ((home.rating + homeAdvantageElo - away.rating) / 400);
  const awayStrength = 1;
  const drawStrength = options.drawParameter * Math.sqrt(homeStrength * awayStrength);
  const probabilities = normalizeThree(homeStrength, drawStrength, awayStrength);
  return {
    probabilities,
    homeAdvantageElo,
    ratingDifference: home.rating + homeAdvantageElo - away.rating,
    drawParameter: options.drawParameter
  };
}

function expectedGoals(home, away, options) {
  const homeAttack = (home.attack - 50) / 50;
  const awayAttack = (away.attack - 50) / 50;
  const homeDefenseWeakness = (50 - home.defense) / 50;
  const awayDefenseWeakness = (50 - away.defense) / 50;
  const homeForm = (home.form - 50) / 50;
  const awayForm = (away.form - 50) / 50;
  const venueGoalBoost = options.neutralVenue ? 0 : options.homeGoalLogBoost;

  const homeLambda = clamp(
    options.leagueHomeGoals * Math.exp(
      options.attackWeight * homeAttack +
      options.defenseWeight * awayDefenseWeakness +
      options.formWeight * (homeForm - awayForm) +
      venueGoalBoost
    ),
    0.2,
    4.5
  );
  const awayLambda = clamp(
    options.leagueAwayGoals * Math.exp(
      options.attackWeight * awayAttack +
      options.defenseWeight * homeDefenseWeakness +
      options.formWeight * (awayForm - homeForm)
    ),
    0.2,
    4.5
  );

  return {
    home: homeLambda,
    away: awayLambda,
    components: {
      homeAttack,
      awayAttack,
      homeDefenseWeakness,
      awayDefenseWeakness,
      homeForm,
      awayForm,
      venueGoalBoost
    }
  };
}

function poissonMatrix(homeLambda, awayLambda) {
  const scorelines = [];
  let home = 0;
  let draw = 0;
  let away = 0;
  let coveredMass = 0;

  for (let homeGoals = 0; homeGoals <= MAX_GOALS; homeGoals += 1) {
    const homeProbability = poissonProbability(homeLambda, homeGoals);
    for (let awayGoals = 0; awayGoals <= MAX_GOALS; awayGoals += 1) {
      const probability = homeProbability * poissonProbability(awayLambda, awayGoals);
      coveredMass += probability;
      if (homeGoals > awayGoals) home += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else away += probability;
      scorelines.push({ homeGoals, awayGoals, probability });
    }
  }

  const probabilities = normalizeThree(home, draw, away);
  const topScorelines = scorelines
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 8)
    .map((row) => ({ ...row, probability: round(row.probability) }));

  return { probabilities, topScorelines, coveredMass: round(coveredMass) };
}

function noVigMarket(odds = {}) {
  const homeOdds = finite(odds.home);
  const drawOdds = finite(odds.draw);
  const awayOdds = finite(odds.away);
  if (![homeOdds, drawOdds, awayOdds].every((value) => value !== null && value > 1)) return null;
  const raw = { home: 1 / homeOdds, draw: 1 / drawOdds, away: 1 / awayOdds };
  const probabilities = normalizeThree(raw.home, raw.draw, raw.away);
  return {
    odds: { home: homeOdds, draw: drawOdds, away: awayOdds },
    rawImplied: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, round(value)])),
    overround: round(raw.home + raw.draw + raw.away - 1),
    probabilities: Object.fromEntries(Object.entries(probabilities).map(([key, value]) => [key, round(value)]))
  };
}

function evidenceConfidence(home, away, trainingEvidence = {}) {
  const required = [home.rating, home.attack, home.defense, home.form, away.rating, away.attack, away.defense, away.form];
  const completeness = required.filter((value) => value !== null).length / required.length;
  const sampleScore = clamp(finite(trainingEvidence.sampleScore) ?? 0, 0, 1);
  const calibrationScore = clamp(finite(trainingEvidence.calibrationScore) ?? 0, 0, 1);
  const confidence = clamp(0.65 * completeness + 0.2 * sampleScore + 0.15 * calibrationScore, 0, 0.95);
  return { completeness, sampleScore, calibrationScore, confidence };
}

function probabilityBand(probability, confidence) {
  const halfWidth = 0.035 + (1 - confidence) * 0.115;
  return {
    low: round(clamp(probability - halfWidth, 0.01, 0.98)),
    high: round(clamp(probability + halfWidth, 0.02, 0.99)),
    method: "evidence-quality heuristic band; not a fitted statistical confidence interval"
  };
}

export function buildTransparent1X2(input = {}, configuration = {}) {
  const home = teamProfile(input.homeTeam, "home");
  const away = teamProfile(input.awayTeam, "away");
  const missingInputs = [...home.missing, ...away.missing];
  const options = {
    neutralVenue: Boolean(input.neutralVenue),
    homeAdvantageElo: finite(configuration.homeAdvantageElo) ?? 55,
    drawParameter: finite(configuration.drawParameter) ?? 0.62,
    leagueHomeGoals: finite(configuration.leagueHomeGoals) ?? 1.45,
    leagueAwayGoals: finite(configuration.leagueAwayGoals) ?? 1.15,
    attackWeight: finite(configuration.attackWeight) ?? 0.32,
    defenseWeight: finite(configuration.defenseWeight) ?? 0.26,
    formWeight: finite(configuration.formWeight) ?? 0.10,
    homeGoalLogBoost: finite(configuration.homeGoalLogBoost) ?? 0.08,
    eloWeight: finite(configuration.eloWeight) ?? 0.45,
    poissonWeight: finite(configuration.poissonWeight) ?? 0.55
  };

  if (missingInputs.length) {
    return {
      ok: false,
      modelVersion: MODEL_VERSION,
      reason: "missing-required-inputs",
      missingInputs,
      paperOnly: true,
      calibrated: false
    };
  }

  const elo = eloDavidson(home, away, options);
  const lambdas = expectedGoals(home, away, options);
  const poisson = poissonMatrix(lambdas.home, lambdas.away);
  const ensemble = normalizeThree(
    options.eloWeight * elo.probabilities.home + options.poissonWeight * poisson.probabilities.home,
    options.eloWeight * elo.probabilities.draw + options.poissonWeight * poisson.probabilities.draw,
    options.eloWeight * elo.probabilities.away + options.poissonWeight * poisson.probabilities.away
  );
  const confidence = evidenceConfidence(home, away, input.trainingEvidence);
  const market = noVigMarket(input.marketOdds);
  const probabilities = Object.fromEntries(Object.entries(ensemble).map(([key, value]) => [key, round(value)]));
  const fairOdds = Object.fromEntries(Object.entries(probabilities).map(([key, value]) => [key, round(1 / value, 3)]));
  const probabilityBands = Object.fromEntries(Object.entries(probabilities).map(([key, value]) => [key, probabilityBand(value, confidence.confidence)]));
  const marketEdges = market
    ? Object.fromEntries(Object.keys(probabilities).map((key) => [key, round(probabilities[key] - market.probabilities[key])]))
    : null;

  return {
    ok: true,
    modelVersion: MODEL_VERSION,
    generatedAt: new Date(input.generatedAt || Date.now()).toISOString(),
    modelStatus: "transparent-baseline-not-yet-league-calibrated",
    calibrated: false,
    decisionAuthority: "observation-only; cannot independently promote PLAY",
    paperOnly: true,
    teams: { home: home.name, away: away.name },
    probabilities,
    probabilityBands,
    fairOdds,
    expectedGoals: { home: round(lambdas.home, 3), away: round(lambdas.away, 3) },
    mostLikelyScorelines: poisson.topScorelines,
    components: {
      eloDavidson: {
        weight: options.eloWeight,
        probabilities: Object.fromEntries(Object.entries(elo.probabilities).map(([key, value]) => [key, round(value)])),
        ratingDifference: round(elo.ratingDifference, 2),
        homeAdvantageElo: elo.homeAdvantageElo,
        drawParameter: elo.drawParameter
      },
      poisson: {
        weight: options.poissonWeight,
        probabilities: Object.fromEntries(Object.entries(poisson.probabilities).map(([key, value]) => [key, round(value)])),
        coveredProbabilityMass: poisson.coveredMass
      },
      evidenceQuality: {
        completeness: round(confidence.completeness),
        sampleScore: round(confidence.sampleScore),
        calibrationScore: round(confidence.calibrationScore),
        confidence: round(confidence.confidence)
      }
    },
    contributions: [
      { id: "rating-difference", value: round(elo.ratingDifference, 2), unit: "Elo points", direction: elo.ratingDifference >= 0 ? "home" : "away" },
      { id: "home-attack-vs-away-defense", value: round(lambdas.components.homeAttack + lambdas.components.awayDefenseWeakness), direction: lambdas.components.homeAttack + lambdas.components.awayDefenseWeakness >= 0 ? "home" : "away" },
      { id: "away-attack-vs-home-defense", value: round(lambdas.components.awayAttack + lambdas.components.homeDefenseWeakness), direction: lambdas.components.awayAttack + lambdas.components.homeDefenseWeakness >= 0 ? "away" : "home" },
      { id: "form-difference", value: round(lambdas.components.homeForm - lambdas.components.awayForm), direction: lambdas.components.homeForm - lambdas.components.awayForm >= 0 ? "home" : "away" },
      { id: "venue", value: options.neutralVenue ? 0 : options.homeAdvantageElo, unit: "Elo points", direction: options.neutralVenue ? "neutral" : "home" }
    ],
    marketBenchmark: market,
    marketEdges,
    inputs: {
      home: { rating: home.rating, attack: home.attack, defense: home.defense, form: home.form },
      away: { rating: away.rating, attack: away.attack, defense: away.defense, form: away.form },
      neutralVenue: options.neutralVenue,
      trainingEvidence: {
        sampleScore: confidence.sampleScore,
        calibrationScore: confidence.calibrationScore
      }
    },
    formulas: [
      "Elo strength: q_home = 10^((R_home + H - R_away) / 400)",
      "Davidson draw strength: q_draw = nu × sqrt(q_home × q_away)",
      "Poisson: P(X=k) = exp(-lambda) × lambda^k / k!",
      "Expected goals: lambda = league_average × exp(weighted attack, opposing defence, form and venue terms)",
      "Ensemble: p = 0.45 × p_Elo-Davidson + 0.55 × p_Poisson",
      "Fair odds: decimal_fair_odds = 1 / p_model",
      "No-vig market probability: (1 / odds_i) / sum_j(1 / odds_j)"
    ],
    limitations: [
      "Baseline weights are documented defaults and have not yet passed league-specific chronological calibration.",
      "The evidence band is a heuristic display band, not a fitted statistical confidence interval.",
      "Lineups, injuries, travel, weather and referee context are not included until verified context sources are activated.",
      "Closing prices and future information are excluded from pre-match inputs."
    ]
  };
}

export { MODEL_VERSION as TRANSPARENT_1X2_MODEL_VERSION };
