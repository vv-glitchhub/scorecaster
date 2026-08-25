export const FOOTBALL_ML_CHALLENGER_VERSION = "scorecaster-football-ml-challenger-v1";
export const FOOTBALL_ML_MODEL_FAMILY = "multiclass-gradient-boosted-regression-trees";

const CLASSES = ["home", "draw", "away"];
const EPS = 1e-12;

function finite(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function round(value, digits = 6) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function mean(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function varianceSse(values = []) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0);
}

function softmax(logits = []) {
  const max = Math.max(...logits);
  const exp = logits.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0) || 1;
  return exp.map((value) => value / total);
}

function classIndex(outcome) {
  return Math.max(0, CLASSES.indexOf(outcome));
}

function outcomeFromRow(row = {}) {
  const home = finite(row.homeGoals);
  const away = finite(row.awayGoals);
  if (home === null || away === null) return null;
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

function noVig(odds = {}) {
  const raw = [finite(odds.home), finite(odds.draw), finite(odds.away)];
  if (raw.some((value) => value === null || value <= 1)) return null;
  const implied = raw.map((value) => 1 / value);
  const total = implied.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return null;
  return { home: implied[0] / total, draw: implied[1] / total, away: implied[2] / total };
}

function poissonProbability(goals, lambda) {
  let factorial = 1;
  for (let index = 2; index <= goals; index += 1) factorial *= index;
  return Math.exp(-lambda) * (lambda ** goals) / factorial;
}

function poissonThreeWay(homeLambda, awayLambda, maxGoals = 10) {
  const homeExpected = clamp(homeLambda, 0.08, 5);
  const awayExpected = clamp(awayLambda, 0.08, 5);
  const probabilities = { home: 0, draw: 0, away: 0 };
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const joint = poissonProbability(homeGoals, homeExpected) * poissonProbability(awayGoals, awayExpected);
      if (homeGoals > awayGoals) probabilities.home += joint;
      else if (homeGoals < awayGoals) probabilities.away += joint;
      else probabilities.draw += joint;
    }
  }
  const total = probabilities.home + probabilities.draw + probabilities.away;
  return Object.fromEntries(CLASSES.map((key) => [key, probabilities[key] / total]));
}

function ewma(current, value, alpha, count) {
  return count <= 0 ? value : alpha * value + (1 - alpha) * current;
}

function teamState(states, name, priors) {
  const key = String(name || "").toLowerCase().trim();
  if (!states.has(key)) {
    states.set(key, {
      matches: 0,
      xgf: priors.xg,
      xga: priors.xg,
      gf: priors.goals,
      ga: priors.goals,
      shotsFor: priors.shots,
      shotsAgainst: priors.shots,
      lastDate: null
    });
  }
  return states.get(key);
}

function daysBetween(left, right) {
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 7;
  return clamp((b - a) / 86_400_000, 1, 30);
}

function shrink(value, matches, prior, priorMatches = 5) {
  const weight = matches / (matches + priorMatches);
  return weight * value + (1 - weight) * prior;
}

function updateState(state, { xgf, xga, gf, ga, shotsFor, shotsAgainst, date }, alpha) {
  state.xgf = ewma(state.xgf, xgf, alpha, state.matches);
  state.xga = ewma(state.xga, xga, alpha, state.matches);
  state.gf = ewma(state.gf, gf, alpha, state.matches);
  state.ga = ewma(state.ga, ga, alpha, state.matches);
  state.shotsFor = ewma(state.shotsFor, shotsFor, alpha, state.matches);
  state.shotsAgainst = ewma(state.shotsAgainst, shotsAgainst, alpha, state.matches);
  state.matches += 1;
  state.lastDate = date;
}

