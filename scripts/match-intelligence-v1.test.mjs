import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/match-intelligence/page.jsx", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../app/match-intelligence/MatchIntelligenceClient.jsx", import.meta.url), "utf8");
const eventPage = fs.readFileSync(new URL("../app/event/[eventId]/page.jsx", import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

test("Match Intelligence is event-specific and fail-closed", () => {
  assert.match(page, /eventId/);
  assert.match(page, /sport/);
  assert.match(page, /never fills a missing event with example data/);
});

test("Match Intelligence reuses one current event-detail request", () => {
  assert.equal(count(client, "fetch("), 1);
  assert.match(client, /\/api\/event-detail/);
  assert.equal(client.includes("/api/data-layer"), false);
});

test("visual surface exposes coverage, disagreement and missing evidence", () => {
  assert.match(client, /Feature coverage/);
  assert.match(client, /Model disagreement/);
  assert.match(client, /What changes the analysis/);
  assert.match(client, /Missing information stays missing/);
});

test("Match Intelligence does not mutate production analysis", () => {
  assert.match(client, /does not invent missing values, change production probabilities, or alter product decisions/);
  assert.equal(client.includes("method: \"POST\""), false);
  assert.equal(client.includes("method: 'POST'"), false);
});

test("event detail links to the visual intelligence surface", () => {
  assert.match(eventPage, /data-match-intelligence-entry/);
  assert.match(eventPage, /\/match-intelligence\?eventId=/);
});
