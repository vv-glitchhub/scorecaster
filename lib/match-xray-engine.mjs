import { buildTransparent1X2, TRANSPARENT_1X2_MODEL_VERSION } from "./transparent-1x2-engine.mjs";

const MATCH_XRAY_VERSION = "scorecaster-match-xray-v1";
const SCORELINE_GRID_MAX = 5;

const OPTIONAL_METRICS = [
  ["xgFor", "xG for", "goals"],
  ["xgAgainst", "xG against", "goals"],
  ["shotsFor", "Shots for", "shots"],
  ["shotsAgainst", "Shots against", "shots"],
  ["possession", "Possession", "%"],
  ["pressIntensity", "Press intensity", "index"],
  ["transitionThreat", "Transition threat", "index"],
  ["setPieceThreat", "Set-piece threat", "index"]
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 6) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function normalizePercentMetric(value) {
  const number = finite(value);
  if (number === null) return null;
  if (number >= -1 && number <= 1) return clamp(50 + number * 50, 0, 100);
  return clamp(number, 0, 100);
}

function sampleWeight(sampleSize) {
  if (sampleSize === null) return 0.5;
  return clamp(sampleSize / 20, 0.25, 1);
}

function recencyScore(observedAt, generatedAt) {
  const ageDays = Math.max(0, (new Date(generatedAt).getTime() - new Date(observedAt).getTime()) / 86_400_000);
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.8;
  if (ageDays <= 90) return 0.55;
  if (ageDays <= 180) return 0.35;
  return 0.2;
}

function teamProfile(input = {}, role, generatedAt, kickoffAt) {
  const sourceId = String(input.sourceId || "").trim().slice(0, 120) || null;
  const observedAt = iso(input.observedAt);
  const windowStart = iso(input.windowStart);
  const windowEnd = iso(input.windowEnd) || observedAt;
  const sampleSize = finite(input.sampleSize);
  const weight = sampleWeight(sampleSize);
  const rawForm = normalizePercentMetric(input.form ?? input.form_rating);
  const adjustedForm = rawForm === null ? null : 50 + (rawForm - 50) * weight;
  const missingEvidence = [];
  const chronologyErrors = [];

  if (!sourceId) missingEvidence.push(`${role}.sourceId`);
  if (!observedAt) missingEvidence.push(`${role}.observedAt`);
  if (observedAt && new Date(observedAt) > new Date(generatedAt)) chronologyErrors.push(`${role}.observedAt-after-generatedAt`);
  if (observedAt && kickoffAt && new Date(observedAt) >= new Date(kickoffAt)) chronologyErrors.push(`${role}.post-kickoff-evidence`);

  const optional = Object.fromEntries(OPTIONAL_METRICS.map(([key]) => [key, finite(input[key])]));

  return {
    name: String(input.team ?? input.name ?? role).trim().slice(0, 120),
    rating: finite(input.rating ?? input.elo ?? input.power_rating),
    attack: normalizePercentMetric(input.attack ?? input.attack_rating),
    defense: normalizePercentMetric(input.defense ?? input.defence ?? input.defense_rating),
    rawForm,
    adjustedForm,
    sampleSize,
    sampleWeight: weight,
    sourceId,
    observedAt,
    windowStart,
    windowEnd,
    optional,
    missingEvidence,
    chronologyErrors
  };
}

function evidenceMetric(profile, key, label, unit, value) {
  return {
    key,
    label,
    value: round(value, 3),
    unit,
    sourceId: profile.sourceId,
    observedAt: profile.observedAt,
    windowStart: profile.windowStart,
    windowEnd: profile.windowEnd,
    sampleSize: profile.sampleSize,
    sampleWeight: round(profile.sampleWeight, 3),
    displayable: value !== null && Boolean(profile.sourceId) && Boolean(profile.observedAt)
  };
}

