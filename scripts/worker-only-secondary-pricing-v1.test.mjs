import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeSecondaryPricingIntoCaptureLedger } from "../lib/unified-capture-ledger-merge-v1.mjs";
import {
  enrichPickForUnifiedCapture,
  enrichPicksForUnifiedCapture,
  UNIFIED_CAPTURE_CONCURRENCY
} from "../lib/unified-capture-enrichment-v1.mjs";
import {
  secondaryProviderAcquisitionMode,
  workerOnlySecondaryProviderState
} from "../lib/secondary-provider-acquisition-policy-v1.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function basePick() {
  return {
    id: "evt-1",
    gameId: "evt-1",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Home FC",
    sportKey: "soccer_usa_mls",
    league: "soccer_usa_mls",
    leagueTitle: "MLS",
    commenceTime: "2026-08-10T18:00:00.000Z",
    odds: 2.1,
    marketAverageOdds: 2.0,
    consensusProbability: 0.5,
    modelProbability: 0.5,
    productDecision: "CAUTION",
    decision: "WATCH",
    paperStake: 7.5,
    contextImpact: -0.004,
    unifiedSportsData: {
      version: "unified-sports-data-v1",
      selectionSide: "home",
      currentDecision: "CAUTION",
      totalBoundedContextImpact: -0.004,
      coverage: {
        totalFamilies: 2,
        configuredFamilies: 2,
        usedFamilies: 1,
        coverageRate: 1,
        verifiedCoverageRate: 0.5,
        sourceCount: 1,
        independentOddsProviders: 1
      },
      factors: [
        {
          key: "odds-consensus",
          title: "Multi-provider odds consensus",
          status: "primary-only",
          confidence: 0.7,
          trust: 0.75,
          impact: 0,
          useMode: "market-probability",
          usedByAi: true,
          downgradeEligible: false,
          sources: [{ id: "odds:primary", provider: "the-odds-api", trust: 0.82 }],
          evidence: [
            { label: "primaryMarketAverage", value: 2.0 },
            { label: "independentOddsProviders", value: 1 },
            { label: "providerDisagreement", value: null }
          ],
          missing: ["independent secondary odds provider match"]
        },
        {
          key: "weather",
          title: "Outdoor weather",
          status: "live",
          confidence: 0.8,
          trust: 0.8,
          impact: -0.004,
          useMode: "explanation-and-risk",
          usedByAi: true,
          downgradeEligible: false,
          sources: [{ id: "weather:open-meteo", provider: "open-meteo", trust: 0.8 }],
          evidence: [{ severity: 0.2 }],
          missing: []
        }
      ],
      sources: [{ id: "odds:primary", provider: "the-odds-api", trust: 0.82 }],
      safetyRecommendation: { action: "KEEP_CURRENT_DECISION", upgraded: false },
      aiExplanation: { explanation: ["public explanation remains unchanged"] },
      missingData: [{ factor: "odds-consensus", missing: "independent secondary odds provider match" }],
      paperOnly: true
    },
    unifiedDataProviders: {
      primaryOdds: { source: "the-odds-api", mode: "live" },
      weather: { source: "open-meteo", mode: "live", ok: true }
    }
  };
}

function liveSecondary() {
  return {
    ok: true,
    source: "sportsgameodds",
    mode: "live",
    retrievedAt: "2026-08-09T08:00:00.000Z",
    matchConfidence: 0.91,
    data: {
      home: { average: 2.2, latestAt: "2026-08-09T07:59:00.000Z" },
      away: { average: 1.8, latestAt: "2026-08-09T07:59:00.000Z" }
    }
  };
}

test("public/default acquisition mode is worker-only and explicitly network-free", () => {
  assert.equal(secondaryProviderAcquisitionMode({ authorizedCapture: false }), "worker-only");
  const state = workerOnlySecondaryProviderState({ retrievedAt: "2026-08-09T08:00:00.000Z" });
  assert.equal(state.mode, "worker_only");
  assert.equal(state.networkRequestMade, false);
  assert.equal(state.data, null);
});