export const FOOTBALL_ML_FEATURES = [
  "home_xgf", "home_xga", "away_xgf", "away_xga",
  "home_xg_diff", "away_xg_diff", "xg_matchup_advantage",
  "home_gf", "home_ga", "away_gf", "away_ga",
  "home_goal_diff", "away_goal_diff", "goal_matchup_advantage",
  "home_shots_for", "home_shots_against", "away_shots_for", "away_shots_against",
  "home_shot_quality", "away_shot_quality", "shot_quality_advantage",
  "home_rest_days", "away_rest_days", "rest_advantage",
  "home_experience", "away_experience",
  "poisson_home", "poisson_draw", "poisson_away"
];

export function buildFootballMlFeatureDataset(rows = [], options = {}) {
  const alpha = clamp(finite(options.ewmaAlpha, 0.22), 0.05, 0.8);
  const priorMatches = Math.max(1, Math.floor(finite(options.priorMatches, 5)));
  const sorted = [...rows]
    .filter((row) => row?.date && outcomeFromRow(row) && noVig(row.marketOdds))
    .sort((left, right) => {
      const date = String(left.date).localeCompare(String(right.date));
      return date || finite(left.matchId, 0) - finite(right.matchId, 0);
    });
  const priors = { xg: 1.35, goals: 1.3, shots: 12 };
  const states = new Map();
  const dataset = [];

  for (const row of sorted) {
    const home = teamState(states, row.homeTeam, priors);
    const away = teamState(states, row.awayTeam, priors);
    const hxgf = shrink(home.xgf, home.matches, priors.xg, priorMatches);
    const hxga = shrink(home.xga, home.matches, priors.xg, priorMatches);
    const axgf = shrink(away.xgf, away.matches, priors.xg, priorMatches);
    const axga = shrink(away.xga, away.matches, priors.xg, priorMatches);
    const hgf = shrink(home.gf, home.matches, priors.goals, priorMatches);
    const hga = shrink(home.ga, home.matches, priors.goals, priorMatches);
    const agf = shrink(away.gf, away.matches, priors.goals, priorMatches);
    const aga = shrink(away.ga, away.matches, priors.goals, priorMatches);
    const hsf = shrink(home.shotsFor, home.matches, priors.shots, priorMatches);
    const hsa = shrink(home.shotsAgainst, home.matches, priors.shots, priorMatches);
    const asf = shrink(away.shotsFor, away.matches, priors.shots, priorMatches);
    const asa = shrink(away.shotsAgainst, away.matches, priors.shots, priorMatches);
    const homeRest = home.lastDate ? daysBetween(home.lastDate, row.date) : 7;
    const awayRest = away.lastDate ? daysBetween(away.lastDate, row.date) : 7;
    const homeLambda = clamp(Math.sqrt(Math.max(EPS, hxgf * axga)) * 1.10, 0.1, 4.5);
    const awayLambda = clamp(Math.sqrt(Math.max(EPS, axgf * hxga)) * 0.92, 0.1, 4.2);
    const poisson = poissonThreeWay(homeLambda, awayLambda);
    const values = {
      home_xgf: hxgf,
      home_xga: hxga,
      away_xgf: axgf,
      away_xga: axga,
      home_xg_diff: hxgf - hxga,
      away_xg_diff: axgf - axga,
      xg_matchup_advantage: (hxgf - axga) - (axgf - hxga),
      home_gf: hgf,
      home_ga: hga,
      away_gf: agf,
      away_ga: aga,
      home_goal_diff: hgf - hga,
      away_goal_diff: agf - aga,
      goal_matchup_advantage: (hgf - aga) - (agf - hga),
      home_shots_for: hsf,
      home_shots_against: hsa,
      away_shots_for: asf,
      away_shots_against: asa,
      home_shot_quality: hxgf / Math.max(1, hsf),
      away_shot_quality: axgf / Math.max(1, asf),
      shot_quality_advantage: hxgf / Math.max(1, hsf) - axgf / Math.max(1, asf),
      home_rest_days: homeRest,
      away_rest_days: awayRest,
      rest_advantage: homeRest - awayRest,
      home_experience: Math.log1p(home.matches),
      away_experience: Math.log1p(away.matches),
      poisson_home: poisson.home,
      poisson_draw: poisson.draw,
      poisson_away: poisson.away
    };
    dataset.push({
      matchId: row.matchId,
      date: row.date,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      outcome: outcomeFromRow(row),
      features: FOOTBALL_ML_FEATURES.map((name) => finite(values[name], 0)),
      featureMap: Object.fromEntries(FOOTBALL_ML_FEATURES.map((name) => [name, finite(values[name], 0)])),
      market: noVig(row.marketOdds),
      poisson,
      chronology: {
        featureCutoff: row.date,
        homeHistoryMatches: home.matches,
        awayHistoryMatches: away.matches,
        currentMatchInputsUsed: false
      }
    });

    const totalShots = Math.max(2, finite(row.shots, 24));
    const homeShare = finite(row.homeXg, 1.35) / Math.max(EPS, finite(row.homeXg, 1.35) + finite(row.awayXg, 1.35));
    const homeShots = Math.max(1, finite(row.homeShots, totalShots * homeShare));
    const awayShots = Math.max(1, finite(row.awayShots, totalShots - homeShots));
    updateState(home, {
      xgf: finite(row.homeXg, priors.xg), xga: finite(row.awayXg, priors.xg),
      gf: finite(row.homeGoals, priors.goals), ga: finite(row.awayGoals, priors.goals),
      shotsFor: homeShots, shotsAgainst: awayShots, date: row.date
    }, alpha);
    updateState(away, {
      xgf: finite(row.awayXg, priors.xg), xga: finite(row.homeXg, priors.xg),
      gf: finite(row.awayGoals, priors.goals), ga: finite(row.homeGoals, priors.goals),
      shotsFor: awayShots, shotsAgainst: homeShots, date: row.date
    }, alpha);
  }
  return dataset;
}

