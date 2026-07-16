import test from "node:test";
import assert from "node:assert/strict";
import {
  findScoreEventForBet,
  settlePaperBetFromScore
} from "../lib/paper-settlement-engine.mjs";

function completedEvent(overrides = {}) {
  return {
    id: "0123456789abcdef0123456789abcdef",
    sport_key: "icehockey_nhl",
    completed: true,
    commence_time: "2026-07-15T18:00:00Z",
    home_team: "Tampere Lynx",
    away_team: "Helsinki Bears",
    scores: [
      { name: "Tampere Lynx", score: "4" },
      { name: "Helsinki Bears", score: "2" }
    ],
    last_update: "2026-07-15T21:00:00Z",
    ...overrides
  };
}

function paperBet(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    client_ref: "0123456789abcdef0123456789abcdef-h2h-Tampere Lynx",
    label: "Tampere Lynx",
    match: "Tampere Lynx vs Helsinki Bears",
    home_team: "Tampere Lynx",
    away_team: "Helsinki Bears",
    odds: 2.1,
    stake: 10,
    raw_pick: {
      eventId: "0123456789abcdef0123456789abcdef",
      modelProbability: 0.52
    },
    ...overrides
  };
}

test("finds the exact scores event from the stored odds event id", () => {
  const target = completedEvent();
  const other = completedEvent({ id: "ffffffffffffffffffffffffffffffff" });
  assert.equal(findScoreEventForBet(paperBet(), [other, target]), target);
});

test("falls back to normalized home and away team names for older paper bets", () => {
  const event = completedEvent({
    id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    home_team: "Tampere-Lynx",
    away_team: "Helsinki Bears"
  });
  const bet = paperBet({
    client_ref: "old-client-ref",
    raw_pick: {},
    home_team: null,
    away_team: null,
    match: "Tampere Lynx – Helsinki Bears"
  });

  assert.equal(findScoreEventForBet(bet, [event]), event);
});

test("settles a winning home selection and calculates paper profit", () => {
  const result = settlePaperBetFromScore(paperBet(), completedEvent());
  assert.ok(result);
  assert.equal(result.status, "won");
  assert.equal(result.profit, 11);
  assert.equal(result.result, "Tampere Lynx 4-2 Helsinki Bears");
  assert.equal(result.settlementSource, "odds-api-scores");
});

test("settles the opposing selection as a loss", () => {
  const result = settlePaperBetFromScore(
    paperBet({ label: "Helsinki Bears", odds: 1.8, stake: 25 }),
    completedEvent()
  );
  assert.ok(result);
  assert.equal(result.status, "lost");
  assert.equal(result.profit, -25);
});

test("settles an explicit draw selection correctly", () => {
  const result = settlePaperBetFromScore(
    paperBet({ label: "Draw" }),
    completedEvent({
      scores: [
        { name: "Tampere Lynx", score: "2" },
        { name: "Helsinki Bears", score: "2" }
      ]
    })
  );
  assert.ok(result);
  assert.equal(result.status, "won");
});

test("does not invent a result for incomplete, malformed or unsupported selections", () => {
  assert.equal(
    settlePaperBetFromScore(paperBet(), completedEvent({ completed: false })),
    null
  );
  assert.equal(
    settlePaperBetFromScore(paperBet(), completedEvent({ scores: null })),
    null
  );
  assert.equal(
    settlePaperBetFromScore(paperBet({ label: "Over 5.5" }), completedEvent()),
    null
  );
});
