import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RISK_LAB_ABSOLUTE_CAPS,
  buildStakePlan,
  calculateKellyFraction,
  runRiskLab
} from "../lib/risk-lab-v1.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function pick(overrides = {}) {
  return {
    id: "pick-1",
    eventId: "event-1",
    sport: "soccer_epl",
    league: "Premier League",
    selection: "Arsenal",
    bookmaker: "alpha",
    odds: 2,
    modelProbability: 0.55,
    marketProbability: 0.5,
    ...overrides
  };
}

test("Kelly calculation is exact and negative Kelly creates no stake", () => {
  assert.equal(calculateKellyFraction({ odds: 2, probability: 0.55 }), 0.1);
  assert.equal(calculateKellyFraction({ odds: 2, probability: 0.45 }), 0);
  const plan = buildStakePlan({ picks: [pick({ modelProbability: 0.45 })], bankroll: 1000, kellyMode: "full" });
  assert.equal(plan.picks[0].stake, 0);
  assert.equal(plan.safety.negativeKellyCreatesStake, false);
});

test("hard caps cannot be overridden by Kelly or client configuration", () => {
  const plan = buildStakePlan({
    picks: [pick({ odds: 3, modelProbability: 0.8 })],
    bankroll: 1000,
    kellyMode: "full",
    riskProfile: "balanced",
    caps: { selection: 0.5, daily: 0.9, league: 0.9, portfolio: 0.9 }
  });
  assert.equal(plan.caps.selection, RISK_LAB_ABSOLUTE_CAPS.selection);
  assert.equal(plan.caps.daily, RISK_LAB_ABSOLUTE_CAPS.daily);
  assert.equal(plan.caps.league, RISK_LAB_ABSOLUTE_CAPS.league);
  assert.equal(plan.caps.portfolio, RISK_LAB_ABSOLUTE_CAPS.portfolio);
  assert.equal(plan.picks[0].finalFraction, 0.01);
  assert.equal(plan.picks[0].stake, 10);
  assert.equal(plan.overrideAttempts.length, 4);
  assert.equal(plan.safety.capOverridesAllowed, false);
});

test("league and portfolio caps scale exposure proportionally", () => {
  const leaguePicks = Array.from({ length: 4 }, (_, index) => pick({
    id: `league-pick-${index}`,
    eventId: `league-event-${index}`,
    selection: `League selection ${index}`,
    odds: 3,
    modelProbability: 0.8
  }));
  const leaguePlan = buildStakePlan({ picks: leaguePicks, bankroll: 1000, kellyMode: "full", riskProfile: "balanced" });
  assert.ok(leaguePlan.exposure.plannedFraction <= 0.0250001);
  assert.equal(leaguePlan.exposure.plannedStake, 25);
  assert.ok(leaguePlan.picks.every((item) => item.capReasons.includes("league-cap")));

  const portfolioPicks = Array.from({ length: 6 }, (_, index) => pick({
    id: `portfolio-pick-${index}`,
    eventId: `portfolio-event-${index}`,
    league: `League ${index}`,
    selection: `Portfolio selection ${index}`,
    odds: 3,
    modelProbability: 0.8
  }));
  const portfolioPlan = buildStakePlan({ picks: portfolioPicks, bankroll: 1000, kellyMode: "full", riskProfile: "balanced" });
  assert.ok(portfolioPlan.exposure.plannedFraction <= 0.0500001);
  assert.ok(portfolioPlan.exposure.plannedStake <= 50.01);
  assert.ok(portfolioPlan.picks.every((item) => item.capReasons.includes("portfolio-cap")));
});