function candidateThresholds(values, maxBins) {
  const unique = [...new Set(values.filter(Number.isFinite))].sort((left, right) => left - right);
  if (unique.length <= 1) return [];
  if (unique.length <= maxBins + 1) return unique.slice(0, -1).map((value, index) => (value + unique[index + 1]) / 2);
  const thresholds = [];
  for (let bin = 1; bin <= maxBins; bin += 1) {
    const index = Math.floor((bin / (maxBins + 1)) * (unique.length - 1));
    if (index >= 0 && index < unique.length - 1) thresholds.push((unique[index] + unique[index + 1]) / 2);
  }
  return [...new Set(thresholds)];
}

function fitRegressionTree(rows, targets, indices, depth, params) {
  const values = indices.map((index) => targets[index]);
  const prediction = mean(values);
  if (depth >= params.maxDepth || indices.length < params.minLeaf * 2) {
    return { leaf: true, value: prediction, count: indices.length };
  }
  const parentSse = varianceSse(values);
  let best = null;
  for (let feature = 0; feature < FOOTBALL_ML_FEATURES.length; feature += 1) {
    const thresholds = candidateThresholds(indices.map((index) => rows[index].features[feature]), params.maxBins);
    for (const threshold of thresholds) {
      const left = [];
      const right = [];
      for (const index of indices) {
        if (rows[index].features[feature] <= threshold) left.push(index);
        else right.push(index);
      }
      if (left.length < params.minLeaf || right.length < params.minLeaf) continue;
      const gain = parentSse - varianceSse(left.map((index) => targets[index])) - varianceSse(right.map((index) => targets[index]));
      if (!best || gain > best.gain) best = { feature, threshold, left, right, gain };
    }
  }
  if (!best || best.gain <= params.minGain) return { leaf: true, value: prediction, count: indices.length };
  return {
    leaf: false,
    feature: best.feature,
    featureName: FOOTBALL_ML_FEATURES[best.feature],
    threshold: best.threshold,
    gain: best.gain,
    count: indices.length,
    left: fitRegressionTree(rows, targets, best.left, depth + 1, params),
    right: fitRegressionTree(rows, targets, best.right, depth + 1, params)
  };
}

