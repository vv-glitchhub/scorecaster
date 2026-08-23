import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_CENTER_VERSION,
  buildGameCenterEvents,
  filterGameCenterEvents,
  normalizeGameCenterDecision,
  summarizeGameCenter
} from "../lib/game-center-v1.mjs";

function pick(overrides = {}) {
  return {
    id: "event-1-home",
    gameId: "event-1",
    match: "Home – Away",
    homeTeam: "Home",
    awayTeam: "Away",
    leagueTitle: "Veikkausliiga",
    sportKey: "soccer_finland_veikkausliiga",
    commenceTime: "2026-08-22T17:00:00.000Z",
    selection: "Home",
    productDecision: "PLAY",
    edge: 0.04,
    trustScore: 78,
    confidence: 0.71,
    ...overrides
  };
}

test("Game Center groups selections and preserves server ranking", () => {
  const first = pick({ selection: "Home", edge: 0.02, productDecision: "PLAY" });
  const second = pick({ id: "event-1-away", selection: "Away", edge: 0.12, productDecision: "SKIP" });
  const events = buildGameCenterEvents([first, second]);

  assert.equal(GAME_CENTER_VERSION, "scorecaster-game-center-v1");
  assert.equal(events.length, 1);
  assert.equal(events[0].selections.length, 2);
  assert.equal(events[0].primarySelection.selection, "Home");
  assert.equal(events[0].decision, "PLAY");
  assert.deepEqual(events[0].selections, [first, second]);
});

test("Game Center search, decision and date filters compose without mutating input", () => {
  const today = new Date(2026, 7, 22, 12, 0, 0);
  const tomorrow = new Date(2026, 7, 23, 18, 0, 0).toISOString();
  const events = buildGameCenterEvents([
    pick({ commenceTime: new Date(2026, 7, 22, 17, 0, 0).toISOString() }),
    pick({ id: "event-2-away", gameId: "event-2", match: "Lynx – Aces", homeTeam: "Lynx", awayTeam: "Aces", leagueTitle: "WNBA", sportKey: "basketball_wnba", selection: "Aces", productDecision: "CAUTION", commenceTime: tomorrow })
  ]);
  const original = structuredClone(events);

  assert.equal(filterGameCenterEvents(events, { query: "lynx", now: today }).length, 1);
  assert.equal(filterGameCenterEvents(events, { decision: "PLAY", now: today }).length, 1);
  assert.equal(filterGameCenterEvents(events, { time: "today", now: today }).length, 1);
  assert.equal(filterGameCenterEvents(events, { time: "tomorrow", now: today }).length, 1);
  assert.deepEqual(events, original);
});

test("Game Center sorts missing metrics last and never replaces them with zero", () => {
  const events = buildGameCenterEvents([
    pick({ gameId: "missing", id: "missing-pick", match: "Missing – Data", edge: null, trustScore: null }),
    pick({ gameId: "observed", id: "observed-pick", match: "Observed – Data", edge: -0.01, trustScore: 20 })
  ]);

  assert.equal(filterGameCenterEvents(events, { sort: "edge" })[0].id, "observed");
  assert.equal(events.find((event) => event.id === "missing").primarySelection.edge, null);
});

test("Game Center summarizes unique events and normalizes legacy decisions", () => {
  const events = buildGameCenterEvents([
    pick(),
    pick({ id: "event-1-away", selection: "Away" }),
    pick({ id: "event-2", gameId: "event-2", productDecision: "CAUTION" }),
    pick({ id: "event-3", gameId: "event-3", productDecision: "PASS" })
  ]);

  assert.deepEqual(summarizeGameCenter(events), { events: 3, play: 1, caution: 1, skip: 1 });
  assert.equal(normalizeGameCenterDecision("BET"), "PLAY");
  assert.equal(normalizeGameCenterDecision("PASS"), "SKIP");
});
