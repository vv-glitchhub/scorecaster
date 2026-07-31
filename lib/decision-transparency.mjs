import { listCollectorSources } from "./collector-source-registry.mjs";

const nullableNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, nullableNumber(value, 0)));
const round = (value, digits = 4) => {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
};
const clean = (value, limit = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);
const observedAt = (row) => row?.observedAt || row?.observed_at || row?.collectedAt || row?.collected_at || null;
const sourceId = (row) => clean(row?.sourceId || row?.source_id, 80);

function latest(records, metric) {
  return [...records]
    .filter((row) => row.metric === metric && nullableNumber(row.value) !== null)
    .sort((a, b) => new Date(observedAt(b) || 0) - new Date(observedAt(a) || 0))[0] || null;
}

function average(values = []) {
  const usable = values.map((value) => nullableNumber(value)).filter((value) => value !== null);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0;
}

function ageHours(row, now = Date.now()) {
  const time = new Date(observedAt(row) || 0).getTime();
  return Number.isFinite(time) ? Math.max(0, (now - time) / 3600000) : Infinity;
}

export const PUBLIC_FORMULAS = Object.freeze([
  {
    id: "implied-probability",
    name: "Market implied probability",
    formula: "p_market = 1 / decimal_odds",
    variables: { p_market: "Market-implied probability", decimal_odds: "Best available decimal odds" },
    note: "This is the unadjusted single-price implied probability. It does not remove bookmaker margin by itself."
  },
  {
    id: "model-edge",
    name: "Model edge",
    formula: "edge = p_model - p_market",
    variables: { edge: "Difference between model and market probabilities", p_model: "Latest publishable model probability", p_market: "Latest market probability or 1 / odds" },
    note: "A positive edge is not a guarantee of profit; it is an estimate that must pass data-quality gates."
  },
  {
    id: "fair-odds",
    name: "Model fair odds",
    formula: "fair_odds = 1 / p_model",
    variables: { fair_odds: "Decimal odds corresponding to the model probability", p_model: "Model probability" },
    note: "Fair odds are undefined when no independent model probability is available."
  },
  {
    id: "expected-value",
    name: "Expected value per unit stake",
    formula: "EV = p_model × decimal_odds - 1",
    variables: { EV: "Expected return minus the original unit stake", p_model: "Model probability", decimal_odds: "Decimal odds" },
    note: "EV is a long-run estimate, not a promised result for one event."
  },
  {
    id: "freshness",
    name: "Freshness score",
    formula: "freshness = max(0, 1 - min(1, age_hours / 24))",
    variables: { age_hours: "Hours since the newest observation" },
    note: "The score declines linearly to zero at 24 hours."
  },
  {
    id: "data-quality",
    name: "Data quality",
    formula: "quality = 0.30×trust + 0.25×confidence + 0.20×freshness + 0.15×record_coverage + 0.10×source_diversity",
    variables: {
      trust: "Average source-trust score",
      confidence: "Average observation confidence",
      freshness: "Freshness score",
      record_coverage: "min(1, record_count / 8)",
      source_diversity: "min(1, unique_sources / 2)"
    },
    note: "All components are bounded between zero and one."
  },
  {
    id: "ranking-score",
    name: "Daily ranking score",
    formula: "score = 100 × (0.70×quality + 0.30×min(|edge|, 0.15)/0.15)",
    variables: { quality: "Data quality", edge: "Absolute model edge" },
    note: "The ranking score orders observations. It is not a probability."
  },
  {
    id: "kelly",
    name: "Kelly fraction",
    formula: "f* = (decimal_odds × p_model - 1) / (decimal_odds - 1)",
    variables: { "f*": "Theoretical bankroll fraction", decimal_odds: "Decimal odds", p_model: "Model probability" },
    note: "Scorecaster caps full Kelly at 5% and displays it only in paper mode."
  },
  {
    id: "brier-score",
    name: "Brier score",
    formula: "Brier = mean((p_i - y_i)²)",
    variables: { p_i: "Predicted probability", y_i: "Outcome, 0 or 1" },
    note: "Lower is better."
  },
  {
    id: "log-loss",
    name: "Log loss",
    formula: "LogLoss = mean(-(y×ln(p) + (1-y)×ln(1-p)))",
    variables: { p: "Probability clipped to [0.001, 0.999]", y: "Outcome, 0 or 1" },
    note: "Lower is better and confident wrong predictions are penalized heavily."
  },
  {
    id: "price-clv",
    name: "Price closing-line value",
    formula: "CLV = opening_odds / closing_odds - 1",
    variables: { opening_odds: "First stored best price", closing_odds: "Last stored best price" },
    note: "Positive values indicate the recorded opening price was larger than the later closing price."
  }
]);

