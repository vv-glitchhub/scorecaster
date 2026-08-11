import test from "node:test";
import assert from "node:assert/strict";
import { buildFeatureSnapshotV1, FEATURE_ENGINE_VERSION } from "../lib/feature-engine-v1.mjs";

const NOW = Date.parse("2026-08-11T07:00:00.000Z");

function basePick() {
  return {
    id: "event-1-home",
    gameId: "event-1",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Home FC",
    sportKey: "soccer_epl",
    leagueTitle: "Premier League",
    market: "h2h",
    commenceTime: "2026-08-11T18:00:00.000Z",
    odds: 1.91,
    marketProbability: 0.54,
    bookmakerCount: 7,
    lastUpdate: "2026-08-11T06:58:00.000Z",
    confidence: 0.82,
    unifiedDataGeneratedAt: "2026-08-11T06:59:00.000Z",
    unifiedSportsData: {
      coverage: {
        verifiedCoverageRate: 0.8,
        sourceCount: 6
      },
      factors: [
        {
          key: "odds-consensus",
          status: "verified-multi-provider",
          confidence: 0.9,
          trust: 0.86,
          impact: 0,
          usedByAi: true,
          sources: [{ provider: "the-odds-api", type: "odds_market", trust: 0.82, observedAt: "2026-08-11T06:58:00.000Z" }]
        },
        {
          key: "recent-form",
          status: "ready",
          confidence: 0.72,
          trust: 0.72,
          impact: 0.012,
          usedByAi: true,
          reason: "Five chronology-safe recent matches.",
          sources: [{ provider: "thesportsdb", type: "completed_results", trust: 0.72, observedAt: "2026-08-11T06:50:00.000Z" }]
        },
        {
          key: "injuries",
          status: "not-verified",
          confidence: 0,
          trust: 0,
          impact: 0,
          usedByAi: false,
          reason: "No verified injury provider."
        }
      ]
    },
    intelligenceFusionV2: {
      generatedAt: "2026-08-11T06:59:00.000Z",
      trust: { score: 0.79 },
      coverage: { coverageRate: 0.75, sourceCount: 6 },
      dataQualityGate: { safeForAi: true }
    },
    formRestShadow: {
      chronologyGuard: true,
      asOf: "2026-08-11T06:50:00.000Z",
      provider: { mode: "live", source: "thesportsdb", retrievedAt: "2026-08-11T06:50:00.000Z" },
      home: { sampleSize: 5 },
      away: { sampleSize: 5 },
      features: {
        homeFormAdvantage: 0.2,
        homeMarginAdvantage: 0.1,
        homeRestAdvantage: 0.25,
        homeCongestionAdvantage: -0.1
      }
    }
  };
}

test("Feature Engine V1 builds deterministic audited features without relabeling market data", () => {
  const first = buildFeatureSnapshotV1(basePick(), { now: NOW });
  const second = buildFeatureSnapshotV1(basePick(), { now: NOW });

  assert.equal(first.version, FEATURE_ENGINE_VERSION);
  assert.equal(first.snapshotHash, second.snapshotHash);
  assert.equal(first.contract.missingDataImputed, false);
  assert.equal(first.contract.marketBenchmarkRelabeledAsIndependentFeature, false);

  const selectedOdds = first.featureRows.find((row) => row.id === "selected-odds");
  assert.equal(selectedOdds.role, "market-benchmark");
  assert.equal(selectedOdds.eligibleForModel, false);

  const form = first.featureRows.find((row) => row.id === "recent-form-impact");
  assert.equal(form.status, "eligible");
  assert.equal(form.eligibleForModel, true);
  assert.equal(form.value, 0.012);

  const injury = first.featureRows.find((row) => row.id === "injury-impact");
  assert.equal(injury.status, "missing");
  assert.equal(injury.value, null);
  assert.ok(first.missingFeatures.some((row) => row.id === "injury-impact"));
});

test("Feature Engine V1 rejects future-dated audited custom inputs", () => {
  const pick = basePick();
  pick.modelFeatureInputs = [{
    id: "external-rating-delta",
    value: 0.4,
    family: "rating",
    source: "validated-rating-provider",
    observedAt: "2026-08-12T00:00:00.000Z",
    trust: 0.9,
    confidence: 0.9,
    audited: true
  }];

  const snapshot = buildFeatureSnapshotV1(pick, { now: NOW });
  const row = snapshot.featureRows.find((item) => item.id === "external-rating-delta");

  assert.equal(row.status, "rejected-future");
  assert.equal(row.eligibleForModel, false);
  assert.ok(row.reasons.includes("future-dated-source"));
  assert.equal(snapshot.contract.futureDataAccepted, false);
});

test("Feature Engine V1 never invents a missing market probability", () => {
  const pick = basePick();
  delete pick.marketProbability;
  const snapshot = buildFeatureSnapshotV1(pick, { now: NOW });
  const market = snapshot.featureRows.find((row) => row.id === "market-probability");

  assert.equal(market.value, null);
  assert.equal(market.status, "missing");
  assert.equal(snapshot.contract.missingDataImputed, false);
});