function predictTree(tree, features) {
  let node = tree;
  while (node && node.leaf !== true) node = features[node.feature] <= node.threshold ? node.left : node.right;
  return finite(node?.value, 0);
}

function initialLogits(rows) {
  const counts = CLASSES.map((key) => Math.max(1, rows.filter((row) => row.outcome === key).length));
  const total = counts.reduce((sum, value) => sum + value, 0);
  return counts.map((count) => Math.log(count / total));
}

function applyRounds(baseLogits, rounds, features, learningRate) {
  const logits = [...baseLogits];
  for (const roundTrees of rounds) {
    for (let classIndexValue = 0; classIndexValue < CLASSES.length; classIndexValue += 1) {
      logits[classIndexValue] += learningRate * predictTree(roundTrees[classIndexValue], features);
    }
  }
  return logits;
}

function logLossFromLogits(rows, logitsRows, temperature = 1) {
  if (!rows.length) return null;
  return mean(rows.map((row, index) => {
    const probabilities = softmax(logitsRows[index].map((value) => value / temperature));
    return -Math.log(clamp(probabilities[classIndex(row.outcome)], 1e-9, 1));
  }));
}

export function trainFootballMlChallenger(trainRows = [], validationRows = [], options = {}) {
  if (trainRows.length < 60 || validationRows.length < 20) throw new Error("football-ml-insufficient-training-sample");
  const params = {
    learningRate: clamp(finite(options.learningRate, 0.06), 0.01, 0.3),
    maxDepth: clamp(Math.floor(finite(options.maxDepth, 2)), 1, 4),
    minLeaf: clamp(Math.floor(finite(options.minLeaf, 10)), 4, 40),
    maxBins: clamp(Math.floor(finite(options.maxBins, 12)), 4, 32),
    minGain: Math.max(1e-9, finite(options.minGain, 1e-5)),
    maxRounds: clamp(Math.floor(finite(options.maxRounds, 80)), 10, 200),
    earlyStoppingRounds: clamp(Math.floor(finite(options.earlyStoppingRounds, 12)), 3, 40)
  };
  const baseLogits = initialLogits(trainRows);
  const trainScores = trainRows.map(() => [...baseLogits]);
  const validationScores = validationRows.map(() => [...baseLogits]);
  const rounds = [];
  let bestValidation = Infinity;
  let bestRound = 0;
  let stale = 0;

  for (let roundIndex = 0; roundIndex < params.maxRounds; roundIndex += 1) {
    const probabilities = trainScores.map(softmax);
    const roundTrees = [];
    for (let classValue = 0; classValue < CLASSES.length; classValue += 1) {
      const residuals = trainRows.map((row, index) => (classIndex(row.outcome) === classValue ? 1 : 0) - probabilities[index][classValue]);
      const tree = fitRegressionTree(trainRows, residuals, trainRows.map((_, index) => index), 0, params);
      roundTrees.push(tree);
      for (let index = 0; index < trainRows.length; index += 1) trainScores[index][classValue] += params.learningRate * predictTree(tree, trainRows[index].features);
      for (let index = 0; index < validationRows.length; index += 1) validationScores[index][classValue] += params.learningRate * predictTree(tree, validationRows[index].features);
    }
    rounds.push(roundTrees);
    const validationLoss = logLossFromLogits(validationRows, validationScores, 1);
    if (validationLoss + 1e-8 < bestValidation) {
      bestValidation = validationLoss;
      bestRound = rounds.length;
      stale = 0;
    } else {
      stale += 1;
      if (stale >= params.earlyStoppingRounds) break;
    }
  }

  const bestRounds = rounds.slice(0, Math.max(1, bestRound));
  const validationLogits = validationRows.map((row) => applyRounds(baseLogits, bestRounds, row.features, params.learningRate));
  let bestTemperature = 1;
  let bestTemperatureLoss = Infinity;
  for (let step = 0; step <= 50; step += 1) {
    const temperature = 0.55 + step * 0.03;
    const loss = logLossFromLogits(validationRows, validationLogits, temperature);
    if (loss < bestTemperatureLoss) {
      bestTemperatureLoss = loss;
      bestTemperature = temperature;
    }
  }

  const importance = Object.fromEntries(FOOTBALL_ML_FEATURES.map((name) => [name, 0]));
  const visit = (node) => {
    if (!node || node.leaf) return;
    importance[node.featureName] += Math.max(0, finite(node.gain, 0));
    visit(node.left);
    visit(node.right);
  };
  bestRounds.flat().forEach(visit);
  const importanceTotal = Object.values(importance).reduce((sum, value) => sum + value, 0) || 1;
  const featureImportance = Object.entries(importance)
    .map(([feature, gain]) => ({ feature, gain: round(gain), share: round(gain / importanceTotal) }))
    .sort((left, right) => right.gain - left.gain);

  return {
    version: FOOTBALL_ML_CHALLENGER_VERSION,
    family: FOOTBALL_ML_MODEL_FAMILY,
    classes: CLASSES,
    featureNames: FOOTBALL_ML_FEATURES,
    baseLogits,
    rounds: bestRounds,
    learningRate: params.learningRate,
    temperature: round(bestTemperature, 4),
    params,
    training: {
      trainRows: trainRows.length,
      validationRows: validationRows.length,
      selectedRounds: bestRounds.length,
      bestValidationLogLoss: round(bestValidation),
      calibratedValidationLogLoss: round(bestTemperatureLoss)
    },
    featureImportance,
    safety: {
      researchOnly: true,
      productionProbabilityChanged: false,
      productionPlayUpgradeAllowed: false,
      marketFeaturesUsedByIndependentMl: false
    }
  };
}

