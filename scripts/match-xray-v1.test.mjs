import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMatchXRay, MATCH_XRAY_VERSION } from "../lib/match-xray-engine.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const generatedAt = "2026-08-05T04:00:00.000Z";
const kickoffAt = "2026-08-05T18:00:00.000Z";

const home = {
  team: "Home FC",
  rating: 1640,
  attack: 68,
  defense: 63,
  form: 0.16,
  sampleSize: 14,
  sourceId: "test-source",
  observedAt: "2026-08-04T12:00:00.000Z",
  windowStart: "2026-05-01T00:00:00.000Z",
  windowEnd: "2026-08-04T12:00:00.000Z",
  xgFor: 1.72,
  xgAgainst: 1.05,
  shotsFor: 13.2,
  shotsAgainst: 9.8,
  possession: 55,
  pressIntensity: 62,
  transitionThreat: 57,
  setPieceThreat: 54
};

const away = {
  team: "Away FC",
  rating: 1540,
  attack: 57,
  defense: 55,
  form: -0.04,
  sampleSize: 12,
  sourceId: "test-source",
  observedAt: "2026-08-04T12:30:00.000Z",
  windowStart: "2026-05-01T00:00:00.000Z",
  windowEnd: "2026-08-04T12:30:00.000Z",
  xgFor: 1.31,
  xgAgainst: 1.42,
  shotsFor: 10.6,
  shotsAgainst: 12.1,
  possession: 48,
  pressIntensity: 51,
  transitionThreat: 53,
  setPieceThreat: 49
};

function build(overrides = {}) {
  return buildMatchXRay({
    homeTeam: home,
    awayTeam: away,
    generatedAt,
    kickoffAt,
    ...overrides
  });
}

function total(probabilities) {
  return probabilities.home + probabilities.draw + probabilities.away;
}

test("Match X-Ray is deterministic, normalized and auditable", () => {
  const first = build();
  const second = build();
  assert.equal(first.ok, true);
  assert.equal(first.xrayVersion, MATCH_XRAY_VERSION);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(total(first.model.probabilities) - 1) < 0.00001);
  assert.equal(first.audit.reproducible, true);
  assert.equal(first.audit.inventedMetrics, false);
  assert.equal(first.paperOnly, true);
  assert.match(first.decisionAuthority, /cannot independently promote PLAY/);
});

test("timestamped source metadata is mandatory", () => {
  const missingSource = build({ homeTeam: { ...home, sourceId: null } });
  assert.equal(missingSource.ok, false);
  assert.equal(missingSource.reason, "missing-evidence-metadata");
  assert.ok(missingSource.missingEvidence.includes("home.sourceId"));

  const missingTimestamp = build({ awayTeam: { ...away, observedAt: null } });
  assert.equal(missingTimestamp.ok, false);
  assert.ok(missingTimestamp.missingEvidence.includes("away.observedAt"));
});

test("future and post-kickoff evidence fail closed", () => {
  const future = build({ homeTeam: { ...home, observedAt: "2026-08-06T00:00:00.000Z" } });
  assert.equal(future.ok, false);
  assert.equal(future.reason, "chronology-violation");
  assert.ok(future.chronologyErrors.includes("home.observedAt-after-generatedAt"));

  const postKickoff = build({
    generatedAt: "2026-08-06T00:00:00.000Z",
    awayTeam: { ...away, observedAt: "2026-08-05T18:01:00.000Z" }
  });
  assert.equal(postKickoff.ok, false);
  assert.ok(postKickoff.chronologyErrors.includes("away.post-kickoff-evidence"));
});

test("small samples visibly shrink form toward neutral", () => {
  const result = build({ homeTeam: { ...home, form: 0.2, sampleSize: 2 } });
  assert.equal(result.ok, true);
  assert.equal(result.teams.home.sampleWeight, 0.25);
  assert.equal(result.audit.inputsSnapshot.home.rawForm, 60);
  assert.equal(result.audit.inputsSnapshot.home.adjustedForm, 52.5);
  assert.equal(result.teams.home.sampleWarning, "very-small-sample");
  assert.ok(result.risks.some((risk) => risk.id.includes("sample-very-small")));
});

test("optional tactical evidence is used only when supplied", () => {
  const complete = build();
  assert.ok(complete.matchupEvidence.some((row) => row.id === "observed-xg-matchup-gap"));
  assert.ok(complete.matchupEvidence.some((row) => row.id === "home-press-vs-away-transition"));
  assert.equal(complete.unknowns.length, 0);

  const sparse = build({
    awayTeam: {
      ...away,
      xgFor: null,
      xgAgainst: null,
      shotsFor: null,
      shotsAgainst: null,
      possession: null,
      pressIntensity: null,
      transitionThreat: null,
      setPieceThreat: null
    }
  });
  assert.equal(sparse.ok, true);
  assert.ok(!sparse.matchupEvidence.some((row) => row.id === "observed-xg-matchup-gap"));
  assert.ok(sparse.unknowns.some((item) => item.includes("xG for")));
  assert.equal(sparse.audit.inventedMetrics, false);
  assert.ok(sparse.evidenceQuality.optionalMetricCoverage < complete.evidenceQuality.optionalMetricCoverage);
});

test("scoreline grid is reproducible and reports outside probability mass", () => {
  const result = build();
  assert.equal(result.scorelineMatrix.rows.length, 6);
  assert.equal(result.scorelineMatrix.rows[0].cells.length, 6);
  assert.ok(result.scorelineMatrix.coveredProbabilityMass > 0.9);
  assert.ok(result.scorelineMatrix.outsideGridProbability >= 0);
  assert.ok(result.scorelineMatrix.outsideGridProbability < 0.1);
});

test("sensitivity scenarios remain separate from observed evidence", () => {
  const result = build();
  const neutral = result.scenarios.find((item) => item.id === "neutral-venue");
  const formNeutralized = result.scenarios.find((item) => item.id === "form-neutralized");
  assert.ok(neutral);
  assert.ok(formNeutralized);
  assert.equal(neutral.status, "sensitivity-test-not-observed-evidence");
  assert.ok(neutral.probabilities.home < result.model.probabilities.home);
  assert.notDeepEqual(formNeutralized.probabilities, result.model.probabilities);
});

test("public route, UI and documentation preserve the safety boundary", async () => {
  const [api, client, docs] = await Promise.all([
    file("app/api/xray/route.js"),
    file("app/xray/MatchXRayClient.jsx"),
    file("docs/MATCH_XRAY_V1.md")
  ]);
  assert.match(api, /getSupabaseAdmin/);
  assert.match(api, /\.from\("team_ratings"\)/);
  assert.match(api, /closingLineUsed: false/);
  assert.match(api, /postKickoffDataUsed: false/);
  assert.match(api, /inventedMetrics: false/);
  assert.doesNotMatch(api, /closing_odds|closing_line|settled_at/);
  assert.match(client, /\/api\/xray/);
  assert.match(client, /Puuttuvaa taktiikka- tai kontekstidataa ei keksitä/);
  assert.match(docs, /does not connect to a bookmaker account/i);
  assert.match(docs, /not yet league-calibrated/i);
});
