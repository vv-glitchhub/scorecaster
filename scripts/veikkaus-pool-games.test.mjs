import test from "node:test";
import assert from "node:assert/strict";

import {
  VEIKKAUS_GAME_FAMILIES,
  calculateFullSystemRows,
  calculateOrderedRankingRows,
  calculateParimutuelOdds,
  calculateTulosvetoSystemRows,
  calculateVakioSystemRows,
  classifyVeikkausGame,
  createPaperOnlyRuleBoundary,
  estimatePoolShareFromOdds,
  getTotoWinClassShares,
} from "../lib/veikkaus-pool-games.mjs";

test("classifies fixed-odds and pool game families separately", () => {
  assert.equal(classifyVeikkausGame("Pitkäveto"), VEIKKAUS_GAME_FAMILIES.PITKAVETO);
  assert.equal(classifyVeikkausGame("Tulosveto"), VEIKKAUS_GAME_FAMILIES.TULOSVETO);
  assert.equal(classifyVeikkausGame("Vakio 1"), VEIKKAUS_GAME_FAMILIES.VAKIO);
  assert.equal(classifyVeikkausGame("Moniveto 5"), VEIKKAUS_GAME_FAMILIES.MONIVETO);
  assert.equal(classifyVeikkausGame("Supertripla"), VEIKKAUS_GAME_FAMILIES.VOITTAJAVETO);
  assert.equal(classifyVeikkausGame("TOTO75"), VEIKKAUS_GAME_FAMILIES.TOTO);
});

test("Tulosveto pool odds follow return-pool divided by amount on outcome", () => {
  assert.equal(calculateParimutuelOdds({ turnover: 1000, amountOnOutcome: 77, returnRate: 0.77 }), 10);
  assert.equal(estimatePoolShareFromOdds({ odds: 10, returnRate: 0.77 }), 0.077);
});

test("full systems multiply independent selection counts", () => {
  assert.equal(calculateFullSystemRows([2, 3, 1, 2]), 12);
});

test("Vakio full system uses all 1X2 combinations", () => {
  assert.equal(calculateVakioSystemRows([["1"], ["1", "X"], ["1", "X", "2"]]), 6);
});

test("Tulosveto savings system removes the selected outcome class", () => {
  assert.equal(calculateTulosvetoSystemRows({ homeGoals: [0, 1, 2], awayGoals: [0, 1], exclude: null }), 6);
  assert.equal(calculateTulosvetoSystemRows({ homeGoals: [0, 1, 2], awayGoals: [0, 1], exclude: "draw" }), 4);
  assert.equal(calculateTulosvetoSystemRows({ homeGoals: [0, 1, 2], awayGoals: [0, 1], exclude: "home" }), 3);
  assert.equal(calculateTulosvetoSystemRows({ homeGoals: [0, 1, 2], awayGoals: [0, 1], exclude: "away" }), 5);
});

test("ordered ranking systems reject duplicate competitor positions", () => {
  assert.equal(calculateOrderedRankingRows([["A", "B", "C"], ["A", "B", "C"], ["A", "B", "C"]]), 6);
  assert.equal(calculateOrderedRankingRows([["1", "2", "3", "4"], ["1", "2", "3", "4", "5"], ["1", "2", "3", "4", "5", "6", "7", "8", "9"]]), 135);
});

test("Toto multi-winner class shares are explicit", () => {
  assert.deepEqual(getTotoWinClassShares("TOTO75"), { 7: 0.40, 6: 0.20, 5: 0.40 });
  assert.deepEqual(getTotoWinClassShares("TOTO65"), { 6: 0.50, 5: 0.50 });
});

test("Veikkaus game support remains analysis-only", () => {
  assert.deepEqual(createPaperOnlyRuleBoundary("Vakio"), {
    gameFamily: VEIKKAUS_GAME_FAMILIES.VAKIO,
    paperOnly: true,
    allowsBetPlacement: false,
    allowsBookmakerLogin: false,
    allowsMoneyMovement: false,
    purpose: "analysis_and_system_construction_only",
  });
});
