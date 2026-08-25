export const ZERO_COST_FOOTBALL_MODEL_LAB_VERSION = "scorecaster-zero-cost-football-model-lab-v1";
export const ZERO_COST_FOOTBALL_CHALLENGER_VERSION = "zero-cost-xg-poisson-walk-forward-v1";

const EPS = 1e-12;
const DEFAULT_HOLDOUT_FRACTION = 0.30;
const DEFAULT_EWMA_ALPHA = 0.24;
const DEFAULT_PRIOR_MATCHES = 5;
const DEFAULT_BOOTSTRAP_SAMPLES = 1000;
const MIN_REVIEW_SAMPLE = 100;

const TEAM_ALIASES = new Map(Object.entries({
  "afc bournemouth": "bournemouth",
  "bournemouth afc": "bournemouth",
  "leicester city": "leicester",
  "manchester city": "man city",
  "manchester united": "man united",
  "newcastle united": "newcastle",
  "norwich city": "norwich",
  "stoke city": "stoke",
  "swansea city": "swansea",
  "tottenham hotspur": "tottenham",
  "west bromwich albion": "west brom",
  "west ham united": "west ham",
  "wolverhampton wanderers": "wolves"
}));

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, lower, upper) {
  return Math.max(lower, Math.min(upper, value));
}