test("capture ledger merge changes secondary odds evidence without changing decision semantics", () => {
  const pick = basePick();
  const before = structuredClone(pick.unifiedSportsData);
  const result = mergeSecondaryPricingIntoCaptureLedger({
    pick,
    baseLedger: pick.unifiedSportsData,
    secondaryOdds: liveSecondary(),
    now: Date.parse("2026-08-09T08:00:00.000Z")
  });

  assert.equal(result.merged, true);
  assert.equal(result.reason, "secondary-pricing-verified");
  assert.equal(result.ledger.coverage.independentOddsProviders, 2);
  assert.equal(result.ledger.totalBoundedContextImpact, before.totalBoundedContextImpact);
  assert.deepEqual(result.ledger.safetyRecommendation, before.safetyRecommendation);
  assert.deepEqual(result.ledger.aiExplanation, before.aiExplanation);
  assert.deepEqual(
    result.ledger.factors.find((factor) => factor.key === "weather"),
    before.factors.find((factor) => factor.key === "weather")
  );
  const odds = result.ledger.factors.find((factor) => factor.key === "odds-consensus");
  assert.equal(odds.status, "verified-multi-provider");
  assert.equal(odds.evidence.find((row) => row.label === "independentOddsProviders")?.value, 2);
  assert.equal(result.ledger.captureEvidence.probabilityChanged, false);
  assert.equal(result.ledger.captureEvidence.decisionChanged, false);
  assert.equal(result.ledger.captureEvidence.stakeChanged, false);
  assert.equal(result.ledger.captureEvidence.contextImpactChanged, false);
  assert.equal(result.ledger.captureEvidence.publicExplanationRewritten, false);
});

test("protected capture enrichment preserves public pick probability, decision and stake", async () => {
  const pick = basePick();
  const enriched = await enrichPickForUnifiedCapture(pick, {
    now: Date.parse("2026-08-09T08:00:00.000Z"),
    fetchSecondary: async () => liveSecondary()
  });

  assert.equal(enriched.consensusProbability, pick.consensusProbability);
  assert.equal(enriched.modelProbability, pick.modelProbability);
  assert.equal(enriched.productDecision, pick.productDecision);
  assert.equal(enriched.decision, pick.decision);
  assert.equal(enriched.paperStake, pick.paperStake);
  assert.equal(enriched.contextImpact, pick.contextImpact);
  assert.equal(enriched.unifiedSportsData.coverage.independentOddsProviders, 2);
  assert.equal(enriched.unifiedDataProviders.secondaryOdds.mode, "live");
  assert.equal(enriched.secondaryPricingAcquisition, "live-worker-capture");
});

test("capture concurrency remains bounded", async () => {
  const picks = Array.from({ length: 12 }, (_, index) => ({ ...basePick(), id: `evt-${index}`, gameId: `evt-${index}` }));
  let active = 0;
  let maxActive = 0;
  const output = await enrichPicksForUnifiedCapture(picks, {
    concurrency: UNIFIED_CAPTURE_CONCURRENCY,
    enrichPick: async (pick) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return pick;
    }
  });
  assert.equal(output.length, 12);
  assert.ok(maxActive <= UNIFIED_CAPTURE_CONCURRENCY);
});

test("public unified service does not opt in to live SportsGameOdds acquisition", async () => {
  const service = await source("lib/unified-sports-data-service.js");
  const loader = await source("lib/agent-intelligence-loader.js");
  assert.match(service, /allowLiveSecondaryPricing\s*=\s*false/);
  assert.match(service, /allowLiveSecondaryPricing\s*\?\s*fetchSportsGameOddsForMatch/);
  assert.match(service, /workerOnlySecondaryProviderState/);
  assert.doesNotMatch(loader, /allowLiveSecondaryPricing\s*:\s*true/);
});

test("protected worker enriches only after CRON authorization guard", async () => {
  const route = await source("app/api/internal/unified-data/route.js");
  const unauthorized = route.indexOf("if (!authorized(request))");
  const enrichment = route.indexOf("enrichPicksForUnifiedCapture(publicPicks");
  assert.ok(unauthorized >= 0);
  assert.ok(enrichment > unauthorized);
  assert.match(route, /version:\s*"unified-sports-data-worker-v3"/);
  assert.match(route, /acquisition:\s*"protected-worker-only"/);
  assert.doesNotMatch(route, /SPORTSGAMEODDS_API_KEY/);
});
