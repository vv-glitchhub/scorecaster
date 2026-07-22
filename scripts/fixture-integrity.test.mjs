import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  filterUpcomingPicks,
  isUsableLiveFixture,
  kickoffTimestamp,
  withinUpcomingWindow
} from "../lib/fixture-integrity.mjs";

const NOW = Date.parse("2026-07-17T10:00:00Z");

function fixture(overrides = {}) {
  return {
    id: "event-123",
    sport_key: "soccer_epl",
    commence_time: "2026-07-18T10:00:00Z",
    home_team: "Home FC",
    away_team: "Away FC",
    bookmakers: [
      {
        key: "book-a",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Home FC", price: 2.1 },
              { name: "Away FC", price: 3.2 }
            ]
          }
        ]
      }
    ],
    ...overrides
  };
}

test("accepts a structurally valid live-provider fixture", () => {
  assert.equal(isUsableLiveFixture(fixture(), { now: NOW }), true);
});

test("rejects missing identity, teams, kickoff and usable odds markets", () => {
  assert.equal(isUsableLiveFixture(fixture({ id: "" }), { now: NOW }), false);
  assert.equal(isUsableLiveFixture(fixture({ home_team: "Away FC" }), { now: NOW }), false);
  assert.equal(isUsableLiveFixture(fixture({ commence_time: "not-a-date" }), { now: NOW }), false);
  assert.equal(isUsableLiveFixture(fixture({ bookmakers: [] }), { now: NOW }), false);
  assert.equal(isUsableLiveFixture(fixture({ bookmakers: [{ markets: [{ outcomes: [] }] }] }), { now: NOW }), false);
});

test("rejects old and implausibly distant provider rows", () => {
  assert.equal(
    isUsableLiveFixture(fixture({ commence_time: "2026-07-16T00:00:00Z" }), { now: NOW }),
    false
  );
  assert.equal(
    isUsableLiveFixture(fixture({ commence_time: "2026-10-01T00:00:00Z" }), { now: NOW, maxFutureHours: 24 * 45 }),
    false
  );
});

test("near-term windows do not turn distant fixtures into today's picks", () => {
  const near = { id: "near", commenceTime: "2026-07-19T09:00:00Z" };
  const distant = { id: "distant", commenceTime: "2026-08-21T18:00:00Z" };

  assert.equal(withinUpcomingWindow(near.commenceTime, 72, NOW), true);
  assert.equal(withinUpcomingWindow(distant.commenceTime, 72, NOW), false);
  assert.deepEqual(filterUpcomingPicks([near, distant], 72, NOW), [near]);
});

test("kickoff parser preserves missing or malformed values as unavailable", () => {
  assert.equal(kickoffTimestamp("2026-07-18T10:00:00Z"), Date.parse("2026-07-18T10:00:00Z"));
  assert.equal(kickoffTimestamp(""), null);
  assert.equal(kickoffTimestamp("not-a-date"), null);
});

test("Top Picks uses active summer leagues instead of off-season core defaults", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");

  for (const league of [
    "baseball_mlb",
    "basketball_wnba",
    "soccer_usa_mls",
    "soccer_finland_veikkausliiga",
    "soccer_sweden_allsvenskan",
    "soccer_norway_eliteserien"
  ]) {
    assert.match(route, new RegExp(league));
  }
  assert.match(route, /seasonForDate/);
  assert.match(route, /season-aware-default/);
  assert.match(route, /month >= 4 && month <= 7/);
});

test("Top Picks explains every SKIP without weakening the safety gate", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");

  assert.match(route, /Odds data is older than 12 hours/);
  assert.match(route, /Market-data confidence is below 35%/);
  assert.match(route, /Edge is below 0\.5%/);
  assert.match(route, /Expected value is not positive/);
  assert.match(route, /decisionReason/);
  assert.match(route, /skipReason/);
  assert.match(route, /gate\.watchable/);
  assert.match(route, /edge >= 0\.02 && ev >= 0\.03/);
});