function teamEvidence(profile) {
  return {
    team: profile.name,
    sourceId: profile.sourceId,
    observedAt: profile.observedAt,
    windowStart: profile.windowStart,
    windowEnd: profile.windowEnd,
    sampleSize: profile.sampleSize,
    sampleWeight: round(profile.sampleWeight, 3),
    sampleWarning: profile.sampleSize === null
      ? "sample-size-unknown"
      : profile.sampleSize < 5
        ? "very-small-sample"
        : profile.sampleSize < 10
          ? "small-sample"
          : null,
    metrics: [
      evidenceMetric(profile, "rating", "Power rating", "rating points", profile.rating),
      evidenceMetric(profile, "attack", "Attack strength", "0-100", profile.attack),
      evidenceMetric(profile, "defense", "Defence strength", "0-100", profile.defense),
      evidenceMetric(profile, "formRaw", "Raw form", "0-100", profile.rawForm),
      evidenceMetric(profile, "formAdjusted", "Sample-adjusted form", "0-100", profile.adjustedForm),
      ...OPTIONAL_METRICS.map(([key, label, unit]) => evidenceMetric(profile, key, label, unit, profile.optional[key]))
    ]
  };
}

function factorial(number) {
  let result = 1;
  for (let index = 2; index <= number; index += 1) result *= index;
  return result;
}

function poisson(lambda, goals) {
  return Math.exp(-lambda) * (lambda ** goals) / factorial(goals);
}

function scorelineMatrix(homeLambda, awayLambda) {
  const rows = [];
  let coveredMass = 0;
  for (let homeGoals = 0; homeGoals <= SCORELINE_GRID_MAX; homeGoals += 1) {
    const cells = [];
    for (let awayGoals = 0; awayGoals <= SCORELINE_GRID_MAX; awayGoals += 1) {
      const probability = poisson(homeLambda, homeGoals) * poisson(awayLambda, awayGoals);
      coveredMass += probability;
      cells.push({ homeGoals, awayGoals, probability: round(probability) });
    }
    rows.push({ homeGoals, cells });
  }
  return {
    maxGoalsPerTeam: SCORELINE_GRID_MAX,
    rows,
    coveredProbabilityMass: round(coveredMass),
    outsideGridProbability: round(Math.max(0, 1 - coveredMass))
  };
}

function optionalCoverage(home, away) {
  const values = OPTIONAL_METRICS.flatMap(([key]) => [home.optional[key], away.optional[key]]);
  return values.filter((value) => value !== null).length / values.length;
}

function matchupEvidence(home, away) {
  const rows = [
    {
      id: "rating-gap",
      label: "Power-rating gap",
      value: round(home.rating - away.rating, 2),
      unit: "rating points",
      direction: home.rating >= away.rating ? "home" : "away",
      sourceIds: [home.sourceId, away.sourceId]
    },
    {
      id: "home-attack-vs-away-defence",
      label: "Home attack versus away defence",
      value: round((home.attack - 50) + (50 - away.defense), 3),
      unit: "matchup index",
      direction: (home.attack - 50) + (50 - away.defense) >= 0 ? "home" : "away",
      sourceIds: [home.sourceId, away.sourceId]
    },
    {
      id: "away-attack-vs-home-defence",
      label: "Away attack versus home defence",
      value: round((away.attack - 50) + (50 - home.defense), 3),
      unit: "matchup index",
      direction: (away.attack - 50) + (50 - home.defense) >= 0 ? "away" : "home",
      sourceIds: [home.sourceId, away.sourceId]
    },
    {
      id: "sample-adjusted-form-gap",
      label: "Sample-adjusted form gap",
      value: round(home.adjustedForm - away.adjustedForm, 3),
      unit: "form points",
      direction: home.adjustedForm >= away.adjustedForm ? "home" : "away",
      sourceIds: [home.sourceId, away.sourceId]
    }
  ];

  if ([home.optional.xgFor, home.optional.xgAgainst, away.optional.xgFor, away.optional.xgAgainst].every((value) => value !== null)) {
    const homeXgMatchup = (home.optional.xgFor + away.optional.xgAgainst) / 2;
    const awayXgMatchup = (away.optional.xgFor + home.optional.xgAgainst) / 2;
    rows.push({
      id: "observed-xg-matchup-gap",
      label: "Observed xG matchup gap",
      value: round(homeXgMatchup - awayXgMatchup, 3),
      unit: "xG",
      direction: homeXgMatchup >= awayXgMatchup ? "home" : "away",
      sourceIds: [home.sourceId, away.sourceId]
    });
  }

  if ([home.optional.pressIntensity, away.optional.transitionThreat].every((value) => value !== null)) {
    rows.push({
      id: "home-press-vs-away-transition",
      label: "Home press versus away transition",
      value: round(home.optional.pressIntensity - away.optional.transitionThreat, 3),
      unit: "style index",
      direction: home.optional.pressIntensity >= away.optional.transitionThreat ? "home" : "away",
      sourceIds: [home.sourceId, away.sourceId]
    });
  }

  if ([away.optional.pressIntensity, home.optional.transitionThreat].every((value) => value !== null)) {
    rows.push({
      id: "away-press-vs-home-transition",
      label: "Away press versus home transition",
      value: round(away.optional.pressIntensity - home.optional.transitionThreat, 3),
      unit: "style index",
      direction: away.optional.pressIntensity >= home.optional.transitionThreat ? "away" : "home",
      sourceIds: [home.sourceId, away.sourceId]
    });
  }

  return rows;
}