function round(value, digits = 6) {
  const parsed = finite(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function average(values = []) {
  const rows = values.map(finite).filter((value) => value !== null);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : null;
}

function quantile(values = [], probability = 0.5) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const position = clamp(probability, 0, 1) * (rows.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return rows[lower];
  const weight = position - lower;
  return rows[lower] * (1 - weight) + rows[upper] * weight;
}

function normalizeWhitespace(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function canonicalFootballTeam(value) {
  const normalized = normalizeWhitespace(value)
    .replace(/^the /, "")
    .replace(/\bfootball club\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bafc\b/g, "afc")
    .replace(/\s+/g, " ")
    .trim();
  return TEAM_ALIASES.get(normalized) || normalized;
}

export function parseCsv(text = "") {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function parseFootballDataDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = String(Number(match[2])).padStart(2, "0");
  const day = String(Number(match[1])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstOdds(row, triplets) {
  for (const triplet of triplets) {
    const [homeKey, drawKey, awayKey, source, timing] = triplet;
    const home = finite(row[homeKey]);
    const draw = finite(row[drawKey]);
    const away = finite(row[awayKey]);
    if ([home, draw, away].every((value) => value !== null && value > 1)) {
      return { home, draw, away, source, timing, columns: [homeKey, drawKey, awayKey] };
    }
  }
  return null;
}

export function parseFootballDataHistoricalCsv(text = "") {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => String(value || "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])))
    .map((row) => {
      const marketOdds = firstOdds(row, [
        ["PSCH", "PSCD", "PSCA", "pinnacle-closing", "closing"],
        ["AvgCH", "AvgCD", "AvgCA", "market-average-closing", "closing"],
        ["BbAvH", "BbAvD", "BbAvA", "bookmaker-market-average", "pregame-average"],
        ["AvgH", "AvgD", "AvgA", "market-average", "pregame-average"],
        ["B365H", "B365D", "B365A", "bet365", "pregame"]
      ]);
      return {
        date: parseFootballDataDate(row.Date),
        homeTeam: String(row.HomeTeam || "").trim(),
        awayTeam: String(row.AwayTeam || "").trim(),
        homeGoals: finite(row.FTHG),
        awayGoals: finite(row.FTAG),
        result: String(row.FTR || "").trim(),
        marketOdds
      };
    })
    .filter((row) => row.date && row.homeTeam && row.awayTeam && row.homeGoals !== null && row.awayGoals !== null && row.marketOdds);
}

export function noVigThreeWayProbabilities(odds = {}) {
  const home = finite(odds.home);
  const draw = finite(odds.draw);
  const away = finite(odds.away);
  if ([home, draw, away].some((value) => value === null || value <= 1)) return null;
  const raw = [1 / home, 1 / draw, 1 / away];
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return { home: raw[0] / total, draw: raw[1] / total, away: raw[2] / total, overround: total - 1 };
}

function poissonProbability(goals, lambda) {
  if (!Number.isInteger(goals) || goals < 0 || !Number.isFinite(lambda) || lambda <= 0) return 0;
  let factorial = 1;
  for (let value = 2; value <= goals; value += 1) factorial *= value;
  return Math.exp(-lambda) * (lambda ** goals) / factorial;
}

export function poissonThreeWayProbabilities(homeLambda, awayLambda, maxGoals = 10) {
  const homeExpected = clamp(Number(homeLambda), 0.05, 6);
  const awayExpected = clamp(Number(awayLambda), 0.05, 6);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    const homeP = poissonProbability(homeGoals, homeExpected);
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const joint = homeP * poissonProbability(awayGoals, awayExpected);
      if (homeGoals > awayGoals) home += joint;
      else if (homeGoals === awayGoals) draw += joint;
      else away += joint;
    }
  }
  const total = home + draw + away;
  if (total <= 0) return null;
  return { home: home / total, draw: draw / total, away: away / total };
}

function multiclassBrier(probabilities, outcome) {
  if (!probabilities || !["home", "draw", "away"].includes(outcome)) return null;
  return ["home", "draw", "away"].reduce((sum, key) => sum + ((finite(probabilities[key]) ?? 0) - (outcome === key ? 1 : 0)) ** 2, 0);
}

function multiclassLogLoss(probabilities, outcome) {
  const probability = finite(probabilities?.[outcome]);
  if (probability === null) return null;
  return -Math.log(clamp(probability, 1e-9, 1 - 1e-9));
}

function outcomeClass(row) {
  if (row.homeGoals > row.awayGoals) return "home";
  if (row.homeGoals < row.awayGoals) return "away";
  return "draw";
}

function calibrationGap(rows, field) {
  const classes = ["home", "draw", "away"];
  const gaps = [];
  for (const classKey of classes) {
    let weighted = 0;
    let count = 0;
    for (let bin = 0; bin < 10; bin += 1) {
      const lower = bin / 10;
      const upper = (bin + 1) / 10;
      const bucket = rows.filter((row) => {
        const probability = finite(row[field]?.[classKey]);
        return probability !== null && probability >= lower && (bin === 9 ? probability <= upper : probability < upper);
      });
      if (!bucket.length) continue;
      const predicted = average(bucket.map((row) => row[field][classKey]));
      const observed = average(bucket.map((row) => row.outcome === classKey ? 1 : 0));
      weighted += bucket.length * Math.abs(predicted - observed);
      count += bucket.length;
    }
    if (count) gaps.push(weighted / count);
  }
  return average(gaps);
}

function seededRandom(seed = 1337) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pairedBootstrap(rows, samples = DEFAULT_BOOTSTRAP_SAMPLES, seed = 1337) {
  if (!rows.length) return { samples: 0, brierImprovement95: [null, null], logLossImprovement95: [null, null] };
  const random = seededRandom(seed);
  const brier = [];
  const logLoss = [];
  for (let iteration = 0; iteration < samples; iteration += 1) {
    let modelBrier = 0;
    let marketBrier = 0;
    let modelLog = 0;
    let marketLog = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[Math.floor(random() * rows.length)];
      modelBrier += row.modelBrier;
      marketBrier += row.marketBrier;
      modelLog += row.modelLogLoss;
      marketLog += row.marketLogLoss;
    }
    brier.push((marketBrier - modelBrier) / rows.length);
    logLoss.push((marketLog - modelLog) / rows.length);
  }
  return {
    samples,
    seed,
    brierImprovement95: [round(quantile(brier, 0.025)), round(quantile(brier, 0.975))],
    logLossImprovement95: [round(quantile(logLoss, 0.025)), round(quantile(logLoss, 0.975))]
  };
}

function shrink(rate, matches, prior, priorMatches) {
  const count = Math.max(0, Number(matches) || 0);
  const weight = count / (count + priorMatches);
  return weight * rate + (1 - weight) * prior;
}

function teamState(states, name, prior) {
  const key = canonicalFootballTeam(name);
  if (!states.has(key)) states.set(key, { matches: 0, xgf: prior, xga: prior });
  return states.get(key);
}

function updateTeam(state, xgf, xga, alpha) {
  if (state.matches === 0) {
    state.xgf = xgf;
    state.xga = xga;
  } else {
    state.xgf = alpha * xgf + (1 - alpha) * state.xgf;
    state.xga = alpha * xga + (1 - alpha) * state.xga;
  }
  state.matches += 1;
}

function updateStates(states, row, prior, alpha) {
  const home = teamState(states, row.homeTeam, prior);
  const away = teamState(states, row.awayTeam, prior);
  updateTeam(home, row.homeXg, row.awayXg, alpha);
  updateTeam(away, row.awayXg, row.homeXg, alpha);
}

function predictFromStates(states, row, priors, priorMatches) {
  const home = teamState(states, row.homeTeam, priors.leagueAverage);
  const away = teamState(states, row.awayTeam, priors.leagueAverage);
  const homeAttack = shrink(home.xgf, home.matches, priors.leagueAverage, priorMatches);
  const homeDefense = shrink(home.xga, home.matches, priors.leagueAverage, priorMatches);
  const awayAttack = shrink(away.xgf, away.matches, priors.leagueAverage, priorMatches);
  const awayDefense = shrink(away.xga, away.matches, priors.leagueAverage, priorMatches);
  const homeLambda = clamp(Math.sqrt(Math.max(EPS, homeAttack * awayDefense)) * priors.homeFactor, 0.15, 4.5);
  const awayLambda = clamp(Math.sqrt(Math.max(EPS, awayAttack * homeDefense)) * priors.awayFactor, 0.10, 4.0);
  return {
    homeLambda,
    awayLambda,
    probabilities: poissonThreeWayProbabilities(homeLambda, awayLambda),
    history: { homeMatches: home.matches, awayMatches: away.matches }
  };
}

function summarizeOutcome(rows, field) {
  const classes = ["home", "draw", "away"];
  return Object.fromEntries(classes.map((classKey) => {
    const subset = rows.filter((row) => row.outcome === classKey);
    return [classKey, {
      sampleSize: subset.length,
      brier: round(average(subset.map((row) => multiclassBrier(row[field], row.outcome)))),
      logLoss: round(average(subset.map((row) => multiclassLogLoss(row[field], row.outcome))))
    }];
  }));
}

function decidePaidDataTrial({ sampleSize, brierSkillScore, logLossImprovement, bootstrap, modelCalibrationGap, marketCalibrationGap }) {
  const brierLow = finite(bootstrap?.brierImprovement95?.[0]);
  const logLow = finite(bootstrap?.logLossImprovement95?.[0]);
  const calibrationAcceptable = modelCalibrationGap !== null && marketCalibrationGap !== null
    ? modelCalibrationGap <= marketCalibrationGap + 0.02
    : false;
  if (sampleSize < MIN_REVIEW_SAMPLE) {
    return { status: "inconclusive", paidLiveDataTrialJustified: false, reason: "paired-holdout-sample-below-100" };
  }
  if (brierSkillScore > 0 && logLossImprovement > 0 && brierLow !== null && brierLow > 0 && logLow !== null && logLow > 0 && calibrationAcceptable) {
    return { status: "trial-justified", paidLiveDataTrialJustified: true, reason: "challenger-beats-market-with-positive-paired-bootstrap-and-acceptable-calibration" };
  }
  if (brierSkillScore <= 0 || logLossImprovement <= 0) {
    return { status: "do-not-buy-yet", paidLiveDataTrialJustified: false, reason: "challenger-does-not-beat-market-on-both-primary-proper-scoring-rules" };
  }
  return { status: "inconclusive", paidLiveDataTrialJustified: false, reason: "point-estimate-positive-but-statistical-or-calibration-gate-not-cleared" };
}

export function runZeroCostFootballModelLab(inputRows = [], options = {}) {
  const holdoutFraction = clamp(finite(options.holdoutFraction) ?? DEFAULT_HOLDOUT_FRACTION, 0.2, 0.5);
  const alpha = clamp(finite(options.ewmaAlpha) ?? DEFAULT_EWMA_ALPHA, 0.05, 0.6);
  const priorMatches = Math.max(1, Math.round(finite(options.priorMatches) ?? DEFAULT_PRIOR_MATCHES));
  const bootstrapSamples = Math.max(200, Math.round(finite(options.bootstrapSamples) ?? DEFAULT_BOOTSTRAP_SAMPLES));
  const rows = (Array.isArray(inputRows) ? inputRows : [])
    .filter((row) => row?.date && row.homeTeam && row.awayTeam)
    .filter((row) => [row.homeXg, row.awayXg, row.homeGoals, row.awayGoals].every((value) => finite(value) !== null))
    .filter((row) => noVigThreeWayProbabilities(row.marketOdds))
    .map((row) => ({ ...row, date: String(row.date).slice(0, 10), homeXg: Number(row.homeXg), awayXg: Number(row.awayXg), homeGoals: Number(row.homeGoals), awayGoals: Number(row.awayGoals) }))
    .sort((left, right) => left.date.localeCompare(right.date) || canonicalFootballTeam(left.homeTeam).localeCompare(canonicalFootballTeam(right.homeTeam)));

  if (rows.length < 20) {
    return {
      ok: false,
      version: ZERO_COST_FOOTBALL_MODEL_LAB_VERSION,
      status: "insufficient-data",
      sampleSize: rows.length,
      minimumRows: 20,
      researchOnly: true,
      productionUseAllowed: false,
      automaticPromotionAllowed: false,
      paidLiveDataDecision: { status: "inconclusive", paidLiveDataTrialJustified: false, reason: "insufficient-paired-data" }
    };
  }

  const splitIndex = Math.max(1, Math.min(rows.length - 1, Math.floor(rows.length * (1 - holdoutFraction))));
  const training = rows.slice(0, splitIndex);
  const holdout = rows.slice(splitIndex);
  const meanHome = average(training.map((row) => row.homeXg));
  const meanAway = average(training.map((row) => row.awayXg));
  const leagueAverage = average(training.flatMap((row) => [row.homeXg, row.awayXg]));
  const priors = {
    leagueAverage,
    homeFactor: meanHome / leagueAverage,
    awayFactor: meanAway / leagueAverage
  };

  const states = new Map();
  for (const row of training) updateStates(states, row, leagueAverage, alpha);

  const evaluated = [];
  for (const row of holdout) {
    const prediction = predictFromStates(states, row, priors, priorMatches);
    const market = noVigThreeWayProbabilities(row.marketOdds);
    const outcome = outcomeClass(row);
    const modelBrier = multiclassBrier(prediction.probabilities, outcome);
    const marketBrier = multiclassBrier(market, outcome);
    const modelLogLoss = multiclassLogLoss(prediction.probabilities, outcome);
    const marketLogLoss = multiclassLogLoss(market, outcome);
    evaluated.push({
      date: row.date,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      outcome,
      result: { home: row.homeGoals, away: row.awayGoals },
      xg: { home: row.homeXg, away: row.awayXg },
      projectedGoals: { home: round(prediction.homeLambda, 4), away: round(prediction.awayLambda, 4) },
      model: prediction.probabilities,
      market,
      marketSource: row.marketOdds?.source || null,
      marketTiming: row.marketOdds?.timing || null,
      modelBrier,
      marketBrier,
      modelLogLoss,
      marketLogLoss,
      history: prediction.history
    });
    updateStates(states, row, leagueAverage, alpha);
  }

  const paired = evaluated.filter((row) => [row.modelBrier, row.marketBrier, row.modelLogLoss, row.marketLogLoss].every(Number.isFinite));
  const modelBrier = average(paired.map((row) => row.modelBrier));
  const marketBrier = average(paired.map((row) => row.marketBrier));
  const modelLogLoss = average(paired.map((row) => row.modelLogLoss));
  const marketLogLoss = average(paired.map((row) => row.marketLogLoss));
  const brierSkillScore = marketBrier > 0 ? 1 - modelBrier / marketBrier : null;
  const logLossImprovement = marketLogLoss - modelLogLoss;
  const modelCalibrationGap = calibrationGap(paired, "model");
  const marketCalibrationGap = calibrationGap(paired, "market");
  const bootstrap = pairedBootstrap(paired, bootstrapSamples, finite(options.bootstrapSeed) ?? 1337);
  const paidLiveDataDecision = decidePaidDataTrial({
    sampleSize: paired.length,
    brierSkillScore,
    logLossImprovement,
    bootstrap,
    modelCalibrationGap,
    marketCalibrationGap
  });

  return {
    ok: true,
    version: ZERO_COST_FOOTBALL_MODEL_LAB_VERSION,
    challenger: {
      modelId: "zero-cost-football-xg-poisson",
      modelVersion: ZERO_COST_FOOTBALL_CHALLENGER_VERSION,
      independentPredictiveModel: true,
      probabilityAppliedToProduction: false,
      automaticPromotionAllowed: false
    },
    champion: {
      modelId: "historical-no-vig-market-benchmark",
      independentPredictiveModel: false,
      automaticReplacementAllowed: false
    },
    methodology: {
      chronologySafe: true,
      split: "chronological",
      holdoutFraction,
      trainingRows: training.length,
      holdoutRows: holdout.length,
      testStart: holdout[0]?.date || null,
      testEnd: holdout.at(-1)?.date || null,
      stateUpdatesDuringHoldout: "after-each-completed-match-only",
      xgFeaturesFromTargetMatchAllowed: false,
      marketOddsUsedByChallenger: false,
      ewmaAlpha: alpha,
      priorMatches,
      bootstrapSamples
    },
    sampleSize: paired.length,
    metrics: {
      challenger: {
        brier: round(modelBrier),
        logLoss: round(modelLogLoss),
        calibrationGap: round(modelCalibrationGap),
        byOutcome: summarizeOutcome(paired, "model")
      },
      marketChampion: {
        brier: round(marketBrier),
        logLoss: round(marketLogLoss),
        calibrationGap: round(marketCalibrationGap),
        byOutcome: summarizeOutcome(paired, "market")
      },
      skill: {
        brierSkillScore: round(brierSkillScore),
        logLossImprovement: round(logLossImprovement),
        beatsMarketOnBrier: brierSkillScore > 0,
        beatsMarketOnLogLoss: logLossImprovement > 0,
        bootstrap
      }
    },
    marketSources: [...new Set(paired.map((row) => `${row.marketSource || "unknown"}:${row.marketTiming || "unknown"}`))].sort(),
    paidLiveDataDecision,
    gates: {
      minimumPairedRows: MIN_REVIEW_SAMPLE,
      sampleGate: paired.length >= MIN_REVIEW_SAMPLE,
      brierGate: brierSkillScore > 0,
      logLossGate: logLossImprovement > 0,
      brierBootstrapGate: finite(bootstrap.brierImprovement95?.[0]) !== null && bootstrap.brierImprovement95[0] > 0,
      logLossBootstrapGate: finite(bootstrap.logLossImprovement95?.[0]) !== null && bootstrap.logLossImprovement95[0] > 0,
      calibrationGate: modelCalibrationGap !== null && marketCalibrationGap !== null && modelCalibrationGap <= marketCalibrationGap + 0.02
    },
    researchBoundary: {
      researchOnly: true,
      statsbombOpenDataProductionUseAllowed: false,
      statsbombOpenDataCommercialDeploymentAllowed: false,
      reportMayInformPaidProviderTrialDecision: true,
      reportMayUpgradeProductionDecision: false,
      reportMayPromoteModelAutomatically: false,
      realMoneyActionAvailable: false,
      paperOnly: true
    },
    rows: options.includeRows === true ? paired : undefined
  };
}
