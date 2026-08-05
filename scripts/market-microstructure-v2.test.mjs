import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMarketMicrostructure,
  MARKET_MICROSTRUCTURE_VERSION,
  normalizeMarketProviderGames
} from "../lib/market-microstructure-v2.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const eventId = "event-market-v2";
const commenceTime = "2026-08-05T14:00:00.000Z";

function bookmaker(key, homePrice, awayPrice, lastUpdate, drawPrice = null) {
  const outcomes = [
    { name: "Home", price: homePrice },
    ...(drawPrice ? [{ name: "Draw", price: drawPrice }] : []),
    { name: "Away", price: awayPrice }
  ];
  return { key, title: key.toUpperCase(), last_update: lastUpdate, markets: [{ key: "h2h", outcomes }] };
}

function game(bookmakers) {
  return {
    id: eventId,
    sport_key: "soccer_epl",
    sport_title: "Premier League",
    commence_time: commenceTime,
    bookmakers
  };
}

function capture(capturedAt, prices, captureId) {
  return normalizeMarketProviderGames([
    game(prices.map(([key, home, away, updated]) => bookmaker(key, home, away, updated || capturedAt)))
  ], { capturedAt, captureId, sourceId: "the_odds_api" });
}

function combined(openingPrices, currentPrices, currentAt = "2026-08-05T10:20:00.000Z") {
  const opening = capture("2026-08-05T10:00:00.000Z", openingPrices, "11111111-1111-5111-8111-111111111111");
  const current = capture(currentAt, currentPrices, "22222222-2222-5222-8222-222222222222");
  return [...opening.records, ...current.records];
}

test("provider outcomes are normalized to no-vig probabilities and IDs are deterministic", () => {
  const input = [game([bookmaker("alpha", 2.0, 2.0, "2026-08-05T10:00:00.000Z")])];
  const first = normalizeMarketProviderGames(input, { capturedAt: "2026-08-05T10:01:00.000Z", captureId: "11111111-1111-5111-8111-111111111111" });
  const second = normalizeMarketProviderGames(input, { capturedAt: "2026-08-05T10:01:00.000Z", captureId: "11111111-1111-5111-8111-111111111111" });
  assert.equal(first.version, MARKET_MICROSTRUCTURE_VERSION);
  assert.equal(first.records.length, 2);
  assert.deepEqual(first.records.map((row) => row.id), second.records.map((row) => row.id));
  assert.ok(Math.abs(first.records.reduce((sum, row) => sum + row.normalized_probability, 0) - 1) < 0.00001);
  assert.equal(first.rawPayloadStored, false);
});

test("post-start captures and future provider timestamps fail closed", () => {
  const postStart = capture("2026-08-05T14:01:00.000Z", [["alpha", 2, 2]], "11111111-1111-5111-8111-111111111111");
  assert.equal(postStart.records.length, 0);
  assert.ok(postStart.rejected[0].errors.includes("post-start-capture"));

  const future = capture("2026-08-05T10:00:00.000Z", [["alpha", 2, 2, "2026-08-05T10:10:00.000Z"]], "22222222-2222-5222-8222-222222222222");
  assert.equal(future.records.length, 0);
  assert.ok(future.rejected[0].errors.includes("future-provider-update"));
});

test("synchronized fresh multi-provider movement is detected without a sharp-money claim", () => {
  const rows = combined(
    [["alpha", 2.0, 2.0], ["beta", 2.02, 1.98], ["gamma", 1.98, 2.02], ["delta", 2.01, 1.99]],
    [["alpha", 1.78, 2.2], ["beta", 1.80, 2.18], ["gamma", 1.79, 2.19], ["delta", 1.81, 2.17]]
  );
  const result = buildMarketMicrostructure(rows, { eventId, market: "h2h", selection: "Home", generatedAt: "2026-08-05T10:21:00.000Z" });
  const home = result.selections[0];
  assert.equal(result.ok, true);
  assert.equal(home.movement.broadEvidence.detected, true);
  assert.equal(home.movement.causeLabel, "inferred-broad-market-movement");
  assert.equal(home.sharpMoneyClaim, false);
  assert.equal(result.sharpMoneyClaim, false);
  assert.equal(home.closing, null);
  assert.equal(home.leakageBoundary.closingVisible, false);
  assert.equal(home.leakageBoundary.closingUsedByPrematchModel, false);
});

