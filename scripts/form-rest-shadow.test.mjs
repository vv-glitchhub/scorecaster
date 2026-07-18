import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  attachFormRestShadow,
  buildFormRestShadowSnapshot,
  compactFormRestFeatureSnapshot
} from "../lib/form-rest-shadow-model.mjs";
import {
  buildFormRestShadowLab,
  normalizeFormRestShadowSamples
} from "../lib/form-rest-shadow-lab.mjs";

const NOW = Date.parse("2026-07-18T12:00:00Z");
const KICKOFF = "2026-07-20T18:00:00Z";

function event(id, date, home, away, homeScore, awayScore) {
  return { id, source: "thesportsdb", date, time: "18:00:00", home_team: home, away_team: away, home_score: homeScore, away_score: awayScore, is_finished: true };
}

const results = [
  event("h1", "2026-07-17", "Home Team", "Alpha", 4, 1),
  event("h2", "2026-07-14", "Beta", "Home Team", 1, 3),
  event("h3", "2026-07-11", "Home Team", "Gamma", 2, 1),
  event("h4", "2026-07-08", "Delta", "Home Team", 2, 1),
  event("a1", "2026-07-16", "Away Team", "Echo", 1, 3),
  event("a2", "2026-07-13", "Foxtrot", "Away Team", 4, 2),
  event("a3", "2026-07-10", "Away Team", "Golf", 3, 2),
  event("a4", "2026-07-07", "Hotel", "Away Team", 2, 2),
  event("future", "2026-07-22", "Home Team", "Away Team", 99, 0)
];

function pick(overrides = {}) {
  return {
    id: "event-1",
    gameId: "event-1",
    sportKey: "icehockey_nhl",
    league: "icehockey_nhl",
    homeTeam: "Home Team",
    awayTeam: "Away Team",
    selection: "Home Team",
    commenceTime: KICKOFF,
    consensusProbability: 0.54,
    modelProbability: 0.54,
    edge: 0.04,
    ev: 0.06,
    decision: "BET",
    productDecision: "PLAY",
    ...overrides
  };
}

function provider(overrides = {}) {
  return { ok: true, source: "thesportsdb", mode: "live", leagueKey: "NHL", retrievedAt: new Date(NOW).toISOString(), resultCount: results.length, results, ...overrides };
}

test("NHL snapshot uses only completed results before kickoff and stays shadow-only", () => {
  const snapshot = buildFormRestShadowSnapshot({ pick: pick(), provider: provider(), now: NOW });
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.mode, "binary-shadow");
  assert.equal(snapshot.home.sampleSize, 4);
  assert.equal(snapshot.away.sampleSize, 4);
  assert.equal(snapshot.home.recentEventIds.includes("future"), false);
  assert.equal(snapshot.away.recentEventIds.includes("future"), false);
  assert.ok(snapshot.shadowProbability > 0 && snapshot.shadowProbability < 1);
  assert.equal(snapshot.marketProbability, 0.54);
  assert.equal(snapshot.probabilityAppliedToProduction, false);
  assert.equal(snapshot.usedForDecision, false);
  assert.equal(snapshot.chronologyGuard, true);
});

test("attaching a snapshot preserves market probability, edge, EV and decision", () => {
  const source = pick();
  const attached = attachFormRestShadow(source, provider(), NOW);
  assert.equal(attached.modelProbability, source.modelProbability);
  assert.equal(attached.consensusProbability, source.consensusProbability);
  assert.equal(attached.edge, source.edge);
  assert.equal(attached.ev, source.ev);
  assert.equal(attached.decision, source.decision);
  assert.equal(attached.productDecision, source.productDecision);
  assert.equal(attached.independentProbabilityApplied, false);
});

test("soccer remains feature-only and never produces a fake binary probability", () => {
  const soccer = buildFormRestShadowSnapshot({
    pick: pick({ sportKey: "soccer_epl", league: "soccer_epl" }),
    provider: provider({ leagueKey: "EPL" }),
    now: NOW
  });
  assert.equal(soccer.mode, "feature-only");
  assert.equal(soccer.status, "feature_only");
  assert.equal(soccer.shadowProbability, null);
  assert.equal(soccer.usedForDecision, false);
});

