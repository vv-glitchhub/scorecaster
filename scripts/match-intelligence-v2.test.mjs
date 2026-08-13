import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../app/match-intelligence/MatchIntelligenceClient.jsx", import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

test("Match Intelligence V2 keeps exactly one event-detail fetch", () => {
  assert.equal(count(client, "fetch("), 1);
  assert.match(client, /\/api\/event-detail/);
  assert.equal(client.includes("/api/data-layer"), false);
});

test("V2 uses shared language and professional mode providers", () => {
  assert.match(client, /useLanguage/);
  assert.match(client, /useProfessionalPreferences/);
  assert.match(client, /toggleProMode/);
  assert.match(client, /data-match-intelligence-mode-toggle/);
});

test("V2 exposes team comparison and Model Room without zero-imputing unavailable form data", () => {
  assert.match(client, /data-team-comparison/);
  assert.match(client, /formRest\.status === "ready"/);
  assert.match(client, /ready \? team\?\.sampleSize : null/);
  assert.match(client, /data-model-room/);
  assert.match(client, /Independent research models/);
});

test("Pro-only model detail remains conditional", () => {
  assert.match(client, /proMode \? \(/);
  assert.match(client, /ModelRoom models=\{models\}/);
});

test("V2 preserves the read-only production boundary", () => {
  assert.equal(client.includes("method: \"POST\""), false);
  assert.equal(client.includes("method: 'POST'"), false);
  assert.match(client, /does not invent missing values, change production probabilities, or alter product decisions/);
  assert.match(client, /Market benchmark/);
  assert.match(client, /automatic promotion/);
});
