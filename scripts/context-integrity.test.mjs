import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedContextGovernance } from "../lib/agent-context-governance.mjs";
import {
  attachVerifiedSportsIntelligence,
  buildUnevaluatedSportsIntelligence,
  buildVerifiedSportsIntelligence
} from "../lib/verified-sports-intelligence.mjs";

const NOW = Date.parse("2026-07-17T12:00:00Z");
const source = (name, mode, data) => ({ ok: true, source: name, mode, data, retrievedAt: "2026-07-17T11:50:00Z" });

function pick(overrides = {}) {
  return {
    id: "event-1",
    match: "Home FC – Away FC",
    homeTeam: "Home FC",
    awayTeam: "Away FC",
    selection: "Home FC",
    odds: 2.2,
    consensusProbability: 0.5,
    modelProbability: 0.5,
    edge: 0.045,
    ev: 0.1,
    confidence: 0.78,
    trustScore: 80,
    commenceTime: "2026-07-17T14:00:00Z",
    ...overrides
  };
}

test("unavailable providers create no evidence or numeric adjustment", () => {
  const report = buildVerifiedSportsIntelligence({
    news: source("none", "not_configured", []),
    injuries: source("none", "not_configured", []),
    lineup: source("none", "not_configured", {}),
    externalMarkets: source("none", "disabled", []),
    commenceTime: "2026-07-18T12:00:00Z",
    now: NOW
  });

  assert.equal(report.status, "unavailable");
  assert.equal(report.evidence.length, 0);
  assert.equal(report.coverageScore, 0);
  assert.equal(report.probabilityAdjusted, false);
  assert.equal(report.edgeAdjusted, false);
  assert.equal(report.evAdjusted, false);
  assert.equal(report.externalMarketUsedForDecision, false);
});

test("live records become bounded sourced evidence", () => {
  const report = buildVerifiedSportsIntelligence({
    news: source("news-feed", "live", [{ title: "Home FC update", description: "Preparation update", source: "Wire Service", publishedAt: "2026-07-17T10:00:00Z", sourceTrust: 0.9 }]),
    injuries: source("injury-feed", "live", [{ name: "Player One", team: "Home FC", status: "Out", injury: "Leg", source: "injury-feed", sourceTrust: 0.85, updatedAt: "2026-07-17T11:00:00Z" }]),
    lineup: source("lineup-feed", "live", { startersConfirmed: true, keyPlayersAvailable: true, source: "lineup-feed", sourceTrust: 0.9, updatedAt: "2026-07-17T11:30:00Z" }),
    externalMarkets: source("external", "disabled", []),
    commenceTime: "2026-07-18T12:00:00Z",
    now: NOW
  });

  assert.equal(report.status, "verified");
  assert.ok(report.evidence.some((item) => item.category === "news"));
  assert.ok(report.evidence.some((item) => item.category === "injury"));
  assert.ok(report.evidence.some((item) => item.category === "lineup"));
  assert.equal(report.probabilityAdjusted, false);
});

test("near kickoff missing critical feeds creates a safety gate", () => {
  const report = buildVerifiedSportsIntelligence({
    news: source("news-feed", "live", []),
    injuries: source("none", "not_configured", []),
    lineup: source("none", "not_configured", {}),
    externalMarkets: source("none", "disabled", []),
    commenceTime: "2026-07-17T14:00:00Z",
    now: NOW
  });

  assert.equal(report.playGate.blocked, true);
  assert.ok(report.playGate.reasons.some((item) => /lineup/i.test(item)));
  assert.ok(report.playGate.reasons.some((item) => /injury/i.test(item)));
});

test("attaching context preserves probability, edge and expected value", () => {
  const original = pick();
  const attached = attachVerifiedSportsIntelligence(
    original,
    buildVerifiedSportsIntelligence({ commenceTime: original.commenceTime, now: NOW })
  );

  assert.equal(attached.consensusProbability, original.consensusProbability);
  assert.equal(attached.modelProbability, original.modelProbability);
  assert.equal(attached.edge, original.edge);
  assert.equal(attached.ev, original.ev);
  assert.equal(attached.probabilityAdjustedByContext, false);
});

test("context governance only downgrades and removes planned allocation", () => {
  const report = {
    ...buildUnevaluatedSportsIntelligence("2026-07-17T14:00:00Z", NOW),
    playGate: { blocked: true, reasons: ["confirmed availability concern"] }
  };
  const [play, watch, skip] = applyVerifiedContextGovernance([
    { ...pick(), decision: "PLAY", suggestedStake: 10, allocatedStake: 10, verifiedIntelligence: report },
    { ...pick({ id: "event-2" }), decision: "WATCH", suggestedStake: 0, verifiedIntelligence: report },
    { ...pick({ id: "event-3" }), decision: "SKIP", suggestedStake: 0, verifiedIntelligence: report }
  ]);

  assert.equal(play.decision, "WATCH");
  assert.equal(play.suggestedStake, 0);
  assert.equal(play.allocatedStake, 0);
  assert.equal(watch.decision, "WATCH");
  assert.equal(skip.decision, "SKIP");
  assert.equal(play.contextGovernance.decisionPromoted, false);
  assert.equal(play.contextGovernance.probabilityAdjusted, false);
});