test("compact snapshot always forces audit-only flags", () => {
  const compact = compactFormRestFeatureSnapshot({
    ...buildFormRestShadowSnapshot({ pick: pick(), provider: provider(), now: NOW }),
    probabilityAppliedToProduction: true,
    usedForDecision: true,
    chronologyGuard: false
  });
  assert.equal(compact.probabilityAppliedToProduction, false);
  assert.equal(compact.usedForDecision, false);
  assert.equal(compact.chronologyGuard, true);
});

function settledRow(index, audited = true) {
  const won = index % 2 === 0;
  const snapshot = compactFormRestFeatureSnapshot(buildFormRestShadowSnapshot({
    pick: pick({ consensusProbability: 0.48 + (index % 5) * 0.02, modelProbability: 0.48 + (index % 5) * 0.02 }),
    provider: provider(),
    now: NOW
  }));
  snapshot.shadowProbability = won ? 0.62 : 0.38;
  snapshot.marketProbability = 0.5;
  snapshot.status = "ready";
  return {
    id: `row-${String(index).padStart(3, "0")}`,
    status: won ? "won" : "lost",
    result: won ? "win" : "loss",
    created_at: new Date(Date.parse("2026-01-01T00:00:00Z") + index * 86400000).toISOString(),
    raw_pick: {
      featureSnapshot: snapshot,
      featureSnapshotSource: audited ? "server-top-picks" : "client",
      featureSnapshotStoredAt: new Date(Date.parse("2026-01-01T00:00:00Z") + index * 86400000).toISOString()
    }
  };
}

test("shadow lab accepts only server-audited chronological samples", () => {
  const rows = [...Array.from({ length: 45 }, (_, index) => settledRow(index)), settledRow(99, false)];
  const samples = normalizeFormRestShadowSamples(rows);
  assert.equal(samples.length, 45);
  assert.ok(samples.every((item, index, values) => index === 0 || values[index - 1].timestamp <= item.timestamp));
  const report = buildFormRestShadowLab(rows, { minimumSamples: 40 });
  assert.equal(report.sampleSize, 45);
  assert.equal(report.trainSize + report.holdoutSize, 45);
  assert.equal(report.safety.chronologicalSplit, true);
  assert.equal(report.safety.serverVerifiedSnapshotsOnly, true);
  assert.equal(report.safety.probabilityAppliedToProduction, false);
  assert.equal(report.safety.automaticPromotionAvailable, false);
  assert.equal(report.promotion.eligible, false);
});

test("audited save route verifies current server analysis before attaching snapshot", async () => {
  const route = await readFile(new URL("../app/api/cloud/bets/audited/route.js", import.meta.url), "utf8");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const topPicksIndex = route.indexOf("const current = await loadCurrentPicks(request, bets)");
  const saveIndex = route.indexOf("savePaperBets(forwardedRequest");
  const updateIndex = route.indexOf("featureSnapshotSource: \"server-top-picks\"");
  assert.ok(authIndex >= 0);
  assert.ok(topPicksIndex > authIndex);
  assert.ok(saveIndex > topPicksIndex);
  assert.ok(updateIndex > saveIndex);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"cloud_bets_audited_create"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.doesNotMatch(route, /bet\.featureSnapshot/);
});

test("mobile routes Scorecaster saves to audited API while preserving manual saves", async () => {
  const api = await readFile(new URL("../mobile/src/lib/api.ts", import.meta.url), "utf8");
  assert.match(api, /startsWith\("scorecaster"\)/);
  assert.match(api, /"\/api\/cloud\/bets\/audited"/);
  assert.match(api, /return scorecasterOnly \? "\/api\/cloud\/bets\/audited" : path/);
});

test("protected lab queries only the authenticated user's settled rows", async () => {
  const route = await readFile(new URL("../app/api/agent/form-rest-lab/route.js", import.meta.url), "utf8");
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket:\s*"form_rest_shadow_lab"/);
  assert.match(route, /\.eq\("user_id", auth\.user\.id\)/);
  assert.match(route, /\.neq\("status", "open"\)/);
  assert.match(route, /buildFormRestShadowLab/);
});
