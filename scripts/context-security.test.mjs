import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("legacy placeholder and unrelated fallback claims are absent", async () => {
  const lineup = await readFile(new URL("../lib/lineup-fetcher.js", import.meta.url), "utf8");
  const news = await readFile(new URL("../lib/news-fetcher.js", import.meta.url), "utf8");
  const external = await readFile(new URL("../lib/polymarket-fetcher.js", import.meta.url), "utf8");

  assert.doesNotMatch(lineup, /example\.com\/lineups/i);
  assert.doesNotMatch(lineup, /keyPlayersAvailable:\s*true/);
  assert.doesNotMatch(news, /slashdot\.org\/firehose/);
  assert.doesNotMatch(news, /consent\.yahoo\.com/);
  assert.match(external, /ENABLE_EXTERNAL_MARKET_CONTEXT/);
  assert.match(external, /mode:\s*"disabled"/);
});

test("public Top Picks stays market-only", async () => {
  const route = await readFile(new URL("../app/api/top-picks/route.js", import.meta.url), "utf8");

  assert.match(route, /const enriched = preFiltered\.map\(applyQualityFallback\)/);
  assert.doesNotMatch(route, /Promise\.all\(preFiltered\.map\(enrichSafely\)\)/);
  assert.match(route, /intelligenceMode:\s*"authenticated-agent-only"/);
});

test("authenticated Agent bounds context work and reports immutable probabilities", async () => {
  const route = await readFile(new URL("../app/api/agent/portfolio/route.js", import.meta.url), "utf8");

  assert.match(route, /MAX_CONTEXT_PICKS\s*=\s*6/);
  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /bucket:\s*"agent_v11_portfolio"/);
  assert.match(route, /probabilityAdjusted:\s*false/);
  assert.match(route, /externalMarketUsedForDecision:\s*false/);
});

test("standalone context endpoint is authenticated, bounded and report-only", async () => {
  const route = await readFile(new URL("../app/api/intelligence/route.js", import.meta.url), "utf8");

  assert.match(route, /getAuthenticatedContext\(request\)/);
  assert.match(route, /mutationOriginAllowed\(request\)/);
  assert.match(route, /bucket:\s*"verified_sports_intelligence"/);
  assert.match(route, /readJsonBody\(request, 8 \* 1024\)/);
  assert.match(route, /SUPPORTED_SPORTS\.has\(sport\)/);
  assert.match(route, /probabilityAdjusted:\s*false/);
  assert.doesNotMatch(route, /console\.error/);
  assert.doesNotMatch(route, /intelligence:\s*\{\s*news/);
});

test("web and native Agent use the protected portfolio and expose source audit", async () => {
  const web = await readFile(new URL("../app/agent/AgentServerClient.jsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/agent/page.jsx", import.meta.url), "utf8");
  const mobile = await readFile(new URL("../mobile/src/screens/AgentScreen.tsx", import.meta.url), "utf8");

  assert.match(page, /AgentServerClient/);
  assert.match(web, /"\/api\/agent\/portfolio"/);
  assert.match(web, /verifiedIntelligence/);
  assert.match(web, /context\.sources/);
  assert.match(mobile, /sportsIntelligence/);
  assert.match(mobile, /verifiedIntelligence/);
  assert.match(mobile, /probabilityAdjustedByContext:\s*false/);
});
