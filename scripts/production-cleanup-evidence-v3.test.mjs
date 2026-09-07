import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("recommendation summary preserves owned-model evidence", () => {
  const source = read("lib/recommendation-engine.mjs");
  assert.match(source, /pick\.ownedDecisionEvidenceV1 \|\| pick\.ownedDecisionEvidence/);
  assert.match(source, /ownedModelStrongConflict/);
  assert.match(source, /ownedModelSupportsSelection/);
});

test("football evidence rehydrates owned decisions and never formats missing probability as zero", () => {
  const route = read("app/api/football-evidence/route.js");
  const panel = read("app/event/[eventId]/FootballIndependentEvidencePanel.jsx");
  assert.match(route, /attachOwnedDecisionEvidenceBatch/);
  assert.match(panel, /value === null \|\| value === undefined/);
  assert.match(panel, /not-required/);
  assert.match(panel, /sourceType === "owned-model"/);
  assert.match(panel, /Scorecasterin baseline ei tarvitse xG\/shot-metriikoita/);
});

test("provider incidents exclude configuration-only states", () => {
  const source = read("app/api/internal/unified-data/route.js");
  assert.match(source, /NON_OPERATIONAL_MODES/);
  assert.match(source, /not_configured/);
  assert.match(source, /unsupported_league/);
  assert.match(source, /summarizeProviderQuality\(operational\)/);
  assert.doesNotMatch(source, /NON_OPERATIONAL_MODES[\s\S]*quota_exhausted/);
});

test("optional odds markets fail open to H2H instead of dropping a league", () => {
  const source = read("app/api/odds/route.js");
  assert.match(source, /live-partial-markets/);
  assert.match(source, /markets: "h2h"/);
  assert.match(source, /marketFallback/);
});

test("recommendations discover all active supported sports in bounded Top Picks batches", () => {
  const source = read("app/api/recommendations/route.js");
  assert.match(source, /\/api\/sports/);
  assert.match(source, /chunks\(activeSports, 12\)/);
  assert.match(source, /all-active-supported/);
});

test("market history has no silent 20k truncation and stores in batches", () => {
  const source = read("app/api/internal/market-microstructure/route.js");
  assert.doesNotMatch(source, /records\.slice\(0,\s*20_000\)/);
  assert.match(source, /WRITE_BATCH_SIZE = 1000/);
  assert.match(source, /storeRecords/);
  assert.match(source, /h2h,spreads,totals/);
});

test("top European football leagues have form/rest feature and results-provider coverage", () => {
  const formRest = read("lib/form-rest-shadow-model.mjs");
  const results = read("lib/results-provider.js");
  for (const [sportKey, providerKey] of [
    ["soccer_italy_serie_a", "SERIEA"],
    ["soccer_germany_bundesliga", "BUNDESLIGA"],
    ["soccer_france_ligue_one", "LIGUE1"]
  ]) {
    assert.match(formRest, new RegExp(sportKey));
    assert.match(results, new RegExp(`${sportKey}: \\\"${providerKey}\\\"`));
  }
});

test("simple Match Intelligence hides technical audit behind Pro Mode and has a timeout", () => {
  const source = read("app/match-intelligence/MatchIntelligenceClient.jsx");
  assert.match(source, /AbortSignal\.timeout\(35_000\)/);
  assert.match(source, /Näytä tekninen audit/);
  assert.match(source, /proMode \? <>/);
});

test("self data engine captures point-in-time snapshots multiple times per day outside Vercel Hobby cron", () => {
  const workflow = read(".github/workflows/self-data-engine-v1.yml");
  const config = JSON.parse(read("vercel.json"));
  assert.match(workflow, /cron: "15 1,7,13,19 \* \* \*"/);
  assert.match(workflow, /Authorization: Bearer \$\{CRON_SECRET\}/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /\/api\/health/);
  assert.match(workflow, /TARGET_SHA/);
  assert.match(workflow, /productionProbabilityChanged/);
  assert.match(workflow, /realMoneyActionAvailable/);
  assert.equal(config.crons.some((item) => item.path === "/api/internal/self-data-engine"), false);
});

test("market capture proves the exact deployed commit and preserves paper-only boundaries", () => {
  const workflow = read(".github/workflows/market-microstructure.yml");
  assert.match(workflow, /app\/api\/internal\/market-microstructure/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /\/api\/health/);
  assert.match(workflow, /TARGET_SHA/);
  assert.match(workflow, /probabilityChanged/);
  assert.match(workflow, /realMoneyExecution/);
  assert.match(workflow, /paperOnly/);
});