export function predictFootballMlChallenger(model, featureRow) {
  if (!model || model.version !== FOOTBALL_ML_CHALLENGER_VERSION) throw new Error("football-ml-model-version-mismatch");
  const features = Array.isArray(featureRow) ? featureRow : model.featureNames.map((name) => finite(featureRow?.[name], 0));
  const logits = applyRounds(model.baseLogits, model.rounds, features, model.learningRate);
  const values = softmax(logits.map((value) => value / Math.max(0.2, finite(model.temperature, 1))));
  return { home: values[0], draw: values[1], away: values[2], logits };
}

function metricBrier(probabilities, outcome) {
  return CLASSES.reduce((sum, key) => sum + (probabilities[key] - (outcome === key ? 1 : 0)) ** 2, 0);
}

function metricLogLoss(probabilities, outcome) {
  return -Math.log(clamp(probabilities[outcome], 1e-9, 1));
}

function calibrationGap(rows, field) {
  let weighted = 0;
  let count = 0;
  for (const key of CLASSES) {
    for (let bin = 0; bin < 10; bin += 1) {
      const lower = bin / 10;
      const upper = (bin + 1) / 10;
      const subset = rows.filter((row) => row[field][key] >= lower && (bin === 9 ? row[field][key] <= upper : row[field][key] < upper));
      if (!subset.length) continue;
      const predicted = mean(subset.map((row) => row[field][key]));
      const actual = mean(subset.map((row) => row.outcome === key ? 1 : 0));
      weighted += subset.length * Math.abs(predicted - actual);
      count += subset.length;
    }
  }
  return count ? weighted / count : null;
}

function summarize(rows, field) {
  return {
    brier: round(mean(rows.map((row) => metricBrier(row[field], row.outcome)))),
    logLoss: round(mean(rows.map((row) => metricLogLoss(row[field], row.outcome)))),
    calibrationGap: round(calibrationGap(rows, field)),
    sampleSize: rows.length
  };
}

