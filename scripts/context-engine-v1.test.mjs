import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildContextEngine, CONTEXT_ENGINE_VERSION } from "../lib/context-engine.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const generatedAt = "2026-08-05T08:00:00.000Z";
const kickoffAt = "2026-08-05T18:00:00.000Z";
const eventId = "epl:arsenal-chelsea:2026-08-05";
const baselineInput = {
  homeTeam: { team: "Arsenal", rating: 1680, attack: 72, defense: 69, form: 0.12 },
  awayTeam: { team: "Chelsea", rating: 1600, attack: 66, defense: 62, form: 0.04 },
  neutralVenue: false,
  trainingEvidence: { sampleScore: 0, calibrationScore: 0 }
};

function evidence(overrides = {}) {
  return {
    id: "ctx-1",
    eventId,
    teamRole: "home",
    team: "Arsenal",
    category: "lineup",
    subject: "Starting goalkeeper",
    status: "available",
    confirmation: "confirmed",
    impact: 0.5,
    confidence: 0.9,
    sourceTrust: 0.9,
    sourceId: "scorecaster_internal",
    observedAt: "2026-08-05T07:30:00.000Z",
    publicNote: "Confirmed in the normalized event record.",
    ...overrides
  };
}

function build(overrides = {}) {
  return buildContextEngine({
    eventId,
    kickoffAt,
    generatedAt,
    baselineInput,
    evidence: [evidence()],
    ...overrides
  });
}

function probabilityTotal(result, key) {
  return Object.values(result[key].probabilities).reduce((sum, value) => sum + value, 0);
}

test("Context Engine is deterministic, normalized and paper-only", () => {
  const first = build();
  const second = build();
  assert.deepEqual(first, second);
  assert.equal(first.ok, true);
  assert.equal(first.version, CONTEXT_ENGINE_VERSION);
  assert.equal(first.paperOnly, true);
  assert.match(first.decisionAuthority, /cannot independently promote PLAY/);
  assert.ok(Math.abs(probabilityTotal(first, "before") - 1) < 0.00001);
  assert.ok(Math.abs(probabilityTotal(first, "after") - 1) < 0.00001);
  assert.ok(first.teamRatingDelta.home > 0);
  assert.ok(first.probabilityDelta.home > 0);
  assert.equal(first.safety.realMoneyExecution, false);
});

test("future, post-kickoff and stale evidence is rejected and never applied", () => {
  const result = build({
    evidence: [
      evidence({ id: "future", observedAt: "2026-08-05T09:00:00.000Z" }),
      evidence({ id: "post", observedAt: "2026-08-05T18:01:00.000Z" }),
      evidence({ id: "stale", category: "weather", teamRole: "event", observedAt: "2026-08-04T01:00:00.000Z" })
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.accepted.length, 0);
  assert.equal(result.evidence.rejected.length, 3);
  assert.deepEqual(result.before.probabilities, result.after.probabilities);
  assert.equal(result.safety.futureEvidenceUsed, false);
  assert.equal(result.safety.postKickoffEvidenceUsed, false);
  assert.equal(result.safety.staleEvidenceUsed, false);
});

test("materially conflicting evidence is withheld rather than averaged", () => {
  const result = build({
    evidence: [
      evidence({ id: "available", status: "available", impact: 0.7 }),
      evidence({ id: "out", status: "out", impact: -0.7, observedAt: "2026-08-05T07:31:00.000Z" })
    ]
  });
  assert.equal(result.contextStatus, "conflicted");
  assert.equal(result.evidence.accepted.length, 0);
  assert.equal(result.evidence.conflicts.length, 1);
  assert.equal(result.teamRatingDelta.home, 0);
  assert.deepEqual(result.before.probabilities, result.after.probabilities);
});

test("confirmation state changes weight without being relabelled", () => {
  const confirmed = build({ evidence: [evidence({ confirmation: "confirmed" })] });
  const rumor = build({ evidence: [evidence({ confirmation: "rumor" })] });
  assert.equal(confirmed.evidence.accepted[0].confirmation, "confirmed");
  assert.equal(rumor.evidence.accepted[0].confirmation, "rumor");
  assert.ok(confirmed.evidence.accepted[0].evidenceWeight > rumor.evidence.accepted[0].evidenceWeight);
  assert.ok(Math.abs(confirmed.teamRatingDelta.home) > Math.abs(rumor.teamRatingDelta.home));
  assert.equal(rumor.safety.unconfirmedPresentedAsConfirmed, false);
});

test("unknown and non-production sources fail closed", () => {
  const result = build({
    evidence: [
      evidence({ id: "unknown", sourceId: "unknown_feed" }),
      evidence({ id: "research", sourceId: "statsbomb_open" })
    ]
  });
  assert.equal(result.evidence.accepted.length, 0);
  assert.ok(result.evidence.rejected.some((item) => item.errors.includes("source-unknown-source")));
  assert.ok(result.evidence.rejected.some((item) => item.errors.includes("source-research-only")));
});

test("missing context remains visible and lowers evidence quality", () => {
  const empty = build({ evidence: [] });
  const fuller = build({
    evidence: [
      evidence(),
      evidence({ id: "rest", category: "rest", subject: "Rest days", status: "4 days", impact: 0.2 }),
      evidence({ id: "travel", category: "travel", subject: "Travel load", status: "low", impact: 0.1 }),
      evidence({ id: "weather", category: "weather", teamRole: "event", subject: "Wind", status: "calm", impact: 0.05 })
    ]
  });
  assert.equal(empty.contextStatus, "missing");
  assert.ok(empty.unknowns.length >= 6);
  assert.ok(fuller.evidence.evidenceQuality > empty.evidence.evidenceQuality);
  assert.ok(empty.evidence.coverage.every((item) => item.status === "missing"));
});

test("SQL storage is service-only, timestamped and bounded", async () => {
  const sql = await source("supabase/scorecaster_context_engine_v1.sql");
  assert.match(sql, /create table if not exists public\.context_evidence_v1/);
  assert.match(sql, /observed_at timestamptz not null/);
  assert.match(sql, /observed_at < kickoff_at/);
  assert.match(sql, /confirmation in \('confirmed', 'probable', 'unconfirmed', 'rumor'\)/);
  assert.match(sql, /impact >= -1 and impact <= 1/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /revoke all privileges .* public, anon, authenticated/i);
  assert.match(sql, /grant all privileges .* service_role/i);
  assert.doesNotMatch(sql, /grant\s+(select|insert|update|delete).*\b(anon|authenticated)\b/i);
  assert.doesNotMatch(sql, /drop\s+table|truncate\s+table|delete\s+from/i);
});

test("public API, UI and docs preserve the audit and safety boundary", async () => {
  const [api, client, docs, shell] = await Promise.all([
    source("app/api/context/route.js"),
    source("app/context/ContextEngineClient.jsx"),
    source("docs/CONTEXT_ENGINE_V1.md"),
    source("app/components/AppShell.jsx")
  ]);
  assert.match(api, /\.from\("context_evidence_v1"\)/);
  assert.match(api, /\.from\("team_ratings"\)/);
  assert.match(api, /requiredMigration/);
  assert.match(api, /Access-Control-Allow-Origin/);
  assert.match(client, /\/api\/context/);
  assert.match(client, /Rajattu kontekstiesikatselu/);
  assert.match(docs, /does not independently promote PLAY/i);
  assert.match(docs, /corrections append a new row/i);
  assert.match(shell, /href: "\/context"/);
  for (const text of [api, client, docs]) {
    assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE_KEY|ODDS_API_KEY|CRON_SECRET/);
  }
});
