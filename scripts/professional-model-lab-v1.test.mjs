import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildProfessionalExplanation,
  reproduceProfessionalExplanation
} from "../lib/professional-explanation-v1.mjs";
import { publicModelFormulaRegistry } from "../lib/model-formula-registry-v1.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const now = Date.parse("2026-08-05T12:00:00.000Z");

function record(overrides = {}) {
  return {
    sourceId: "scorecaster_internal",
    eventId: "event-1",
    entityId: "team-1",
    sport: "soccer_epl",
    league: "Premier League",
    metric: "supporting_metric",
    value: 1,
    unit: "ratio",
    observedAt: "2026-08-05T12:00:00.000Z",
    collectedAt: "2026-08-05T12:00:00.000Z",
    confidence: 1,
    sourceTrust: 1,
    ...overrides
  };
}

function completeRecords() {
  return [
    record({ metric: "model_probability", value: 0.58 }),
    record({ metric: "market_probability", value: 0.52, sourceId: "configured_json_api" }),
    record({ metric: "best_odds", value: 2.05 }),
    record({ metric: "attack_rating", value: 0.7, sourceId: "configured_json_api" }),
    record({ metric: "defense_rating", value: 0.6 }),
    record({ metric: "form_rating", value: 0.2, sourceId: "configured_json_api" }),
    record({ metric: "rest_days", value: 4 }),
    record({ metric: "injury_signal", value: 0, sourceId: "configured_json_api" })
  ];
}

test("Simple Mode is derived from structured factors and exposes missing evidence", () => {
  const result = buildProfessionalExplanation(completeRecords(), { eventId: "event-1", decision: "WATCH" }, now);
  assert.equal(result.ok, true);
  assert.equal(result.simple.verdict, "WATCH");
  assert.ok(result.simple.strongestPositiveFactor);
  assert.ok(Array.isArray(result.simple.missingEvidence));
  assert.equal(result.safety.generatedNarrativeUsedAsEvidence, false);
  assert.equal(result.safety.missingValuesConvertedToZero, false);
});

test("Pro Mode separates independent model, market benchmark and selected price", () => {
  const result = buildProfessionalExplanation(completeRecords(), {
    eventId: "event-1",
    decision: "WATCH",
    bookmaker: "alpha",
    bestOdds: 2.05,
    modelVersion: "transparent-1x2-v1"
  }, now);
  assert.equal(result.pro.probabilitySeparation.independentModelProbability, 0.58);
  assert.equal(result.pro.probabilitySeparation.marketBenchmarkProbability, 0.52);
  assert.equal(result.pro.probabilitySeparation.selectedBookmakerPrice, 2.05);
  assert.equal(result.pro.probabilitySeparation.marketMislabeledAsIndependentModel, false);
  assert.equal(result.pro.activeModel.independentPredictiveModel, true);
});

test("market-only evidence is never mislabeled as an independent model", () => {
  const records = completeRecords().filter((item) => item.metric !== "model_probability");
  const result = buildProfessionalExplanation(records, { eventId: "event-1" }, now);
  assert.equal(result.simple.probabilityLabel, "market-benchmark-only");
  assert.equal(result.pro.probabilitySeparation.independentModelProbability, null);
  assert.equal(result.pro.activeModel.id, "market-consensus-benchmark-v1");
  assert.equal(result.pro.activeModel.independentPredictiveModel, false);
  assert.equal(result.safety.marketMislabeledAsIndependentModel, false);
});

test("quality and ranking contribution values reconcile to displayed outputs", () => {
  const result = buildProfessionalExplanation(completeRecords(), { eventId: "event-1", edge: 0.06 }, now);
  assert.equal(result.pro.evidenceQualityDecomposition.reconciled, true);
  assert.equal(result.pro.evidenceQualityDecomposition.recomputed, 1);
  assert.equal(result.pro.evidenceQualityDecomposition.displayed, 1);
  assert.equal(result.pro.rankingReconciliation.reconciled, true);
  assert.equal(result.pro.rankingReconciliation.recomputed, result.pro.rankingReconciliation.displayed);
  assert.equal(result.pro.contributionsReconcile, true);
});

test("snapshot hash is deterministic and reproduction verifies the expected hash", () => {
  const first = buildProfessionalExplanation(completeRecords(), { eventId: "event-1", edge: 0.06 }, now);
  const second = buildProfessionalExplanation([...completeRecords()].reverse(), { eventId: "event-1", edge: 0.06 }, now);
  assert.equal(first.reproducibility.snapshotHash, second.reproducibility.snapshotHash);
  const reproduced = reproduceProfessionalExplanation({
    records: completeRecords(),
    pick: { eventId: "event-1", edge: 0.06 },
    generatedAt: first.generatedAt,
    expectedSnapshotHash: first.reproducibility.snapshotHash
  });
  assert.equal(reproduced.reproducibility.snapshotHashMatchesExpected, true);
  assert.equal(reproduced.reproducibility.rerunProducesSameSnapshotHash, true);
});

test("evidence sensitivity is explicitly not a calibrated confidence interval", () => {
  const result = buildProfessionalExplanation(completeRecords(), { eventId: "event-1" }, now);
  assert.equal(result.pro.uncertainty.type, "evidence-sensitivity-band");
  assert.equal(result.pro.uncertainty.calibratedConfidenceInterval, false);
  assert.ok(result.pro.uncertainty.lower < result.pro.uncertainty.center);
  assert.ok(result.pro.uncertainty.upper > result.pro.uncertainty.center);
});

test("formula and model registry publishes implementation and cutoff boundaries", () => {
  const registry = publicModelFormulaRegistry();
  assert.ok(registry.formulas.length >= 8);
  assert.ok(registry.models.length >= 4);
  assert.ok(registry.formulas.every((item) => item.implementationPath && item.inputCutoffRule));
  assert.ok(registry.models.every((item) => item.featureAvailabilityCutoff && item.automaticPromotion === false));
  assert.equal(registry.disclosure.privateKeysPublished, false);
  assert.equal(registry.disclosure.personalDataPublished, false);
});

test("API, shared UI, event page, docs and navigation preserve consistency and privacy", async () => {
  const [api, component, modelLab, eventPage, docs, shell] = await Promise.all([
    source("app/api/transparency/route.js"),
    source("app/components/ProfessionalExplanationCard.jsx"),
    source("app/model-lab/ModelLabClient.jsx"),
    source("app/event/[eventId]/page.jsx"),
    source("docs/PROFESSIONAL_MODEL_LAB_V1.md"),
    source("app/components/AppShell.jsx")
  ]);
  assert.match(api, /"mode", "reproduce", "snapshotHash"/);
  assert.match(api, /professionalExplanation/);
  assert.match(api, /personalDataPublished: false/);
  assert.match(component, /marketMislabeledAsIndependentModel=false/);
  assert.match(component, /missingValuesConvertedToZero=false/);
  assert.match(modelLab, /ProfessionalExplanationCard/);
  assert.match(eventPage, /ProfessionalExplanationCard/);
  assert.match(docs, /same `ProfessionalExplanationCard` component/i);
  assert.match(shell, /href: "\/model-lab"/);
  for (const text of [api, component, modelLab, docs]) {
    assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET=/);
  }
});
