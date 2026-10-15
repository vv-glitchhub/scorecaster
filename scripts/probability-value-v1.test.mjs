import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProbabilityValueV1, probabilityValueLeaderboardsV1 } from "../lib/probability-value-v1.mjs";

const evidence = (probability, validation) => ({
  qualified:true, marketMapped:true, independentFromMarket:true,
  fresh:true, chronologySafe:true, strongConflict:false, probability, validation
});
const candidate = (id, odds, probability, lowerProbability, overrides={}) => ({
  id, marketKey:"h2h", fixtureVerifiedByProvider:true, productDecision:"PLAY",
  odds, ownedDecisionEvidenceV1:evidence(probability, {outOfSample:true,calibrated:true,sampleSize:500,confidenceLevel:0.95,lowerProbability}),
  ...overrides
});

test("market-only consensus is never presented as independent model probability", () => {
  const result = evaluateProbabilityValueV1({odds:1.2,marketKey:"h2h",fixtureVerifiedByProvider:true,modelProbability:0.95,productDecision:"PLAY"});
  assert.equal(result.modelEstimatedWinProbability,null);
  assert.equal(result.eligible,false);
  assert.equal(result.breakEvenProbability,0.83333);
});

test("independent estimate without out-of-sample lower bound remains research only", () => {
  const pick = candidate("a",1.55,0.7,null);
  pick.ownedDecisionEvidenceV1.validation=undefined;
  const result=evaluateProbabilityValueV1(pick);
  assert.equal(result.status,"out-of-sample-calibration-required");
  assert.equal(result.modelEstimatedEV,0.085);
  assert.equal(result.conservativeEV,null);
  assert.equal(result.eligible,false);
});

test("calibrated conservative EV and existing PLAY gate must both pass", () => {
  const pick=candidate("a",1.55,0.7,0.67);
  const result=evaluateProbabilityValueV1(pick);
  assert.equal(result.conservativeEV,0.0385);
  assert.equal(result.eligible,true);
  assert.equal(result.paperOnly,true);
  assert.equal(evaluateProbabilityValueV1({...pick,productDecision:"CAUTION"}).status,"existing-play-safety-gate");
});

test("nonpositive conservative EV is not promoted despite positive point-estimate EV", () => {
  const result=evaluateProbabilityValueV1(candidate("a",1.55,0.7,0.62));
  assert.equal(result.modelEstimatedEV,0.085);
  assert.ok(result.conservativeEV<0);
  assert.equal(result.eligible,false);
});

test("no valid independence, freshness or fixture means no paper candidate", () => {
  for(const property of ["qualified","marketMapped","independentFromMarket","fresh","chronologySafe"]) {
    const pick=candidate("a",2,0.65,0.58);
    pick.ownedDecisionEvidenceV1[property]=false;
    assert.equal(evaluateProbabilityValueV1(pick).eligible,false,property);
  }
  assert.equal(evaluateProbabilityValueV1(candidate("a",2,0.65,0.58,{fixtureVerifiedByProvider:false})).eligible,false);
});

test("lower sample size or missing calibration are not certified", () => {
  const pick=candidate("a",2,0.65,0.58);
  pick.ownedDecisionEvidenceV1.validation.sampleSize=8;
  assert.equal(evaluateProbabilityValueV1(pick).eligible,false);
});

test("high probability and maximum value are distinct and never include unqualified picks", () => {
  const picks=[
    candidate("high",1.3,0.85,0.80),
    candidate("value",2.5,0.55,0.50),
    candidate("skip",4,0.85,0.80,{productDecision:"SKIP"})
  ].map((pick)=>({...pick,probabilityValue:evaluateProbabilityValueV1(pick)}));
  const lists=probabilityValueLeaderboardsV1(picks);
  assert.deepEqual(lists.highProbabilityValue,["high","value"]);
  assert.deepEqual(lists.maximumValue,["value","high"]);
  assert.equal(lists.eligibleCount,2);
});
