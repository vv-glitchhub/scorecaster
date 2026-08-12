import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auditClient = fs.readFileSync(new URL("../app/event/[eventId]/EventDataAuditClient.jsx", import.meta.url), "utf8");
const modelPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventModelAuditPanel.jsx", import.meta.url), "utf8");
const soccerPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventSoccerXgPoissonPanel.jsx", import.meta.url), "utf8");
const basketballPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventBasketballEfficiencyPanel.jsx", import.meta.url), "utf8");
const mlbPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventMlbPitchingOffensePanel.jsx", import.meta.url), "utf8");
const dataLayer = fs.readFileSync(new URL("../app/api/data-layer/route.js", import.meta.url), "utf8");

function count(text, token) { return text.split(token).length - 1; }

test("event detail exposes all advanced model audits from one unified data request", () => {
  for (const component of ["EventModelAuditPanel", "EventSoccerXgPoissonPanel", "EventBasketballEfficiencyPanel", "EventMlbPitchingOffensePanel"]) assert.match(auditClient, new RegExp(component));
  assert.match(auditClient, /<EventMlbPitchingOffensePanel row=\{state\.row\}/);
  assert.equal(count(auditClient, "fetch("), 1);
  assert.equal(count(modelPanel, "fetch("), 0);
  assert.equal(count(soccerPanel, "fetch("), 0);
  assert.equal(count(basketballPanel, "fetch("), 0);
  assert.equal(count(mlbPanel, "fetch("), 0);
});

test("model audit renders factory, ensemble, rating and research gate evidence", () => {
  for (const token of [/row\?\.modelFactory/, /row\?\.ensembleEngine/, /row\?\.historicalRatingShadow/, /researchRiskGate/, /calibrationReadyGroups/, /dependenceGroup/, /productionProbabilityChanged/, /automaticPromotionAllowed/]) assert.match(modelPanel, token);
});

test("soccer xG audit exposes full 1X2 probability and holdout boundaries", () => {
  assert.match(soccerPanel, /row\?\.soccerXgPoissonShadow/);
  assert.match(soccerPanel, /probabilities\?\.home/);
  assert.match(soccerPanel, /probabilities\?\.draw/);
  assert.match(soccerPanel, /probabilities\?\.away/);
  assert.match(soccerPanel, /performanceWeightAvailable/);
  assert.match(dataLayer, /advancedModelHoldoutEndpoint/);
  assert.match(dataLayer, /holdoutInventsPerformanceWeight: false/);
});

test("basketball efficiency audit exposes H2H and projected points", () => {
  assert.match(basketballPanel, /row\?\.basketballEfficiencyShadow/);
  assert.match(basketballPanel, /projected\?\.homePoints/);
  assert.match(basketballPanel, /performanceWeightAvailable/);
  assert.match(dataLayer, /basketballEfficiencyUsesMarketInputs: false/);
});

test("MLB audit exposes H2H, starter vulnerability and strict safety boundaries", () => {
  assert.match(mlbPanel, /row\?\.mlbPitchingOffenseShadow/);
  assert.match(mlbPanel, /probabilities\?\.home/);
  assert.match(mlbPanel, /probabilities\?\.away/);
  assert.match(mlbPanel, /homeStarterVulnerabilityZ/);
  assert.match(mlbPanel, /awayStarterVulnerabilityZ/);
  assert.match(mlbPanel, /confirmed starters/);
  assert.match(mlbPanel, /parkContextUsedInProbability/);
  assert.match(mlbPanel, /performanceWeightAvailable/);
  assert.match(dataLayer, /mlbPitchingOffenseShadowVersion/);
  assert.match(dataLayer, /mlbPitchingOffenseRequiresConfirmedStartingPitchers: true/);
  assert.match(dataLayer, /mlbParkContextUsedInH2hProbability: false/);
  assert.match(dataLayer, /probabilityAdjustedByMlbPitchingOffenseShadow: false/);
});

test("data layer publishes lineage guard and anti-masquerading contract", () => {
  assert.match(dataLayer, /scorecaster-model-lineage-guard-v1/);
  assert.match(dataLayer, /modelSelfDeclaredDependenceGroupTrusted: false/);
  assert.match(dataLayer, /marketDerivedIndependentModelsAccepted: false/);
  assert.match(dataLayer, /contextOnlyIndependentModelsAccepted: false/);
  assert.match(dataLayer, /marketDerivedSignalCanMasqueradeAsIndependentModel: false/);
});
