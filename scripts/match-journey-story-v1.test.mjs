import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMatchStoryV1, MATCH_STORY_VERSION } from "../lib/match-story-v1.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

test("Match Story keeps pending and missing closing evidence explicit", () => {
  const story = buildMatchStoryV1({
    result: "pending",
    odds: 2,
    closingOdds: "",
    edge: 0,
    ev: 0,
    stake: 10,
    decision: "CAUTION"
  });

  assert.equal(story.version, MATCH_STORY_VERSION);
  assert.equal(story.status, "awaiting-settlement");
  assert.equal(story.priceProcess.clv, null);
  assert.equal(story.priceProcess.closingOdds, null);
  assert.equal(story.outcome.profit, null);
  assert.equal(story.decisionSnapshot.edge, 0);
  assert.equal(story.decisionSnapshot.ev, 0);
  assert.deepEqual(story.missing, ["closing-odds", "settled-result"]);
  assert.equal(story.contract.missingClosingOddsImputed, false);
});

test("Match Story separates outcome from price process", () => {
  const aligned = buildMatchStoryV1({ result: "win", odds: 2.1, closingOdds: 2, stake: 10 });
  assert.equal(aligned.verdict, "process-and-outcome-aligned");
  assert.equal(aligned.priceProcess.state, "positive");
  assert.equal(aligned.priceProcess.clv, 0.050000000000000044);
  assert.equal(aligned.outcome.profit, 11);

  const goodPriceLoss = buildMatchStoryV1({ result: "loss", odds: 2.1, closingOdds: 2, stake: 10 });
  assert.equal(goodPriceLoss.verdict, "price-over-outcome");
  assert.equal(goodPriceLoss.learning.focus, "protect-process-from-outcome-bias");
  assert.equal(goodPriceLoss.outcome.profit, -10);

  const weakPriceWin = buildMatchStoryV1({ result: "win", odds: 1.9, closingOdds: 2, stake: 10 });
  assert.equal(weakPriceWin.verdict, "outcome-over-price");
  assert.equal(weakPriceWin.learning.focus, "review-entry-price-despite-win");
});

test("one Match Story result never mutates model authority", () => {
  const story = buildMatchStoryV1({ result: "win", odds: 2, closingOdds: 1.9, stake: 10, decision: "PLAY" });
  assert.equal(story.learning.sampleConclusion, "single-event-only");
  assert.equal(story.learning.probabilityChanged, false);
  assert.equal(story.learning.automaticModelPromotion, false);
  assert.equal(story.learning.automaticWeightChange, false);
  assert.equal(story.contract.paperOnly, true);
  assert.equal(story.contract.resultDoesNotProveModelSkill, true);
});

test("Match Journey reuses one verified event-detail request and remains read-only", async () => {
  const [client, journey] = await Promise.all([
    read("app/match-intelligence/MatchIntelligenceClient.jsx"),
    read("app/match-intelligence/MatchJourneyV1.jsx")
  ]);

  assert.equal(count(client, "fetch("), 1);
  assert.match(client, /\/api\/event-detail/);
  assert.match(client, /<MatchJourneyV1/);
  assert.match(client, /data-match-journey-loading/);
  assert.match(journey, /data-match-journey-v1/);
  assert.match(journey, /data-journey-primary-decision/);
  assert.match(journey, /data-journey-alternatives/);
  assert.match(journey, /data-match-journey-boundary/);
  assert.match(journey, /selections\.find/);
  assert.match(journey, /selections\[0\]/);
  assert.doesNotMatch(journey, /\.sort\(/);
  assert.doesNotMatch(client + journey, /method:\s*["']POST["']/);
});

test("Match Story is embedded in local paper tracking without a provider request", async () => {
  const [tracking, story, eventPage] = await Promise.all([
    read("app/tracking/page.jsx"),
    read("app/tracking/MatchStoryCard.jsx"),
    read("app/event/[eventId]/page.jsx")
  ]);

  assert.match(tracking, /import MatchStoryCard/);
  assert.match(tracking, /<MatchStoryCard bet=\{bet\}/);
  assert.match(tracking, /clv === null \? "—"/);
  assert.match(story, /buildMatchStoryV1/);
  assert.match(story, /data-match-story-v1/);
  assert.match(story, /data-match-story-missing/);
  assert.match(story, /One result is an observation, not proof of model skill/);
  assert.doesNotMatch(story, /fetch\(/);
  assert.match(eventPage, /Match Journey \+ Story V2/);
  assert.match(eventPage, /data-match-journey-story-v2/);
  assert.match(eventPage, /Open Match Journey/);
});

test("the selected market survives Event Detail, Match Journey and Match Story navigation", async () => {
  const [eventPage, journeyPage, journeyClient, story] = await Promise.all([
    read("app/event/[eventId]/page.jsx"),
    read("app/match-intelligence/page.jsx"),
    read("app/match-intelligence/MatchIntelligenceClient.jsx"),
    read("app/tracking/MatchStoryCard.jsx")
  ]);

  assert.match(eventPage, /const encodedSelection = encodeURIComponent\(selection\)/);
  assert.match(eventPage, /selection=\$\{encodedSelection\}/);
  assert.match(journeyPage, /selection=\$\{encodeURIComponent\(selection\)\}/);
  assert.match(journeyPage, /selection=\{selection\}/);
  assert.match(journeyClient, /query\.set\("selection", selection\)/);
  assert.match(story, /encodeURIComponent\(bet\.selection\)/);
});