test("same-event and unknown correlation reduce rather than increase stake", () => {
  const independent = buildStakePlan({
    picks: [pick({ eventId: "event-a", correlationGroup: "a" })],
    bankroll: 1000,
    kellyMode: "quarter"
  });
  const correlated = buildStakePlan({
    picks: [
      pick({ id: "a", eventId: "event-a", selection: "Home", correlationGroup: "same" }),
      pick({ id: "b", eventId: "event-a", selection: "Over", correlationGroup: "same" })
    ],
    bankroll: 1000,
    kellyMode: "quarter"
  });
  const unknown = buildStakePlan({
    picks: [pick({ eventId: "event-a", correlationGroup: "a", correlationUnknown: true })],
    bankroll: 1000,
    kellyMode: "quarter"
  });
  assert.ok(correlated.picks[0].correlationPenalty < independent.picks[0].correlationPenalty);
  assert.ok(correlated.picks[0].afterCorrelation < independent.picks[0].afterCorrelation);
  assert.ok(unknown.picks[0].afterCorrelation < independent.picks[0].afterCorrelation);
  assert.equal(correlated.safety.correlationCanIncreaseStake, false);
});

test("same seed and inputs produce identical distributions", () => {
  const input = {
    picks: [pick(), pick({ id: "pick-2", eventId: "event-2", selection: "Chelsea", odds: 2.4, modelProbability: 0.46 })],
    bankroll: 1000,
    simulations: 250,
    rounds: 20,
    seed: "repeatable-seed",
    kellyMode: "quarter",
    riskProfile: "conservative"
  };
  const first = runRiskLab(input);
  const second = runRiskLab(input);
  assert.deepEqual(first.stakePlan, second.stakePlan);
  assert.deepEqual(first.scenarios, second.scenarios);
  assert.equal(first.safety.randomSeedReproducible, true);
});

test("Risk Lab compares bounded Kelly, flat staking and zero-bet baseline", () => {
  const result = runRiskLab({
    picks: [pick()],
    bankroll: 1000,
    simulations: 200,
    rounds: 10,
    seed: "comparison"
  });
  assert.equal(result.ok, true);
  assert.equal(result.paperOnly, true);
  assert.equal(result.scenarios.length, 4);
  for (const scenario of result.scenarios) {
    assert.equal(scenario.selectedKelly.simulations, 200);
    assert.equal(scenario.flatStaking.simulations, 200);
    assert.equal(scenario.zeroBet.endingBankroll.median, 1000);
    assert.equal(scenario.zeroBet.riskOfRuin, 0);
  }
  assert.equal(result.safety.guaranteedProfitClaim, false);
  assert.equal(result.safety.realMoneyExecution, false);
});

test("invalid and incomplete selections fail closed", () => {
  const result = runRiskLab({ picks: [pick({ eventId: "", odds: 1, modelProbability: null })] });
  assert.equal(result.ok, false);
  assert.equal(result.stakePlan.eligible, 0);
  assert.equal(result.stakePlan.rejected.length, 1);
  assert.ok(result.stakePlan.rejected[0].errors.includes("invalid-odds"));
  assert.ok(result.stakePlan.rejected[0].errors.includes("invalid-model-probability"));
  assert.ok(result.stakePlan.rejected[0].errors.includes("missing-event-id"));
});

test("API, UI, docs and navigation preserve the paper-only boundary", async () => {
  const [api, ui, docs, shell] = await Promise.all([
    source("app/api/risk-lab/route.js"),
    source("app/risk-lab/RiskLabClient.jsx"),
    source("docs/BANKROLL_RISK_LAB_V1.md"),
    source("app/components/AppShell.jsx")
  ]);
  assert.match(api, /mutationOriginAllowed/);
  assert.match(api, /readJsonBody\(request, 96 \* 1024\)/);
  assert.match(api, /hardCapsCanBeOverridden: false/);
  assert.match(ui, /\/api\/risk-lab/);
  assert.match(ui, /Simulaatio ei lupaa tuottoa/);
  assert.match(ui, /hardCapsCanBeOverridden=false/);
  assert.match(docs, /no guaranteed-profit claim/i);
  assert.match(docs, /same generated outcomes/i);
  assert.match(shell, /href: "\/risk-lab"/);
  for (const text of [api, ui, docs]) {
    assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET=/);
  }
});
