import test from "node:test";
import assert from "node:assert/strict";
import { publicModelFormulaRegistry } from "../lib/public-model-formula-registry-v2.mjs";

const registry = publicModelFormulaRegistry();

test("public registry publishes MLB pitching/offense formula and non-calibrated boundary", () => {
  const formula = registry.formulas.find((row) => row.id === "mlb-pitching-offense-v1");
  assert.ok(formula);
  assert.match(formula.formula, /starter_xwOBA_allowed/);
  assert.match(formula.formula, /lineupZ/);
  assert.match(formula.formula, /oppBullpenZ/);
  assert.equal(formula.trained, false);
  assert.match(formula.note, /park context is audited but does not enter V1 H2H probability/i);
  assert.equal(registry.disclosure.mlbPitchingOffenseFormulaPublished, true);
  assert.equal(registry.disclosure.mlbResearchParametersClaimedCalibrated, false);
});

test("MLB registry model is an independent shadow challenger without automatic promotion", () => {
  const model = registry.models.find((row) => row.id === "mlb-pitching-offense-v1");
  assert.ok(model);
  assert.equal(model.independentPredictiveModel, true);
  assert.equal(model.automaticPromotion, false);
  assert.match(model.dependenceGroupPolicy, /baseball_mlb-expected-performance-family/);
  assert.match(model.featureAvailabilityCutoff, /confirmed starting-pitcher xwOBA-allowed/);
});
