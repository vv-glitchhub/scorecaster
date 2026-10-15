import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRecommendation } from "../lib/recommendation-engine.mjs";

test("homepage Recommendations does not re-fetch its own Top Picks route over HTTP", async () => {
  const source = await readFile(new URL("../app/api/recommendations/route.js", import.meta.url), "utf8");
  assert.match(source, /import \{ GET as getTopPicksRoute \} from "\.\.\/top-picks\/route"/);
  assert.match(source, /getTopPicksRoute\(new Request\(/);
  assert.doesNotMatch(source, /fetch\(target/);
  assert.match(source, /if \(timer\) clearTimeout\(timer\)/);
});

test("unqualified historical model output does not become advertised probability", () => {
  const result = buildRecommendation({
    id: "unqualified",
    odds: 1.5,
    selection: "Home",
    marketKey: "h2h",
    productDecision: "CAUTION",
    independentModelProbability: 0.99,
    ownedDecisionEvidence: { applicable: true, probability: 0.99, qualified: false }
  });
  assert.equal(result.independentModelProbability, null);
  assert.equal(result.ownedModelQualified, false);
  assert.equal(result.decision, "CAUTION");
});

test("validated estimator status is passed through to the homepage without granting PLAY", () => {
  const metric = {
    status: "out-of-sample-calibration-required",
    modelEstimatedWinProbability: 0.7,
    modelEstimatedEV: 0.085,
    conservativeEV: null,
    eligible: false,
    paperOnly: true
  };
  const result = buildRecommendation({
    id: "paper",
    odds: 1.55,
    productDecision: "CAUTION",
    probabilityValue: metric
  });
  assert.deepEqual(result.probabilityValue, metric);
  assert.equal(result.independentModelProbability, 0.7);
  assert.equal(result.decision, "CAUTION");
  assert.equal(result.realMoneyActionAvailable, false);
});

test("Today distinguishes calibrated paper-only strategies from unavailable model evidence", async () => {
  const source = await readFile(new URL("../app/components/TodayPageV3.jsx", import.meta.url), "utf8");
  assert.match(source, /data-probability-value-unverified="true"/);
  assert.match(source, /data-probability-value-verified="paper-only"/);
  assert.match(source, /probabilityValue\?\.eligible === true/);
  assert.match(source, /conservativeEV/);
  assert.match(source, /High probability \+ value/);
  assert.match(source, /Paper-only/);
});