test("a stale provider cannot create broad movement", () => {
  const rows = combined(
    [["alpha", 2, 2], ["beta", 2, 2], ["gamma", 2, 2]],
    [
      ["alpha", 1.75, 2.25, "2026-08-05T10:20:00.000Z"],
      ["beta", 1.76, 2.24, "2026-08-05T10:20:00.000Z"],
      ["gamma", 1.30, 4.0, "2026-08-05T09:00:00.000Z"]
    ]
  );
  const result = buildMarketMicrostructure(rows, { eventId, market: "h2h", selection: "Home", generatedAt: "2026-08-05T10:21:00.000Z" });
  const home = result.selections[0];
  assert.equal(home.movement.broadEvidence.detected, false);
  assert.ok(home.movement.staleProviders.includes("gamma"));
  assert.equal(result.safety.staleProvidersCanTriggerBroadMove, false);
});

test("an isolated provider outlier is labelled as an outlier instead of broad movement", () => {
  const rows = combined(
    [["alpha", 2, 2], ["beta", 2, 2], ["gamma", 2, 2], ["delta", 2, 2]],
    [["alpha", 2, 2], ["beta", 2.01, 1.99], ["gamma", 1.99, 2.01], ["delta", 1.1, 8.0]]
  );
  const result = buildMarketMicrostructure(rows, { eventId, market: "h2h", selection: "Home", generatedAt: "2026-08-05T10:21:00.000Z" });
  const home = result.selections[0];
  assert.equal(home.movement.broadEvidence.detected, false);
  assert.equal(home.movement.causeLabel, "isolated-provider-outlier");
  assert.ok(home.movement.outlierProviders.includes("delta"));
  assert.equal(result.safety.isolatedOutlierCanTriggerBroadMove, false);
});

test("closing consensus is exposed only after kickoff and still uses pre-start rows", () => {
  const rows = combined(
    [["alpha", 2, 2], ["beta", 2, 2], ["gamma", 2, 2]],
    [["alpha", 1.9, 2.1], ["beta", 1.91, 2.09], ["gamma", 1.89, 2.11]],
    "2026-08-05T13:55:00.000Z"
  );
  const before = buildMarketMicrostructure(rows, { eventId, market: "h2h", selection: "Home", generatedAt: "2026-08-05T13:59:00.000Z" });
  const after = buildMarketMicrostructure(rows, { eventId, market: "h2h", selection: "Home", generatedAt: "2026-08-05T14:01:00.000Z" });
  assert.equal(before.selections[0].closing, null);
  assert.ok(after.selections[0].closing);
  assert.equal(after.selections[0].closing.capturedBeforeStart, true);
  assert.equal(after.selections[0].leakageBoundary.postStartRowsUsed, false);
});

test("storage patch is service-only, immutable-oriented and pre-start constrained", async () => {
  const sql = await source("scripts/apply-market-microstructure-v2.sql");
  assert.match(sql, /create table if not exists public\.market_provider_snapshots_v2/);
  assert.match(sql, /captured_at < commence_time/);
  assert.match(sql, /unique \(source_id, source_reference\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /revoke all privileges .* public, anon, authenticated/i);
  assert.match(sql, /grant all privileges .* service_role/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*\b(anon|authenticated)\b/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from/i);
});

test("worker, public audit, event UI and docs preserve the safety boundary", async () => {
  const [worker, api, eventPanel, page, workflow, docs] = await Promise.all([
    source("app/api/internal/market-microstructure/route.js"),
    source("app/api/market-microstructure/route.js"),
    source("app/event/[eventId]/EventMarketMicrostructurePanel.jsx"),
    source("app/market-microstructure/MarketMicrostructureClient.jsx"),
    source(".github/workflows/market-microstructure.yml"),
    source("docs/MARKET_MICROSTRUCTURE_V2.md")
  ]);
  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /sourceCanCollect/);
  assert.match(worker, /rawPayloadStored: false/);
  assert.match(worker, /closingInjectedIntoPrematchModel: false/);
  assert.match(api, /Access-Control-Allow-Origin/);
  assert.match(api, /buildMarketMicrostructure/);
  assert.match(eventPanel, /sharpMoneyClaim=false/);
  assert.match(page, /Closing line/);
  assert.match(workflow, /api\/internal\/market-microstructure/);
  assert.match(docs, /never claims `sharp money`/i);
  for (const text of [api, eventPanel, page, docs]) {
    assert.doesNotMatch(text, /ODDS_API_KEY|SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET=/);
  }
});
