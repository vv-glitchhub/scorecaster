import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compareMarketSnapshots,
  createMarketSnapshot,
  marketPickKey,
  normalizeMarketDecision
} from "../lib/market-change-engine.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function pick(overrides = {}) {
  return {
    id: "event-1",
    homeTeam: "Alpha",
    awayTeam: "Beta",
    commenceTime: "2026-08-01T18:00:00.000Z",
    market: "h2h",
    selection: "Alpha",
    productDecision: "WATCH",
    odds: 2,
    edge: 0.01,
    ev: 0.02,
    confidence: 0.6,
    bookmakerCount: 6,
    ...overrides
  };
}

test("market pick identity is stable and decision aliases are normalized", () => {
  assert.equal(marketPickKey(pick()), marketPickKey(pick({ odds: 2.2, edge: 0.03 })));
  assert.equal(normalizeMarketDecision({ decision: "BET" }), "PLAY");
  assert.equal(normalizeMarketDecision({ decision: "PASS" }), "SKIP");
  assert.equal(normalizeMarketDecision({ decision: "WAIT" }), "WATCH");
});

test("market comparison detects governed decision, price, metric, new and removed changes", () => {
  const previous = createMarketSnapshot({
    savedAt: "2026-07-31T10:00:00.000Z",
    picks: [
      pick(),
      pick({ id: "event-removed", selection: "Beta", productDecision: "SKIP" })
    ]
  });
  const current = createMarketSnapshot({
    savedAt: "2026-07-31T11:00:00.000Z",
    picks: [
      pick({ productDecision: "PLAY", odds: 2.08, edge: 0.03, ev: 0.05, confidence: 0.66 }),
      pick({ id: "event-new", selection: "Beta", productDecision: "WATCH" })
    ]
  });

  const result = compareMarketSnapshots(previous, current);
  assert.equal(result.baselineMissing, false);
  assert.equal(result.summary.decision, 1);
  assert.equal(result.summary.new, 1);
  assert.equal(result.summary.removed, 1);
  assert.ok(result.summary.total >= 3);
  assert.equal(result.changes[0].severity, "critical");
  assert.ok(result.changes.some((change) => change.fields.some((field) => field.field === "odds")));
  assert.ok(result.changes.some((change) => change.fields.some((field) => field.field === "edge")));
});

test("sub-threshold numerical noise is ignored", () => {
  const previous = createMarketSnapshot({ picks: [pick()] });
  const current = createMarketSnapshot({
    picks: [pick({ odds: 2.01, edge: 0.014, ev: 0.024, confidence: 0.62 })]
  });
  const result = compareMarketSnapshots(previous, current);
  assert.equal(result.summary.total, 0);
});

test("missing baseline fails closed without inventing changes", () => {
  const current = createMarketSnapshot({ picks: [pick()] });
  const result = compareMarketSnapshots(null, current);
  assert.equal(result.baselineMissing, true);
  assert.deepEqual(result.changes, []);
});

test("radar route is discoverable, local-only and cannot override model decisions", async () => {
  const page = await read("app/changes/page.jsx");
  const client = await read("app/changes/MarketChangesClient.jsx");
  const shell = await read("app/components/AppShell.jsx");
  const storage = await read("lib/market-snapshot-storage.js");

  assert.match(page, /MarketChangesClient/);
  assert.match(shell, /href: "\/changes"/);
  assert.match(client, /fetch\("\/api\/top-picks"/);
  assert.match(client, /compareMarketSnapshots/);
  assert.match(client, /vain paperiseuranta|paper only/);
  assert.match(client, /ei muuta todennäköisyyttä|cannot alter probability/);
  assert.match(storage, /localStorage/);
  assert.doesNotMatch(client + storage, /bookmaker.*(execute|place)|deposit|withdraw/i);
});