function factorsFromMatchups(matchups) {
  return matchups
    .map((row) => ({
      id: row.id,
      label: row.label,
      direction: row.direction,
      value: row.value,
      unit: row.unit,
      strength: round(clamp(Math.abs(row.value) / (row.unit === "rating points" ? 200 : row.unit === "xG" ? 1.5 : 30), 0, 1), 3),
      sourceIds: row.sourceIds
    }))
    .sort((left, right) => right.strength - left.strength);
}

function scenario(name, label, baseline, input) {
  const result = buildTransparent1X2(input);
  if (!result.ok) return null;
  return {
    id: name,
    label,
    status: "sensitivity-test-not-observed-evidence",
    probabilities: result.probabilities,
    expectedGoals: result.expectedGoals,
    deltaFromBaseline: Object.fromEntries(
      ["home", "draw", "away"].map((key) => [key, round(result.probabilities[key] - baseline.probabilities[key])])
    )
  };
}

function buildRisks(home, away, model, optionalMissing) {
  const risks = [];
  for (const profile of [home, away]) {
    if (profile.sampleSize === null) risks.push({ id: `${profile.name}-sample-unknown`, severity: "caution", message: `${profile.name}: sample size is unknown.` });
    else if (profile.sampleSize < 5) risks.push({ id: `${profile.name}-sample-very-small`, severity: "high", message: `${profile.name}: very small sample (${profile.sampleSize}). Form is strongly down-weighted.` });
    else if (profile.sampleSize < 10) risks.push({ id: `${profile.name}-sample-small`, severity: "caution", message: `${profile.name}: small sample (${profile.sampleSize}). Form is down-weighted.` });
  }
  if (model.components.evidenceQuality.confidence < 0.65) risks.push({ id: "low-baseline-confidence", severity: "caution", message: "Baseline evidence confidence is below 65%." });
  if (optionalMissing.length) risks.push({ id: "missing-tactical-evidence", severity: "info", message: `${optionalMissing.length} optional tactical metrics are unavailable and were not invented.` });
  if (Math.max(...Object.values(model.probabilities)) < 0.45) risks.push({ id: "balanced-match", severity: "info", message: "No 1X2 outcome exceeds 45%; the matchup is comparatively balanced." });
  if (model.marketEdges && Math.max(...Object.values(model.marketEdges).map(Math.abs)) > 0.08) risks.push({ id: "large-market-disagreement", severity: "caution", message: "Model and no-vig market differ by more than eight percentage points." });
  return risks;
}

