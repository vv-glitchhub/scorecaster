import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeContextBatch, CONTEXT_INGESTION_VERSION } from "../lib/context-ingestion.mjs";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const events = [{
  eventId: "event-1",
  sport: "soccer_epl",
  league: "Premier League",
  homeTeam: "Arsenal",
  awayTeam: "Chelsea",
  kickoffAt: "2026-08-05T18:00:00.000Z"
}];
const base = {
  eventId: "event-1",
  teamRole: "home",
  team: "Arsenal",
  category: "lineup",
  subject: "Starting goalkeeper",
  status: "confirmed starter",
  confirmation: "confirmed",
  impact: 0.3,
  confidence: 0.9,
  sourceTrust: 0.9,
  sourceId: "manual_licensed_import",
  observedAt: "2026-08-05T16:00:00.000Z",
  sourceReference: "manual:1"
};

function normalize(records, overrides = {}) {
  return normalizeContextBatch(records, {
    events,
    collectedAt: "2026-08-05T17:00:00.000Z",
    sourceId: "manual_licensed_import",
    env: { NODE_ENV: "production" },
    ...overrides
  });
}

test("governed context records normalize to server storage rows", () => {
  const result = normalize([base]);
  assert.equal(result.version, CONTEXT_INGESTION_VERSION);
  assert.equal(result.received, 1);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].row.event_id, "event-1");
  assert.equal(result.accepted[0].row.source_id, "manual_licensed_import");
  assert.equal(result.accepted[0].row.source_reference, "manual:1");
  assert.equal(result.accepted[0].row.kickoff_at, "2026-08-05T18:00:00.000Z");
  assert.equal(result.paperOnly, true);
});

test("expected minutes and role importance derive a bounded impact", () => {
  const result = normalize([{
    ...base,
    sourceReference: "manual:minutes",
    impact: undefined,
    expectedMinutesDelta: -60,
    minutesBaseline: 90,
    roleImportance: 0.9,
    highImpactRole: "goalkeeper"
  }]);
  assert.equal(result.accepted.length, 1);
  assert.ok(result.accepted[0].row.impact < -0.59);
  assert.ok(result.accepted[0].row.impact >= -1);
  assert.match(result.accepted[0].row.public_note, /expected minutes delta -60/);
  assert.match(result.accepted[0].row.public_note, /goalkeeper/);
});

test("post-kickoff, future, unknown-event and research records fail closed", () => {
  const result = normalize([
    { ...base, sourceReference: "post", observedAt: "2026-08-05T18:01:00.000Z" },
    { ...base, sourceReference: "future", observedAt: "2026-08-05T17:30:00.000Z" },
    { ...base, sourceReference: "unknown", eventId: "missing-event" },
    { ...base, sourceReference: "research", sourceId: "statsbomb_open" }
  ]);
  assert.equal(result.accepted.length, 0);
  assert.ok(result.rejected.some((item) => item.errors.includes("post-kickoff-observation")));
  assert.ok(result.rejected.some((item) => item.errors.includes("future-observation")));
  assert.ok(result.rejected.some((item) => item.errors.includes("unknown-event")));
  assert.ok(result.rejected.some((item) => item.errors.some((error) => error.includes("research-only"))));
});

test("duplicate provider references are rejected inside one batch", () => {
  const result = normalize([base, { ...base }]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].errors, ["duplicate-in-batch"]);
});

test("confirmation states remain explicit and corrections reference earlier records", () => {
  const result = normalize([{
    ...base,
    sourceReference: "manual:2",
    supersedesSourceReference: "manual:1",
    confirmation: "unconfirmed"
  }]);
  assert.equal(result.accepted[0].row.confirmation, "unconfirmed");
  assert.equal(result.accepted[0].supersedesSourceReference, "manual:1");
});

test("worker, health, operator API and event UI preserve safety boundaries", async () => {
  const [worker, health, operator, eventPage, panel, workflow, provider] = await Promise.all([
    source("app/api/internal/context-ingestion/route.js"),
    source("app/api/context/health/route.js"),
    source("app/api/cloud/context-evidence/route.js"),
    source("app/event/[eventId]/page.jsx"),
    source("app/event/[eventId]/EventContextPanel.jsx"),
    source(".github/workflows/context-ingestion.yml"),
    source("lib/context-json-provider.js")
  ]);

  assert.match(worker, /request\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`/);
  assert.match(worker, /context_evidence_v1/);
  assert.match(worker, /probabilityChanged: false/);
  assert.match(worker, /rawPayloadStored: false/);
  assert.match(health, /directBrowserWrite: false/);
  assert.match(operator, /SCORECASTER_OPERATOR_EMAILS/);
  assert.match(operator, /manual_licensed_import/);
  assert.match(operator, /mutationOriginAllowed/);
  assert.match(eventPage, /EventContextPanel/);
  assert.match(panel, /cannot promote PLAY by itself/);
  assert.match(workflow, /cron: "22,52 \* \* \* \*"/);
  assert.match(workflow, /api\/internal\/context-ingestion/);
  assert.match(provider, /scorecaster-context-provider-contract-v1/);
  assert.match(provider, /rawPayloadRequested: false/);

  for (const text of [worker, health, operator, panel, provider]) {
    assert.doesNotMatch(text, /console\.log\([^\n]*(CRON_SECRET|COLLECTOR_JSON_API_KEY|SUPABASE_SERVICE_ROLE_KEY)/);
  }
});
