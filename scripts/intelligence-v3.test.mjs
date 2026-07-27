import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildScout, simulateScenarios, buildDna, runBettingLab, coachExplanation, buildIntelligenceBundle } from "../lib/intelligence-v3.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const records = [
  { eventId: "evt-1", entityId: "team-a", metric: "market_probability", value: 0.52, observedAt: new Date().toISOString(), confidence: 0.9, sourceTrust: 0.95 },
  { eventId: "evt-1", entityId: "team-a", metric: "model_probability", value: 0.59, observedAt: new Date().toISOString(), confidence: 0.88, sourceTrust: 0.9 },
  { eventId: "evt-1", entityId: "team-a", metric: "best_odds", value: 2.05, observedAt: new Date().toISOString(), confidence: 0.9, sourceTrust: 0.95 },
  { eventId: "evt-1", entityId: "player-1", metric: "attack_rating", value: 0.72, observedAt: new Date().toISOString(), confidence: 0.82, sourceTrust: 0.88 },
  { eventId: "evt-1", entityId: "player-2", metric: "defense_rating", value: 0.68, observedAt: new Date().toISOString(), confidence: 0.8, sourceTrust: 0.86 }
];

test("AI Scout remains transparent and does not change production probability", () => {
  const scout = buildScout(records, { eventId: "evt-1" });
  assert.equal(scout.eventId, "evt-1");
  assert.equal(scout.probabilityChanged, false);
  assert.ok(scout.intelligenceScore >= 0 && scout.intelligenceScore <= 100);
  assert.ok(scout.dataQuality.metrics.includes("market_probability"));
});

test("scenario simulation is deterministic and bounded", () => {
  const first = simulateScenarios(records, { eventId: "evt-1", iterations: 5000 });
  const second = simulateScenarios(records, { eventId: "evt-1", iterations: 5000 });
  assert.equal(first.simulatedProbability, second.simulatedProbability);
  assert.equal(first.iterations, 5000);
  assert.ok(first.simulatedProbability > 0 && first.simulatedProbability < 1);
  assert.equal(first.paperOnly, true);
});

test("DNA and Betting Lab stay data-derived and paper-only", () => {
  const dna = buildDna(records);
  const lab = runBettingLab(records, { eventId: "evt-1" });
  assert.ok(dna.players.length >= 2);
  assert.equal(lab.realMoneyExecution, false);
  assert.ok(lab.strategies.every((strategy) => strategy.stakeFraction <= 0.05));
});

test("AI Coach exposes records and missing evidence", () => {
  const coach = coachExplanation(records, { eventId: "evt-1", iterations: 5000 });
  assert.equal(coach.transparency.recordsUsed, records.length);
  assert.equal(coach.transparency.inventedData, false);
  assert.equal(coach.transparency.productionProbabilityChanged, false);
});

test("bundle contains all requested V3 modules", () => {
  const bundle = buildIntelligenceBundle(records, { eventId: "evt-1", iterations: 5000 });
  for (const key of ["scout", "simulator", "dna", "bettingLab", "coach"]) assert.ok(bundle[key]);
  assert.equal(bundle.safety.paperOnly, true);
  assert.equal(bundle.safety.researchDataExcluded, true);
});

test("API and UI preserve publishable-only and no-invention boundaries", async () => {
  const [api, client] = await Promise.all([file("app/api/intelligence-v3/route.js"), file("app/intelligence-v3/IntelligenceV3Client.jsx")]);
  assert.match(api, /\.eq\("publishable", true\)/);
  assert.match(api, /collector_records/);
  assert.match(api, /buildIntelligenceBundle/);
  assert.match(client, /AI Scout/);
  assert.match(client, /Skenaariosimulaattori/);
  assert.match(client, /Team & Player DNA/);
  assert.match(client, /Paper Betting Lab/);
  assert.match(client, /AI Coach/);
  assert.match(client, /keksitty data/);
});
