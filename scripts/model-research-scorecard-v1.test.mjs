import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../app/model-lab/ModelHoldoutScorecard.jsx", import.meta.url), "utf8");
const lab = fs.readFileSync(new URL("../app/model-lab/ModelLabClient.jsx", import.meta.url), "utf8");

function count(text, token) {
  return text.split(token).length - 1;
}

test("Model Lab includes the research scorecard", () => {
  assert.match(lab, /ModelHoldoutScorecard/);
  assert.match(lab, /<ModelHoldoutScorecard \/>/);
});

test("holdout evaluation is manual and never starts from a useEffect", () => {
  assert.equal(client.includes("useEffect"), false);
  assert.match(client, /onClick=\{\(\) => void loadHoldout\(\)\}/);
  assert.match(client, /fetch\("\/api\/model-holdout\?days=180"/);
  assert.equal(count(client, "fetch("), 1);
  assert.match(client, /No automatic result-provider work on page load/);
});

test("scorecard exposes paired market-skill evidence and sample sizes", () => {
  assert.match(client, /marketComparableEvaluations/);
  assert.match(client, /brierSkillScore/);
  assert.match(client, /marketBrier/);
  assert.match(client, /modelBrierOnBenchmarkRows/);
  assert.match(client, /marketLogLoss/);
  assert.match(client, /logLossImprovement/);
  assert.match(client, /sampleSize/);
});

test("retrospective scorecard shows research review without proven-market claims", () => {
  assert.doesNotMatch(client, /PROVEN VS MARKET/);
  assert.match(client, /RESEARCH REVIEW/);
  assert.match(client, /MARKET-SKILL REVIEW/);
  assert.match(client, /COLLECTING/);
  assert.match(client, /A historical comparison does not establish future profitability/);
});

test("scorecard preserves shadow-only safety boundaries", () => {
  assert.match(client, /Market benchmark is comparison-only, never an independent Ensemble vote/);
  assert.match(client, /Automatic promotion: false/);
  assert.match(client, /Performance weight generated automatically: false/);
  assert.match(client, /Production probability changed: false/);
  assert.match(client, /Paper-only: true/);
});
