import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const auditClient = fs.readFileSync(new URL("../app/event/[eventId]/EventDataAuditClient.jsx", import.meta.url), "utf8");
const modelPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventModelAuditPanel.jsx", import.meta.url), "utf8");
const soccerPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventSoccerXgPoissonPanel.jsx", import.meta.url), "utf8");
const basketballPanel = fs.readFileSync(new URL("../app/event/[eventId]/EventBasketballEfficiencyPanel.jsx", import.meta.url), "utf8");
const dataLayer = fs.readFileSync(new URL("../app/api/data-layer/route.js", import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

test("event detail exposes model audit from the existing unified data request", () => {
  assert.match(auditClient, /EventModelAuditPanel/);
  assert.match(auditClient, /EventSoccerXgPoissonPanel/);
  assert.match(auditClient, /EventBasketballEfficiencyPanel/);
  assert.match(auditClient, /<EventModelAuditPanel row=\{state\.row\}/);
  assert.match(auditClient, /<EventSoccerXgPoissonPanel row=\{state\.row\}/);
  assert.match(auditClient, /<EventBasketballEfficiencyPanel row=\{state\.row\}/);
  assert.equal(count(auditClient, "fetch("), 1);
  assert.equal(count(modelPanel, "fetch("), 0);
  assert.equal(count(soccerPanel, "fetch("), 0);
  assert.equal(count(basketballPanel, "fetch("), 0);
});

test("model audit renders factory, ensemble, rating and research gate evidence", () => {
  assert.match(modelPanel, /row\?\.modelFactory/);
  assert.match(modelPanel, /row\?\.ensembleEngine/);
  assert.match(modelPanel, /row\?\.historicalRatingShadow/);
  assert.match(modelPanel, /researchRiskGate/);
  assert.match(modelPanel, /calibrationReadyGroups/);
  assert.match(modelPanel, /dependenceGroup/);
  assert.match(modelPanel, /productionProbabilityChanged/);
  assert.match(modelPanel, /automaticPromotionAllowed/);
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

test("basketball efficiency audit exposes H2H, projected points and research boundaries", () => {
  assert.match(basketballPanel, /row\?\.basketballEfficiencyShadow/);
  assert.match(basketballPanel, /probabilities\?\.home/);
  assert.match(basketballPanel, /probabilities\?\.away/);
  assert.match(basketballPanel, /projected\?\.homePoints/);
  assert.match(basketballPanel, /projected\?\.awayPoints/);
  assert.match(basketballPanel, /performanceWeightAvailable/);
  assert.match(dataLayer, /basketballEfficiencyShadowVersion/);
  assert.match(dataLayer, /basketballEfficiencyUsesMarketInputs: false/);
  assert.match(dataLayer, /probabilityAdjustedByBasketballEfficiencyShadow: false/);
});

test("data layer publishes the lineage guard and anti-masquerading contract", () => {
  assert.match(dataLayer, /scorecaster-model-lineage-guard-v1/);
  assert.match(dataLayer, /modelSelfDeclaredDependenceGroupTrusted: false/);
  assert.match(dataLayer, /marketDerivedIndependentModelsAccepted: false/);
  assert.match(dataLayer, /contextOnlyIndependentModelsAccepted: false/);
  assert.match(dataLayer, /marketDerivedSignalCanMasqueradeAsIndependentModel: false/);
});
