import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTransparent1X2, TRANSPARENT_1X2_MODEL_VERSION } from "../lib/transparent-1x2-engine.mjs";

const root = new URL("../", import.meta.url);
const file = (path) => readFile(new URL(path, root), "utf8");
const generatedAt = "2026-08-05T04:00:00.000Z";

const strongHome = { team: "Strong Home", rating: 1700, attack: 76, defense: 71, form: 0.12 };
const weakAway = { team: "Weak Away", rating: 1450, attack: 44, defense: 42, form: -0.08 };
const balancedHome = { team: "Home", rating: 1550, attack: 58, defense: 56, form: 0.02 };
const balancedAway = { team: "Away", rating: 1540, attack: 57, defense: 57, form: 0.01 };

function build(overrides = {}) {
  return buildTransparent1X2({
    homeTeam: balancedHome,
    awayTeam: balancedAway,
    generatedAt,
    ...overrides
  });
}

function total(probabilities) {
  return probabilities.home + probabilities.draw + probabilities.away;
}

test("1X2 probabilities are deterministic, normalized and reproducible", () => {
  const first = build();
  const second = build();
  assert.equal(first.ok, true);
  assert.equal(first.modelVersion, TRANSPARENT_1X2_MODEL_VERSION);
  assert.deepEqual(first, second);
  assert.ok(Math.abs(total(first.probabilities) - 1) < 0.00001);
  assert.equal(first.paperOnly, true);
  assert.equal(first.calibrated, false);
  assert.match(first.decisionAuthority, /cannot independently promote PLAY/);
});

test("a much stronger home profile receives a higher home-win probability", () => {
  const result = build({ homeTeam: strongHome, awayTeam: weakAway });
  assert.ok(result.probabilities.home > result.probabilities.away);
  assert.ok(result.probabilities.home > 0.5);
  assert.ok(result.expectedGoals.home > result.expectedGoals.away);
  assert.ok(result.components.eloDavidson.ratingDifference > 0);
});

test("neutral venue removes the documented home advantage", () => {
  const homeVenue = build({ neutralVenue: false });
  const neutral = build({ neutralVenue: true });
  assert.ok(homeVenue.probabilities.home > neutral.probabilities.home);
  assert.equal(neutral.components.eloDavidson.homeAdvantageElo, 0);
  assert.equal(neutral.inputs.neutralVenue, true);
});

test("market odds remain a separate no-vig benchmark", () => {
  const withoutMarket = build();
  const withMarket = build({ marketOdds: { home: 2.2, draw: 3.4, away: 3.3 } });
  assert.deepEqual(withMarket.probabilities, withoutMarket.probabilities);
  assert.ok(Math.abs(total(withMarket.marketBenchmark.probabilities) - 1) < 0.00001);
  assert.ok(withMarket.marketBenchmark.overround > 0);
  assert.ok(withMarket.marketEdges);
});

test("fair odds are exact reciprocals of model probabilities", () => {
  const result = build();
  for (const key of ["home", "draw", "away"]) {
    assert.ok(Math.abs(result.fairOdds[key] - (1 / result.probabilities[key])) < 0.01);
  }
});

test("missing model inputs fail closed instead of using hidden defaults", () => {
  const result = build({ homeTeam: { team: "Incomplete", rating: 1500, attack: 50 } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing-required-inputs");
  assert.ok(result.missingInputs.includes("home.defense"));
  assert.ok(result.missingInputs.includes("home.form"));
});

test("scoreline matrix is ordered and covers practically all probability mass", () => {
  const result = build();
  assert.equal(result.mostLikelyScorelines.length, 8);
  for (let index = 1; index < result.mostLikelyScorelines.length; index += 1) {
    assert.ok(result.mostLikelyScorelines[index - 1].probability >= result.mostLikelyScorelines[index].probability);
  }
  assert.ok(result.components.poisson.coveredProbabilityMass > 0.999);
});

test("baseline discloses weights, limitations and no fitted-confidence claim", () => {
  const result = build();
  assert.equal(result.components.eloDavidson.weight, 0.45);
  assert.equal(result.components.poisson.weight, 0.55);
  assert.ok(result.formulas.some((formula) => formula.includes("Davidson")));
  assert.ok(result.formulas.some((formula) => formula.includes("Poisson")));
  assert.ok(result.limitations.some((item) => item.includes("not yet passed league-specific chronological calibration")));
  assert.match(result.probabilityBands.home.method, /not a fitted statistical confidence interval/);
});

test("public API excludes closing lines and post-kickoff data", async () => {
  const [api, client, docs] = await Promise.all([
    file("app/api/1x2/route.js"),
    file("app/probabilities/ProbabilityLabClient.jsx"),
    file("docs/TRANSPARENT_1X2_BASELINE_V1.md")
  ]);
  assert.match(api, /closingLineUsed: false/);
  assert.match(api, /postKickoffDataUsed: false/);
  assert.match(api, /canPromotePlayByItself: false/);
  assert.match(api, /\.from\("team_ratings"\)/);
  assert.doesNotMatch(api, /closing_odds|closing_line|settled_at/);
  assert.match(client, /Baseline ei ole vielä liigakohtaisesti kalibroitu/);
  assert.match(client, /\/api\/1x2/);
  assert.match(docs, /does not reproduce or claim access to Google's proprietary model/i);
});
