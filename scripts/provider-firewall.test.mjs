import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mutationOriginAllowed } from "../lib/api-security-core.mjs";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("provider service normalizes match input and has bounded resource limits", async () => {
  const internal = await source("lib/sports-intelligence-service.js");

  assert.match(internal, /function clean\(value, maximum = 160\)/);
  assert.match(internal, /homeTeam\.toLowerCase\(\) === awayTeam\.toLowerCase\(\)/);
  assert.match(internal, /commenceTime && !Number\.isFinite\(Date\.parse\(commenceTime\)\)/);
  assert.match(internal, /const CACHE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(internal, /const CACHE_LIMIT = 500/);
  assert.match(internal, /const PROVIDER_WINDOW_MS = 5 \* 60 \* 1000/);
  assert.match(internal, /const PROVIDER_MISS_LIMIT = 72/);
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
