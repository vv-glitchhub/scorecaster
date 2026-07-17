import test from "node:test";
import assert from "node:assert/strict";
import {
  applyEvidenceGate,
  buildIntelligenceReadiness
} from "../lib/intelligence-readiness.mjs";

const NOW = Date.parse("2026-07-17T12:00:00Z");

function liveIntelligence() {
  return {
    news: {
      ok: true,
      mode: "live",
      source: "newsapi",
      data: [{ title: "Match preview", publishedAt: "2026-07-17T08:00:00Z" }]
    },
    injuries: {
      ok: true,
      mode: "live",
      source: "sportsdata",
      data: [{ name: "Player", updatedAt: "2026-07-17T07:00:00Z" }]
    },
    lineup: {
      ok: true,
      mode: "live",
      source: "lineup-provider",
      data: { startersConfirmed: true, updatedAt: "2026-07-17T11:00:00Z" }
    }
  };
}

test("fully verified evidence requires fresh news, injuries and confirmed lineup", () => {
  const readiness = buildIntelligenceReadiness(liveIntelligence(), { now: NOW });
  assert.equal(readiness.level, "verified");
  assert.equal(readiness.score, 1);
  assert.equal(readiness.fullyVerified, true);
  assert.deepEqual(readiness.missing, []);
});

test("not configured or stale providers remain market-only or partial", () => {
  const intelligence = liveIntelligence();
  intelligence.news = { ok: true, mode: "not_configured", source: "news-provider", data: [] };
  intelligence.lineup.data.updatedAt = "2026-07-10T11:00:00Z";

  const readiness = buildIntelligenceReadiness(intelligence, { now: NOW });
  assert.equal(readiness.level, "partial");
  assert.equal(readiness.fullyVerified, false);
  assert.ok(readiness.missing.includes("fresh independent match news"));
  assert.ok(readiness.missing.includes("confirmed starting lineup"));
});

test("market consensus alone cannot produce PLAY", () => {
  const pick = { productDecision: "PLAY", decision: "BET", sourceTrust: 0.9 };
  const gated = applyEvidenceGate(pick, {
    level: "market-only",
    missing: ["fresh independent match news"]
  });

  assert.equal(gated.productDecision, "CAUTION");
  assert.equal(gated.decision, "WATCH");
  assert.equal(gated.independentEvidenceVerified, false);
  assert.match(gated.evidenceGateReason, /market consensus alone cannot produce PLAY/i);
});

test("verified evidence preserves a valid PLAY decision", () => {
  const pick = { productDecision: "PLAY", decision: "BET", sourceTrust: 0.7 };
  const gated = applyEvidenceGate(pick, { level: "verified", fullyVerified: true });
  assert.equal(gated.productDecision, "PLAY");
  assert.equal(gated.decision, "BET");
  assert.equal(gated.independentEvidenceVerified, true);
});