function seededRandom(seed = 20260825) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function quantile(values, probability) {
  const sorted = [...values].sort((left, right) => left - right);
  if (!sorted.length) return null;
  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - position) + sorted[upper] * (position - lower);
}

function bootstrapComparison(rows, candidateField, benchmarkField = "market", samples = 1500, seed = 20260825) {
  const random = seededRandom(seed);
  const brier = [];
  const logLoss = [];
  for (let sample = 0; sample < samples; sample += 1) {
    let benchmarkBrier = 0;
    let candidateBrier = 0;
    let benchmarkLog = 0;
    let candidateLog = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[Math.floor(random() * rows.length)];
      benchmarkBrier += metricBrier(row[benchmarkField], row.outcome);
      candidateBrier += metricBrier(row[candidateField], row.outcome);
      benchmarkLog += metricLogLoss(row[benchmarkField], row.outcome);
      candidateLog += metricLogLoss(row[candidateField], row.outcome);
    }
    brier.push((benchmarkBrier - candidateBrier) / rows.length);
    logLoss.push((benchmarkLog - candidateLog) / rows.length);
  }
  return {
    samples,
    seed,
    brierImprovement95: [round(quantile(brier, 0.025)), round(quantile(brier, 0.975))],
    logLossImprovement95: [round(quantile(logLoss, 0.025)), round(quantile(logLoss, 0.975))]
  };
}

function blend(probabilities, weights) {
  const result = {};
  for (const key of CLASSES) {
    result[key] = weights.market * probabilities.market[key]
      + weights.ml * probabilities.ml[key]
      + weights.poisson * probabilities.poisson[key];
  }
  const total = CLASSES.reduce((sum, key) => sum + result[key], 0) || 1;
  return Object.fromEntries(CLASSES.map((key) => [key, result[key] / total]));
}

function chooseEnsembleWeights(validationRows, model) {
  const predicted = validationRows.map((row) => ({ ...row, ml: predictFootballMlChallenger(model, row.features) }));
  let best = { market: 1, ml: 0, poisson: 0, logLoss: Infinity };
  for (let market = 0; market <= 10; market += 1) {
    for (let ml = 0; ml <= 10 - market; ml += 1) {
      const poisson = 10 - market - ml;
      const weights = { market: market / 10, ml: ml / 10, poisson: poisson / 10 };
      const loss = mean(predicted.map((row) => metricLogLoss(blend({ market: row.market, ml: row.ml, poisson: row.poisson }, weights), row.outcome)));
      if (loss < best.logLoss) best = { ...weights, logLoss: loss };
    }
  }
  return { market: best.market, ml: best.ml, poisson: best.poisson, validationLogLoss: round(best.logLoss) };
}

function promotionGate(metrics, bootstrap, sampleSize, calibrationTolerance = 0.02) {
  const passes = {
    sample: sampleSize >= 100,
    brier: metrics.candidate.brier < metrics.market.brier,
    logLoss: metrics.candidate.logLoss < metrics.market.logLoss,
    brierCi: finite(bootstrap.brierImprovement95?.[0], -1) > 0,
    logLossCi: finite(bootstrap.logLossImprovement95?.[0], -1) > 0,
    calibration: metrics.candidate.calibrationGap <= metrics.market.calibrationGap + calibrationTolerance
  };
  return { passes, eligibleForHumanReview: Object.values(passes).every(Boolean), autoPromotionAllowed: false };
}

