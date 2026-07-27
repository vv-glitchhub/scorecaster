import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildModelRegistry, buildMatchupGraph, simulateDigitalTwin, backtestStrategies, buildRiskSignals, buildIntelligenceV4 } from "../lib/intelligence-v4.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const now = new Date().toISOString();
const events = [
  { eventId: "e1", records: [
    { sourceId: "s1", metric: "event_snapshot", payload: { homeTeam: "A", awayTeam: "B" }, observedAt: now, confidence: 0.9, sourceTrust: 0.9 },
    { sourceId: "s1", metric: "market_probability", value: 0.52, observedAt: now, confidence: 0.9, sourceTrust: 0.9 },
    { sourceId: "s2", metric: "model_probability", value: 0.59, observedAt: now, confidence: 0.85, sourceTrust: 0.88 },
    { sourceId: "s1", metric: "best_odds", value: 2.05, observedAt: now, confidence: 0.9, sourceTrust: 0.9 }
  ] },
  { eventId: "e2", records: [
    { sourceId: "s1", metric: "event_snapshot", payload: { homeTeam: "B", awayTeam: "C" }, observedAt: now, confidence: 0.8, sourceTrust: 0.85 },
    { sourceId: "s1", metric: "market_probability", value: 0.55, observedAt: now, confidence: 0.8, sourceTrust: 0.85 },
    { sourceId: "s2", metric: "model_probability", value: 0.57, observedAt: now, confidence: 0.82, sourceTrust: 0.87 },
    { sourceId: "s1", metric: "best_odds", value: 1.9, observedAt: now, confidence: 0.8, sourceTrust: 0.85 }
  ] }
];

test("model registry grades available layers", () => {
  const models = buildModelRegistry(events);
  assert.equal(models.length, 3);
  assert.equal(models[0].coverage, 1);
});

test("matchup graph attributes teams and edges", () => {
  const graph = buildMatchupGraph(events);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 2);
});

test("digital twin is deterministic for the same seed", () => {
  const a = simulateDigitalTwin(events, { iterations: 1000, seed: "same" });
  const b = simulateDigitalTwin(events, { iterations: 1000, seed: "same" });
  assert.deepEqual(a.teams, b.teams);
  assert.equal(a.teams.length, 3);
});

test("backtest stays paper-only and bounded", () => {
  const rows = backtestStrategies(events, 1000);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.paperOnly));
  assert.ok(rows.every((row) => Number.isFinite(row.endingExpectedBankroll)));
});

test("risk layer reports derived signals", () => {
  const signals = buildRiskSignals(events);
  assert.ok(signals.length >= 1);
});

test("V4 bundle and routes retain safety boundaries", async () => {
  const bundle = buildIntelligenceV4(events, { iterations: 1000, bankroll: 1000 });
  assert.equal(bundle.safety.publishableOnly, true);
  assert.equal(bundle.safety.probabilityChanged, false);
  const [api, client] = await Promise.all([file("app/api/intelligence-v4/route.js"), file("app/intelligence-v4/IntelligenceV4Client.jsx")]);
  assert.match(api, /\.eq\("publishable", true\)/);
  assert.match(api, /limit\(5000\)/);
  assert.match(client, /Digital Twin & Model Lab/);
  assert.match(client, /paper-only/);
});