export function buildMatchXRay(input = {}) {
  const generatedAt = iso(input.generatedAt) || new Date().toISOString();
  const kickoffAt = iso(input.kickoffAt);
  const home = teamProfile(input.homeTeam, "home", generatedAt, kickoffAt);
  const away = teamProfile(input.awayTeam, "away", generatedAt, kickoffAt);
  const missingEvidence = [...home.missingEvidence, ...away.missingEvidence];
  const chronologyErrors = [...home.chronologyErrors, ...away.chronologyErrors];

  if (missingEvidence.length) {
    return { ok: false, xrayVersion: MATCH_XRAY_VERSION, reason: "missing-evidence-metadata", missingEvidence, paperOnly: true };
  }
  if (chronologyErrors.length) {
    return { ok: false, xrayVersion: MATCH_XRAY_VERSION, reason: "chronology-violation", chronologyErrors, paperOnly: true };
  }

  const modelInput = {
    homeTeam: { team: home.name, rating: home.rating, attack: home.attack, defense: home.defense, form: home.adjustedForm },
    awayTeam: { team: away.name, rating: away.rating, attack: away.attack, defense: away.defense, form: away.adjustedForm },
    neutralVenue: Boolean(input.neutralVenue),
    marketOdds: input.marketOdds || undefined,
    generatedAt,
    trainingEvidence: input.trainingEvidence || { sampleScore: 0, calibrationScore: 0 }
  };
  const model = buildTransparent1X2(modelInput, input.configuration || {});
  if (!model.ok) return { ...model, xrayVersion: MATCH_XRAY_VERSION };

  const matchups = matchupEvidence(home, away);
  const optionalMissing = OPTIONAL_METRICS.flatMap(([key, label]) => [
    home.optional[key] === null ? `${home.name}.${label}` : null,
    away.optional[key] === null ? `${away.name}.${label}` : null
  ]).filter(Boolean);
  const coverage = optionalCoverage(home, away);
  const recency = (recencyScore(home.observedAt, generatedAt) + recencyScore(away.observedAt, generatedAt)) / 2;
  const sample = (home.sampleWeight + away.sampleWeight) / 2;
  const evidenceQuality = clamp(
    0.5 * model.components.evidenceQuality.confidence +
    0.2 * sample +
    0.2 * recency +
    0.1 * coverage,
    0,
    0.95
  );

  const scenarios = [
    {
      id: "baseline",
      label: "Observed baseline",
      status: "uses-observed-pre-match-evidence",
      probabilities: model.probabilities,
      expectedGoals: model.expectedGoals,
      deltaFromBaseline: { home: 0, draw: 0, away: 0 }
    },
    !input.neutralVenue ? scenario("neutral-venue", "Neutral venue sensitivity", model, { ...modelInput, neutralVenue: true }) : null,
    scenario("form-neutralized", "Form-neutralized sensitivity", model, {
      ...modelInput,
      homeTeam: { ...modelInput.homeTeam, form: 50 },
      awayTeam: { ...modelInput.awayTeam, form: 50 }
    })
  ].filter(Boolean);

  const sources = [home, away].map((profile) => ({
    sourceId: profile.sourceId,
    team: profile.name,
    observedAt: profile.observedAt,
    windowStart: profile.windowStart,
    windowEnd: profile.windowEnd,
    sampleSize: profile.sampleSize,
    rawRowsPublished: false
  }));

  return {
    ok: true,
    xrayVersion: MATCH_XRAY_VERSION,
    probabilityModelVersion: TRANSPARENT_1X2_MODEL_VERSION,
    generatedAt,
    kickoffAt,
    event: { id: input.eventId || null, home: home.name, away: away.name, neutralVenue: Boolean(input.neutralVenue) },
    model,
    teams: { home: teamEvidence(home), away: teamEvidence(away) },
    matchupEvidence: matchups,
    factors: factorsFromMatchups(matchups),
    risks: buildRisks(home, away, model, optionalMissing),
    unknowns: optionalMissing,
    scorelineMatrix: scorelineMatrix(model.expectedGoals.home, model.expectedGoals.away),
    scenarios,
    evidenceQuality: {
      score: round(evidenceQuality),
      baselineConfidence: model.components.evidenceQuality.confidence,
      sampleQuality: round(sample),
      recencyQuality: round(recency),
      optionalMetricCoverage: round(coverage),
      method: "documented weighted evidence score; not a fitted confidence interval"
    },
    sourceEvidence: sources,
    audit: {
      inputsSnapshot: {
        home: { rating: home.rating, attack: home.attack, defense: home.defense, rawForm: home.rawForm, adjustedForm: round(home.adjustedForm), sampleSize: home.sampleSize },
        away: { rating: away.rating, attack: away.attack, defense: away.defense, rawForm: away.rawForm, adjustedForm: round(away.adjustedForm), sampleSize: away.sampleSize },
        neutralVenue: Boolean(input.neutralVenue),
        marketOdds: input.marketOdds || null
      },
      evidenceCutoff: kickoffAt || generatedAt,
      closingLineUsed: false,
      postKickoffDataUsed: false,
      inventedMetrics: false,
      reproducible: true
    },
    decisionAuthority: "observation-only; Match X-Ray cannot independently promote PLAY",
    paperOnly: true,
    limitations: [
      "Optional tactical metrics appear only when a licensed, timestamped source supplies them.",
      "Sparse samples down-weight form toward neutral before the probability model is called.",
      "Sensitivity scenarios are hypothetical tests and are never represented as observed evidence.",
      "The underlying 1X2 baseline is not yet league-calibrated.",
      "Lineups, injuries, travel, weather and officials remain outside Match X-Ray V1 until Context Engine sources are activated."
    ]
  };
}

export { MATCH_XRAY_VERSION };
