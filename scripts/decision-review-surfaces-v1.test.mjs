import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOutcomeReview } from "../lib/outcome-review-v1.mjs";
import { buildChampionChallengerScorecard } from "../lib/champion-challenger-v1.mjs";

test("Outcome Review distinguishes good losses from bad wins", () => {
  const review = buildOutcomeReview([
    { outcomeValue: 0, priceClv: 0.03, brier: 0.22 },
    { outcomeValue: 1, priceClv: -0.02, brier: 0.31 },
    { outcomeValue: 1, priceClv: 0.01, brier: 0.18 },
    { outcomeValue: 0, priceClv: -0.01, brier: 0.27 }
  ]);
  const byKey = new Map(review.buckets.map((item) => [item.key, item]));
  assert.equal(byKey.get("good-process-bad-outcome").count, 1);
  assert.equal(byKey.get("weak-process-good-outcome").count, 1);
  assert.equal(review.contracts.outcomeDoesNotRetroactivelyChangeDecision, true);
  assert.equal(review.contracts.automaticModelPromotionAllowed, false);
  assert.equal(review.contracts.realMoneyActionAvailable, false);
});

test("Champion / Challenger keeps no-vig market as benchmark and queues only skill-qualified challengers", () => {
  const scorecard = buildChampionChallengerScorecard({
    models: [
      {
        modelId: "qualified-model",
        modelVersion: "v2",
        sport: "soccer",
        sampleSize: 150,
        brier: 0.19,
        logLoss: 0.55,
        calibrationGap: 0.03,
        marketBenchmark: {
          sampleSize: 150,
          brierSkillScore: 0.08,
          logLossImprovement: 0.04,
          skillClaimAllowed: true,
          reviewEligible: true,
          fullComparableSample: true,
          beatsMarketOnBrier: true,
          beatsMarketOnLogLoss: true
        }
      },
      {
        modelId: "small-sample-model",
        modelVersion: "v1",
        sport: "soccer",
        sampleSize: 30,
        marketBenchmark: {
          sampleSize: 30,
          brierSkillScore: 0.2,
          logLossImprovement: 0.1,
          skillClaimAllowed: false,
          reviewEligible: false,
          fullComparableSample: true
        }
      }
    ]
  });
  assert.equal(scorecard.champion.modelId, "no-vig-market-consensus");
  assert.equal(scorecard.reviewQueue.length, 1);
  assert.equal(scorecard.reviewQueue[0].modelId, "qualified-model");
  assert.equal(scorecard.contracts.automaticPromotionAllowed, false);
  assert.equal(scorecard.contracts.rankingCanChangeProductionProbability, false);
  assert.equal(scorecard.contracts.rankingCanUpgradeDecision, false);
});

test("Calibration Center only labels strong/weak slices from usable samples", async () => {
  const source = await readFile(new URL("../app/calibration-center/CalibrationCenterV2Client.jsx", import.meta.url), "utf8");
  assert.match(source, /row\.sampleStatus\?\.level === "usable"/);
  assert.match(source, /Strongest usable league/);
  assert.match(source, /Weakest usable league/);
  assert.match(source, /automaticPromotion=false/);
  assert.match(source, /productionProbabilityChanged=false/);
});

test("Bookmaker Intelligence is personal closing-line research rather than a production gate", async () => {
  const source = await readFile(new URL("../app/bookmakers/BookmakerIntelligenceClient.jsx", import.meta.url), "utf8");
  assert.match(source, /your own Scorecaster paper history/i);
  assert.match(source, /does not claim a bookmaker is globally good or bad/i);
  assert.match(source, /decisionUpgradeAllowed=false/);
  assert.doesNotMatch(source, /placeBet|realMoneyActionAvailable\s*=\s*true/i);
});

test("event detail connects Match Journey, Recommendation Journey and post-settlement Story", async () => {
  const source = await readFile(new URL("../app/event/[eventId]/page.jsx", import.meta.url), "utf8");
  assert.match(source, /data-match-journey-story-v2="true"/);
  assert.match(source, /\/match-intelligence\?eventId=/);
  assert.match(source, /\/journey\?eventId=/);
  assert.match(source, /Match Story \/ paper history/);
  assert.match(source, /historical evidence is never reconstructed/i);
  assert.match(source, /decisionUpgradeAllowed=false/);
});

test("League Readiness clearly remains a current-window metric rather than a historical league ranking", async () => {
  const source = await readFile(new URL("../app/league-readiness/LeagueReadinessClient.jsx", import.meta.url), "utf8");
  assert.match(source, /current live recommendation window/i);
  assert.match(source, /not a historical league ranking/i);
  assert.match(source, /historicalLeagueQualityClaim=false/);
  assert.match(source, /decisionUpgradeAllowed=false/);
});

test("new review pages stay paper-only and expose no real-money action", async () => {
  const paths = [
    "../app/outcome-review/OutcomeReviewClient.jsx",
    "../app/bookmakers/BookmakerIntelligenceClient.jsx",
    "../app/calibration-center/CalibrationCenterV2Client.jsx",
    "../app/champion-challenger/ChampionChallengerClient.jsx",
    "../app/league-readiness/LeagueReadinessClient.jsx"
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /paper-only|paper history|paper evidence|paper process|paper-only/i);
    assert.doesNotMatch(source, /placeBet|bookmaker login|realMoneyActionAvailable\s*=\s*true/i);
  }
});
