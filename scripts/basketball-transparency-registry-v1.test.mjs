import test from "node:test";
import assert from "node:assert/strict";
import { publicModelFormulaRegistry } from "../lib/public-model-formula-registry-v2.mjs";

const registry = publicModelFormulaRegistry();

test("public registry publishes the basketball efficiency formula and research boundary", () => {
  assert.equal(registry.version, "scorecaster-model-formula-registry-v2");
  const formula = registry.formulas.find((row) => row.id === "basketball-efficiency-pace-v1");
  assert.ok(formula);
  assert.match(formula.formula, /homeORtg/);
  assert.match(formula.formula, /awayDRtg/);
  assert.match(formula.formula, /logistic/);
  assert.equal(formula.trained, false);
  assert.match(formula.note, /not claimed calibrated/);
  assert.equal(registry.disclosure.basketballEfficiencyFormulaPublished, true);
  assert.equal(registry.disclosure.basketballResearchParametersClaimedCalibrated, false);
});

test("NBA and WNBA model registry entries are independent shadow challengers without automatic promotion", () => {
  const nba = registry.models.find((row) => row.id === "nba-efficiency-pace-v1");
  const wnba = registry.models.find((row) => row.id === "wnba-efficiency-pace-v1");
  assert.ok(nba);
  assert.ok(wnba);
  assert.equal(nba.independentPredictiveModel, true);
  assert.equal(wnba.independentPredictiveModel, true);
  assert.equal(nba.automaticPromotion, false);
  assert.equal(wnba.automaticPromotion, false);
  assert.match(nba.dependenceGroupPolicy, /performance-statistics-family/);
  assert.match(wnba.dependenceGroupPolicy, /performance-statistics-family/);
});
