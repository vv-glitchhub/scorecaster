import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyPolymarketSafety } from "../lib/polymarket-safety.mjs";

const root = new URL("../", import.meta.url);
async function source(path) { return readFile(new URL(path, root), "utf8"); }

function liveReport(overrides = {}) {
  return {
    ok: true,
    mode: "live",
    match: {
      homeTeam: "Boston Celtics",
      awayTeam: "New York Knicks"
    },
    data: [{
      id: "market-1",
      title: "Boston Celtics vs New York Knicks",
      homeProbability: 0.5,
      awayProbability: 0.5,
      matchConfidence: 0.92,
      liquidity: 5000,
      volume: 25000,
      mapping: "team-outcomes",
      ...overrides
    }]
  };
}

test("Polymarket fetcher uses public Gamma discovery and keeps trading disabled", async () => {
  const fetcher = await source("lib/polymarket-fetcher.js");
  assert.match(fetcher, /https:\/\/gamma-api\.polymarket\.com/);
  assert.match(fetcher, /new URL\("\/public-search", GAMMA_ORIGIN\)/);
  assert.match(fetcher, /url\.searchParams\.set\("q", query\)/);
  assert.match(fetcher, /events_status", "active"/);
  assert.match(fetcher, /marketDataOnly: true/);
  assert.match(fetcher, /scoreSettlementSource: false/);
  assert.match(fetcher, /tradingEnabled: false/);
  assert.match(fetcher, /walletRequired: false/);
  assert.doesNotMatch(fetcher, /private[_ -]?key|seed phrase|placeOrder|createOrder|walletAddress/i);
});

test("strong verified downside disagreement downgrades PLAY to CAUTION", () => {
  const result = applyPolymarketSafety({
    productDecision: "PLAY",
    decision: "BET",
    selection: "Boston Celtics",
    consensusProbability: 0.65,
    sourceTrust: 0.8,
    evidenceGateReason: "Sports evidence passed."
  }, liveReport());

  assert.equal(result.productDecision, "CAUTION");
  assert.equal(result.decision, "WATCH");
  assert.equal(result.polymarketSignal.strongDisagreement, true);
  assert.equal(result.polymarketSignal.difference, -0.15);
  assert.equal(result.polymarketUsedForUpgrade, false);
  assert.equal(result.probabilityAdjustedByPolymarket, false);
  assert.equal(result.scoreSettledByPolymarket, false);
  assert.match(result.evidenceGateReason, /Polymarket was 15\.0 percentage points below/);
});

test("Polymarket agreement or optimism never upgrades a decision", () => {
  const result = applyPolymarketSafety({
    productDecision: "CAUTION",
    decision: "WATCH",
    selection: "Boston Celtics",
    consensusProbability: 0.55,
    sourceTrust: 0.7
  }, liveReport({ homeProbability: 0.8, awayProbability: 0.2 }));

  assert.equal(result.productDecision, "CAUTION");
  assert.equal(result.decision, "WATCH");
  assert.equal(result.polymarketUsedForUpgrade, false);
  assert.equal(result.probabilityAdjustedByPolymarket, false);
});

test("missing or weak Polymarket data leaves the existing decision unchanged", () => {
  const missing = applyPolymarketSafety({
    productDecision: "PLAY",
    decision: "BET",
    selection: "Boston Celtics",
    consensusProbability: 0.65
  }, { ok: true, mode: "no_match", match: liveReport().match, data: [] });
  assert.equal(missing.productDecision, "PLAY");

  const weak = applyPolymarketSafety({
    productDecision: "PLAY",
    decision: "BET",
    selection: "Boston Celtics",
    consensusProbability: 0.65
  }, liveReport({ homeProbability: 0.4, awayProbability: 0.6, matchConfidence: 0.5, liquidity: 20, volume: 50 }));
  assert.equal(weak.productDecision, "PLAY");
  assert.equal(weak.polymarketSignal.marketQuality, false);
});

test("current Top Picks intelligence path applies Polymarket after sports evidence", async () => {
  const loader = await source("lib/agent-intelligence-loader.js");
  assert.match(loader, /fetchPolymarketForMatch/);
  assert.match(loader, /applySportsIntelligenceGate/);
  assert.match(loader, /applyPolymarketSafety/);
  assert.ok(loader.indexOf("applyPolymarketSafety") > loader.indexOf("applySportsIntelligenceGate"));
  assert.match(loader, /Promise\.all/);
});

test("protected API is authenticated, rate limited and read only", async () => {
  const route = await source("app/api/cloud/polymarket-intelligence/route.js");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket: "polymarket_intelligence"/);
  assert.match(route, /limit: 20/);
  assert.match(route, /windowSeconds: 300/);
  assert.match(route, /Unsupported query parameter/);
  assert.match(route, /decisionUse: "downgrade-only"/);
  assert.match(route, /officialScoreSource: false/);
  assert.doesNotMatch(route, /export async function POST|placeOrder|wallet/i);
});

test("Polymarket UI is trilingual and states the product boundary", async () => {
  const page = await source("app/polymarket-intelligence/page.jsx");
  const client = await source("app/polymarket-intelligence/PolymarketIntelligenceClient.jsx");
  const research = await source("app/ai-research/page.jsx");
  const shell = await source("app/components/AppShell.jsx");

  assert.match(page, /PolymarketIntelligenceClient/);
  assert.match(client, /fi:/);
  assert.match(client, /en:/);
  assert.match(client, /es:/);
  assert.match(client, /No wallet or orders/);
  assert.match(client, /Result source/);
  assert.match(client, /\/api\/cloud\/polymarket-intelligence/);
  assert.match(research, /status: "Active"/);
  assert.match(research, /href: "\/polymarket-intelligence"/);
  assert.match(shell, /href: "\/polymarket-intelligence"/);
});

test("Polymarket is not wired into paper result settlement", async () => {
  const settlement = await source("lib/paper-settlement-engine.mjs");
  const monitor = await source("lib/settlement-monitor.js");
  const manualRoute = await source("app/api/cloud/bets/settle/route.js");
  assert.doesNotMatch(settlement, /polymarket/i);
  assert.doesNotMatch(monitor, /polymarket/i);
  assert.doesNotMatch(manualRoute, /polymarket/i);
});
