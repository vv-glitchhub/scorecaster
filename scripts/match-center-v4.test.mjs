import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildVerifiedStandings, VERIFIED_EVENT_HISTORY_VERSION } from "../lib/verified-event-history-v1.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function outcome(overrides = {}) {
  return {
    event_id: "event-1",
    sport_key: "soccer_epl",
    league: "Premier League",
    home_team: "Alpha",
    away_team: "Beta",
    commence_time: "2026-08-01T14:00:00Z",
    home_score: 2,
    away_score: 1,
    outcome: "home",
    confidence: 0.99,
    source_count: 2,
    finality_verified: true,
    ...overrides
  };
}

test("verified standings are deterministic and ignore non-final rows", () => {
  const rows = buildVerifiedStandings([
    outcome(),
    outcome({ event_id: "event-2", home_team: "Beta", away_team: "Gamma", home_score: 1, away_score: 1, outcome: "draw" }),
    outcome({ event_id: "event-3", home_team: "Gamma", away_team: "Alpha", home_score: 0, away_score: 3, outcome: "away" }),
    outcome({ event_id: "future-unverified", home_team: "Beta", away_team: "Alpha", home_score: 9, away_score: 0, finality_verified: false })
  ]);
  assert.equal(VERIFIED_EVENT_HISTORY_VERSION, "scorecaster-verified-event-history-v1");
  assert.equal(rows[0].team, "Alpha");
  assert.equal(rows[0].played, 2);
  assert.equal(rows[0].points, 6);
  assert.equal(rows.find((row) => row.team === "Beta").points, 1);
});

test("Match Center V4 consolidates verified match research without inventing unavailable data", async () => {
  const [page, center, route, history] = await Promise.all([
    read("app/event/[eventId]/page.jsx"),
    read("app/event/[eventId]/MatchCenterV4.jsx"),
    read("app/api/event-detail/route.js"),
    read("lib/verified-event-history-v1.mjs")
  ]);

  assert.match(page, /MatchCenterV4/);
  assert.match(page, /<MatchCenterV4 eventId=\{eventId\} sport=\{sport\} selection=\{selection\}/);
  assert.match(center, /data-match-center-v4/);
  for (const token of ["summary", "form", "lineups", "h2h", "standings", "players", "markets"]) assert.match(center, new RegExp(`\\"${token}\\"`));
  assert.match(center, /\/api\/event-detail/);
  assert.match(center, /cache: "no-store"/);
  assert.match(center, /verified data required/);
  assert.match(center, /A predicted XI is never invented/);
  assert.match(center, /Head to head/);
  assert.match(center, /derived from Scorecaster verified final results/);
  assert.match(center, /paper only/);
  assert.match(route, /loadVerifiedEventHistoryV1/);
  assert.match(route, /verifiedEventHistoryVersion/);
  assert.match(history, /finality_verified/);
  assert.match(history, /\.lt\("commence_time", cutoffIso\)/);
  assert.match(history, /rawProviderPayloadIncluded:\s*false/);
  assert.doesNotMatch(center, /window\.location|bookmaker.*(?:login|password)|placeBet|deposit|withdraw/i);
});