export function publicSourceCatalogue(env = process.env) {
  return listCollectorSources(env).map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
    accessMode: source.accessMode,
    enabled: source.enabled,
    license: source.license,
    commercialUseAllowed: source.commercialUseAllowed,
    redistributionAllowed: source.redistributionAllowed,
    modelTrainingAllowed: source.modelTrainingAllowed,
    attributionRequired: source.attributionRequired,
    attribution: source.attribution,
    termsUrl: source.termsUrl,
    sports: source.sports,
    notes: source.notes,
    rawEndpointPublished: false
  }));
}

export function publicRecord(row = {}) {
  return {
    sourceId: sourceId(row) || null,
    eventId: clean(row.eventId || row.event_id, 180) || null,
    entityId: clean(row.entityId || row.entity_id, 180) || null,
    sport: clean(row.sport, 80) || null,
    league: clean(row.league, 120) || null,
    metric: clean(row.metric, 120) || null,
    value: nullableNumber(row.value),
    unit: clean(row.unit, 40) || null,
    observedAt: observedAt(row),
    collectedAt: row.collectedAt || row.collected_at || null,
    confidence: round(clamp(row.confidence)),
    sourceTrust: round(clamp(row.sourceTrust ?? row.source_trust))
  };
}

export function buildDecisionTransparency(records = [], pick = {}, now = Date.now(), env = process.env) {
  const newest = [...records].sort((a, b) => new Date(observedAt(b) || 0) - new Date(observedAt(a) || 0))[0] || null;
  const modelRow = latest(records, "model_probability") || latest(records, "expected_probability") || latest(records, "win_probability");
  const marketRow = latest(records, "market_probability") || latest(records, "implied_probability");
  const oddsRow = latest(records, "best_odds") || latest(records, "decimal_odds");

  const odds = nullableNumber(pick.bestOdds, nullableNumber(oddsRow?.value));
  const marketProbability = nullableNumber(
    pick.marketProbability,
    nullableNumber(marketRow?.value, odds && odds > 1 ? 1 / odds : null)
  );
  const modelProbability = nullableNumber(pick.modelProbability, nullableNumber(modelRow?.value));
  const decisionProbability = modelProbability ?? marketProbability;
  const edge = nullableNumber(
    pick.edge,
    modelProbability !== null && marketProbability !== null ? modelProbability - marketProbability : null
  );
  const expectedValue = decisionProbability !== null && odds && odds > 1 ? decisionProbability * odds - 1 : null;
  const fairOdds = modelProbability && modelProbability > 0 ? 1 / modelProbability : null;

  const trust = average(records.map((row) => clamp(row.sourceTrust ?? row.source_trust)));
  const confidence = average(records.map((row) => clamp(row.confidence)));
  const uniqueSourceIds = [...new Set(records.map(sourceId).filter(Boolean))];
  const freshness = newest ? Math.max(0, 1 - Math.min(1, ageHours(newest, now) / 24)) : 0;
  const recordCoverage = Math.min(1, records.length / 8);
  const sourceDiversity = Math.min(1, uniqueSourceIds.length / 2);
  const quality = 0.30 * trust + 0.25 * confidence + 0.20 * freshness + 0.15 * recordCoverage + 0.10 * sourceDiversity;
  const edgeContribution = edge === null ? 0 : Math.min(0.15, Math.abs(edge)) / 0.15;
  const score = 100 * (0.70 * quality + 0.30 * edgeContribution);
  const fullKelly = odds && odds > 1 && decisionProbability !== null
    ? Math.max(0, Math.min(0.05, (odds * decisionProbability - 1) / (odds - 1)))
    : null;

  const missingInputs = [];
  if (modelProbability === null) missingInputs.push("independent model probability");
  if (marketProbability === null) missingInputs.push("market probability or valid odds");
  if (!odds || odds <= 1) missingInputs.push("best decimal odds");
  if (uniqueSourceIds.length < 2) missingInputs.push("second independent source");
  if (freshness < 0.5) missingInputs.push("fresh observation");

  const factors = [
    { id: "edge", label: "Model edge", value: round(edge), direction: edge === null ? "missing" : edge >= 0.04 ? "positive" : edge > 0 ? "weak-positive" : "negative" },
    { id: "quality", label: "Data quality", value: round(quality), direction: quality >= 0.72 ? "positive" : quality >= 0.55 ? "mixed" : "negative" },
    { id: "trust", label: "Average source trust", value: round(trust), direction: trust >= 0.7 ? "positive" : "mixed" },
    { id: "confidence", label: "Average data confidence", value: round(confidence), direction: confidence >= 0.7 ? "positive" : "mixed" },
    { id: "freshness", label: "Freshness", value: round(freshness), direction: freshness >= 0.75 ? "positive" : freshness >= 0.5 ? "mixed" : "negative" },
    { id: "source-diversity", label: "Independent sources", value: uniqueSourceIds.length, direction: uniqueSourceIds.length >= 2 ? "positive" : "mixed" }
  ];

  const gateResults = [
    { id: "data-present", passed: records.length > 0, requirement: "At least one publishable observation" },
    { id: "quality-watch", passed: quality >= 0.72, requirement: "Quality at least 0.72 for WATCH" },
    { id: "edge-watch", passed: edge !== null && edge >= 0.04, requirement: "Positive edge of at least 0.04 for WATCH" },
    { id: "model-present", passed: modelProbability !== null, requirement: "Independent model probability for a positive-edge claim" },
    { id: "market-present", passed: marketProbability !== null, requirement: "Market probability or valid odds" },
    { id: "paper-only", passed: true, requirement: "No real-money execution" }
  ];

  const sourceRegistry = new Map(publicSourceCatalogue(env).map((source) => [source.id, source]));
  const sources = uniqueSourceIds.map((id) => {
    const sourceRows = records.filter((row) => sourceId(row) === id);
    const registry = sourceRegistry.get(id);
    const latestSourceRow = [...sourceRows].sort((a, b) => new Date(observedAt(b) || 0) - new Date(observedAt(a) || 0))[0] || null;
    return {
      id,
      name: registry?.name || id,
      license: registry?.license || "not listed in public registry",
      termsUrl: registry?.termsUrl || null,
      attribution: registry?.attribution || null,
      redistributionAllowed: registry?.redistributionAllowed ?? false,
      observations: sourceRows.length,
      metrics: [...new Set(sourceRows.map((row) => clean(row.metric, 120)).filter(Boolean))].sort(),
      newestObservationAt: observedAt(latestSourceRow)
    };
  });

  const verdict = clean(
    pick.decision || (quality < 0.55 ? "SKIP" : edge !== null && edge >= 0.04 && quality >= 0.72 ? "WATCH" : "CAUTION"),
    20
  );
  const summary = verdict === "WATCH"
    ? "The model-market difference is positive and the quality gate passed. This remains a paper-only observation, not a guaranteed result."
    : verdict === "CAUTION"
      ? "Some useful evidence exists, but the edge, source diversity or quality gate is not strong enough for WATCH."
      : "The available evidence is incomplete, stale or too weak for a supported paper decision.";

  return {
    version: "scorecaster-open-decision-transparency-v1",
    generatedAt: new Date(now).toISOString(),
    eventId: clean(pick.eventId || records[0]?.eventId || records[0]?.event_id, 180) || null,
    verdict,
    summary,
    calculations: {
      marketProbability: round(marketProbability),
      modelProbability: round(modelProbability),
      decisionProbability: round(decisionProbability),
      bestDecimalOdds: round(odds),
      fairOdds: round(fairOdds),
      edge: round(edge),
      expectedValuePerUnit: round(expectedValue),
      fullKellyCapped: round(fullKelly),
      quarterKelly: round(fullKelly === null ? null : fullKelly * 0.25),
      quality: round(quality),
      rankingScore: round(score, 1),
      components: {
        trust: round(trust),
        confidence: round(confidence),
        freshness: round(freshness),
        recordCoverage: round(recordCoverage),
        sourceDiversity: round(sourceDiversity),
        recordCount: records.length,
        uniqueSourceCount: uniqueSourceIds.length
      }
    },
    factors,
    gateResults,
    missingInputs,
    formulasUsed: ["implied-probability", "model-edge", "fair-odds", "expected-value", "freshness", "data-quality", "ranking-score", "kelly"],
    sources,
    publicRecords: records.map(publicRecord),
    disclosure: {
      formulasPublic: true,
      normalizedInputsPublic: true,
      sourceAttributionPublic: true,
      rawLicensedPayloadsPublic: false,
      reasonRawPayloadsAreNotPublic: "Provider credentials, personal data and content without redistribution rights are never exposed. Source names, terms, normalized publishable values and calculation methods remain visible.",
      inventedData: false,
      probabilityChangedByExplanation: false,
      paperOnly: true,
      automaticBetting: false
    }
  };
}

export const OPEN_METHODOLOGY = Object.freeze({
  version: "scorecaster-open-methodology-v1",
  license: "Documentation and formulas may be read and reused with attribution to Scorecaster. Third-party data remains governed by each source's own terms.",
  formulas: PUBLIC_FORMULAS,
  decisionGates: {
    WATCH: "Independent model probability exists, edge ≥ 0.04 and quality ≥ 0.72.",
    CAUTION: "Usable publishable evidence exists, but WATCH gates are not all satisfied.",
    SKIP: "Evidence is missing, stale or quality is below 0.55."
  },
  dataPolicy: {
    public: ["formula definitions", "decision thresholds", "normalized publishable inputs", "source IDs and attribution", "calculation outputs", "missing-input warnings"],
    neverPublic: ["API keys", "server secrets", "personal data", "raw provider payloads lacking redistribution rights", "internal security controls"]
  }
});