export function runFootballMlChallengerLab(rawRows = [], options = {}) {
  const dataset = buildFootballMlFeatureDataset(rawRows, options);
  if (dataset.length < 150) return { ok: false, reason: "insufficient-paired-history", sampleSize: dataset.length };
  const holdoutFraction = clamp(finite(options.holdoutFraction, 0.30), 0.2, 0.4);
  const validationFraction = clamp(finite(options.validationFraction, 0.15), 0.1, 0.25);
  const holdoutStart = Math.floor(dataset.length * (1 - holdoutFraction));
  const validationStart = Math.floor(dataset.length * (1 - holdoutFraction - validationFraction));
  const train = dataset.slice(0, validationStart);
  const validation = dataset.slice(validationStart, holdoutStart);
  const holdout = dataset.slice(holdoutStart);
  const model = trainFootballMlChallenger(train, validation, options);
  const ensembleWeights = chooseEnsembleWeights(validation, model);
  const scored = holdout.map((row) => {
    const ml = predictFootballMlChallenger(model, row.features);
    const ensemble = blend({ market: row.market, ml, poisson: row.poisson }, ensembleWeights);
    return { ...row, ml, ensemble };
  });
  const metrics = {
    market: summarize(scored, "market"),
    poisson: summarize(scored, "poisson"),
    ml: summarize(scored, "ml"),
    ensemble: summarize(scored, "ensemble")
  };
  const bootstrapSamples = Math.floor(finite(options.bootstrapSamples, 1500));
  const bootstrapSeed = Math.floor(finite(options.bootstrapSeed, 20260825));
  const mlBootstrap = bootstrapComparison(scored, "ml", "market", bootstrapSamples, bootstrapSeed);
  const ensembleBootstrap = bootstrapComparison(scored, "ensemble", "market", bootstrapSamples, bootstrapSeed + 1);
  const mlGate = promotionGate({ candidate: metrics.ml, market: metrics.market }, mlBootstrap, scored.length);
  const ensembleGate = promotionGate({ candidate: metrics.ensemble, market: metrics.market }, ensembleBootstrap, scored.length);
  const best = [
    { id: "market", metrics: metrics.market },
    { id: "poisson", metrics: metrics.poisson },
    { id: "ml", metrics: metrics.ml },
    { id: "ensemble", metrics: metrics.ensemble }
  ].sort((left, right) => left.metrics.logLoss - right.metrics.logLoss)[0];
  const paidTrialJustified = mlGate.eligibleForHumanReview || ensembleGate.eligibleForHumanReview;
  return {
    ok: true,
    version: FOOTBALL_ML_CHALLENGER_VERSION,
    generatedAt: new Date().toISOString(),
    split: {
      total: dataset.length,
      train: train.length,
      validation: validation.length,
      holdout: holdout.length,
      trainThrough: train.at(-1)?.date || null,
      validationThrough: validation.at(-1)?.date || null,
      holdoutFrom: holdout[0]?.date || null,
      holdoutThrough: holdout.at(-1)?.date || null,
      chronologySafe: true
    },
    metrics,
    comparisons: {
      mlVsMarket: { bootstrap: mlBootstrap, gate: mlGate },
      ensembleVsMarket: { bootstrap: ensembleBootstrap, gate: ensembleGate }
    },
    ensembleWeights,
    champion: {
      benchmark: "no-vig-historical-market",
      observedBestOnHoldout: best.id,
      automaticPromotionAllowed: false,
      humanReviewCandidate: mlGate.eligibleForHumanReview ? "ml" : ensembleGate.eligibleForHumanReview ? "ensemble" : null
    },
    paidLiveDataDecision: {
      status: paidTrialJustified ? "trial-statistically-justified" : "do-not-buy-yet",
      paidLiveDataTrialJustified: paidTrialJustified,
      reason: paidTrialJustified
        ? "xg-dependent-challenger-cleared-holdout-significance-gates"
        : "xg-dependent-challenger-did-not-clear-all-holdout-significance-gates"
    },
    model,
    safety: {
      researchOnly: true,
      immutableHoldout: true,
      marketFeatureUsedByIndependentMl: false,
      ensembleUsesMarketBenchmark: true,
      productionModelPromotionAllowed: false,
      productionProbabilityChanged: false,
      productionPlayUpgradeAllowed: false,
      realMoneyActionAvailable: false,
      paperOnly: true
    }
  };
}
