import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeSportsIntelligenceMatch,
  SPORTS_INTELLIGENCE_CACHE_LIMIT,
  SPORTS_INTELLIGENCE_CACHE_TTL_MS,
  SPORTS_INTELLIGENCE_PROVIDER_MISS_LIMIT,
  SPORTS_INTELLIGENCE_PROVIDER_WINDOW_MS
} from "../lib/sports-intelligence-service.js";
import { mutationOriginAllowed } from "../lib/api-security-core.mjs";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("sports intelligence match input is bounded and normalized", () => {
  const normalized = normalizeSportsIntelligenceMatch({
    homeTeam: "  Home   FC  ",
    awayTeam: "Away FC",
    sport: "soccer_epl",
    league: "Premier League",
    commenceTime: "2026-07-20T18:00:00Z",
    eventId: "event-123"
  });

  assert.equal(normalized.homeTeam, "Home FC");
  assert.equal(normalized.awayTeam, "Away FC");
  assert.equal(normalized.eventId, "event-123");
  assert.equal(normalizeSportsIntelligenceMatch({ homeTeam: "Same", awayTeam: "same", sport: "nba" }), null);
  assert.equal(normalizeSportsIntelligenceMatch({ homeTeam: "A", awayTeam: "B", sport: "nba", commenceTime: "invalid" }), null);
});

test("provider service has bounded cache and cache-miss budget", () => {
  assert.equal(SPORTS_INTELLIGENCE_CACHE_TTL_MS, 5 * 60 * 1000);
  assert.equal(SPORTS_INTELLIGENCE_CACHE_LIMIT, 500);
  assert.equal(SPORTS_INTELLIGENCE_PROVIDER_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(SPORTS_INTELLIGENCE_PROVIDER_MISS_LIMIT, 72);
});

test("missing origin is rejected unless a valid bearer token is present", () => {
  const anonymous = new Request("https://scorecaster.example/api/intelligence", { method: "POST" });
  const sameOrigin = new Request("https://scorecaster.example/api/intelligence", {
    method: "POST",
    headers: { Origin: "https://scorecaster.example" }
  });
  const bearer = new Request("https://scorecaster.example/api/intelligence", {
    method: "POST",
    headers: { Authorization: `Bearer ${"a".repeat(32)}` }
  });

  assert.equal(mutationOriginAllowed(anonymous), false);
  assert.equal(mutationOriginAllowed(sameOrigin), true);
  assert.equal(mutationOriginAllowed(bearer), true);
});

test("manual intelligence API authenticates and rate-limits before provider loading", async () => {
  const route = await source("app/api/intelligence/route.js");
  const originIndex = route.indexOf("mutationOriginAllowed(request)");
  const authIndex = route.indexOf("getAuthenticatedContext(request)");
  const quotaIndex = route.indexOf("enforceRateLimit(auth");
  const loadIndex = route.indexOf("loadSportsIntelligence(parsed.data)");

  assert.ok(originIndex >= 0);
  assert.ok(authIndex > originIndex);
  assert.ok(quotaIndex > authIndex);
  assert.ok(loadIndex > quotaIndex);
  assert.match(route, /bucket:\s*"sports_intelligence"/);
  assert.doesNotMatch(route, /fetchNewsForMatch|fetchInjuriesForMatch|fetchLineupForMatch/);
});

test("agent and top-picks use the internal service rather than the public API proxy", async () => {
  const service = await source("lib/intelligence-service.js");
  const loader = await source("lib/agent-intelligence-loader.js");
  const internal = await source("lib/sports-intelligence-service.js");

  assert.match(service, /loadSportsIntelligence/);
  assert.doesNotMatch(service, /\/api\/intelligence/);
  assert.doesNotMatch(service, /fetch\(/);
  assert.doesNotMatch(loader, /NEXT_PUBLIC_SITE_URL|VERCEL_URL|resolveOrigin/);
  assert.match(internal, /fetchNewsForMatch/);
  assert.match(internal, /consumeProviderMiss/);
  assert.match(internal, /budget_exhausted/);
  assert.doesNotMatch(internal, /NEXT_PUBLIC_|EXPO_PUBLIC_/);
});
