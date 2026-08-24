import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enterpriseRecommendationView } from "../lib/enterprise-api-auth.js";
import { getCollectorSource } from "../lib/collector-source-registry.mjs";

test("Enterprise recommendation view is derived-only and strips redistributable raw price fields", () => {
  const view = enterpriseRecommendationView({
    id: "r1",
    eventId: "e1",
    match: "A vs B",
    sportKey: "soccer_epl",
    league: "Premier League",
    selection: "A",
    marketKey: "h2h",
    decision: "CAUTION",
    score: 74,
    odds: 2.2,
    fairOdds: 2.05,
    minimumEvOdds: 2.11,
    bookmaker: "Example Bookmaker",
    bookmakerCount: 12,
    edge: 0.025,
    ev: 0.06,
    confidence: 0.8,
    readiness: "market-only",
    intelligenceV2: { nearPlay: true, visibleGateSummary: { passed: 5, failed: 1 } }
  });
  assert.equal(view.decision, "CAUTION");
  assert.equal(view.nearPlay, true);
  assert.equal(view.paperOnly, true);
  assert.equal(view.realMoneyActionAvailable, false);
  assert.equal(Object.hasOwn(view, "odds"), false);
  assert.equal(Object.hasOwn(view, "fairOdds"), false);
  assert.equal(Object.hasOwn(view, "minimumEvOdds"), false);
  assert.equal(Object.hasOwn(view, "bookmaker"), false);
});

test("provider rights registry forbids standalone The Odds API redistribution", () => {
  const source = getCollectorSource("the_odds_api", { ODDS_API_KEY: "configured-for-test" });
  assert.ok(source);
  assert.equal(source.commercialUseAllowed, true);
  assert.equal(source.redistributionAllowed, false);
});

test("Enterprise database patch stores hashes only, forces RLS and isolates quota RPC", async () => {
  const sql = await readFile(new URL("./apply-enterprise-api-v1.sql", import.meta.url), "utf8");
  assert.match(sql, /scorecaster_enterprise_api_tenants/);
  assert.match(sql, /scorecaster_enterprise_api_keys/);
  assert.match(sql, /key_hash text not null unique/);
  assert.doesNotMatch(sql, /raw_key\s+(?:text|varchar)/i);
  assert.match(sql, /force row level security/gi);
  assert.match(sql, /revoke all on public\.scorecaster_enterprise_api_keys from anon, authenticated/i);
  assert.match(sql, /consume_scorecaster_enterprise_api_quota/);
  assert.match(sql, /revoke execute[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
});

test("Enterprise authentication hashes bearer keys, checks tenant scopes and consumes quota before data", async () => {
  const auth = await readFile(new URL("../lib/enterprise-api-auth.js", import.meta.url), "utf8");
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /\.eq\("key_hash", hash\)/);
  assert.match(auth, /scopeAllowed\(requiredScope/);
  assert.match(auth, /consume_scorecaster_enterprise_api_quota/);
  assert.match(auth, /Cache-Control": "private, no-store"/);
  assert.match(auth, /derived-analysis-only/);
  assert.doesNotMatch(auth, /\.insert\([\s\S]{0,200}rawKey/);
});

test("Enterprise routes authenticate before invoking recommendation analysis and declare no raw redistribution", async () => {
  const recommendations = await readFile(new URL("../app/api/v1/recommendations/route.js", import.meta.url), "utf8");
  const leagues = await readFile(new URL("../app/api/v1/leagues/readiness/route.js", import.meta.url), "utf8");
  const health = await readFile(new URL("../app/api/v1/health/route.js", import.meta.url), "utf8");
  for (const route of [recommendations, leagues, health]) {
    assert.match(route, /authenticateEnterpriseApi\(request/);
    assert.match(route, /rawOddsRedistributed:\s*false/);
    assert.match(route, /rawProviderPayloadRedistributed:\s*false/);
    assert.doesNotMatch(route, /placeBet|suggestedStake|realMoneyActionAvailable\s*:\s*true/i);
  }
  assert.ok(recommendations.indexOf("authenticateEnterpriseApi(request") < recommendations.indexOf("getRecommendations(new Request"));
  assert.ok(leagues.indexOf("authenticateEnterpriseApi(request") < leagues.indexOf("getRecommendations(new Request"));
});

test("operator provisioning prints a raw key once but persists only its SHA-256 hash", async () => {
  const script = await readFile(new URL("./provision-enterprise-api-key.mjs", import.meta.url), "utf8");
  assert.match(script, /randomBytes\(32\)/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.match(script, /key_hash:\s*hash/);
  assert.doesNotMatch(script, /raw_key:/i);
  assert.match(script, /warning: "This raw key is shown once/);
});

test("Enterprise documentation promises read-only derived analysis, not a betting or raw-odds API", async () => {
  const page = await readFile(new URL("../app/enterprise-api/page.jsx", import.meta.url), "utf8");
  assert.match(page, /derived sports decision intelligence/i);
  assert.match(page, /raw odds redistribution are intentionally excluded/i);
  assert.match(page, /read-only/i);
  assert.match(page, /no Enterprise endpoint for stake creation/i);
  assert.match(page, /sc_live_<your-secret-key>/);
});
