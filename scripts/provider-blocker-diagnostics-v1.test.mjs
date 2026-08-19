import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  attachSportsProviderDiagnostics,
  safeSportsProviderDiagnostic,
  SPORTS_PROVIDER_DIAGNOSTICS_POLICY,
  SPORTS_PROVIDER_DIAGNOSTICS_VERSION
} from "../lib/sports-provider-diagnostics-v1.mjs";

function baseReport() {
  return {
    version: "sports-intelligence-v1",
    readiness: { level: "market-only", score: 0.3 },
    probabilityAdjusted: false,
    marketProbabilityChanged: false,
    providerLive: { news: true, injuries: false, lineup: false },
    injuries: [],
    lineups: [],
    news: []
  };
}

test("injury blocker diagnostics preserve safe 401 evidence without raw payload or credentials", () => {
  const secret = "super-secret-key";
  const diagnostic = safeSportsProviderDiagnostic({
    ok: false,
    source: "sportsdata",
    mode: "subscription_unavailable",
    status: 401,
    path: "/v3/wnba/scores/JSON/Players",
    coverageChecked: false,
    rawProviderCount: 0,
    injuryCandidateCount: 0,
    retrievedAt: "2026-08-15T03:20:00Z",
    apiKey: secret,
    raw: { key: secret, players: [{ name: "private" }] },
    data: [{ token: secret }]
  }, "injury-provider");

  assert.equal(diagnostic.version, SPORTS_PROVIDER_DIAGNOSTICS_VERSION);
  assert.equal(diagnostic.source, "sportsdata");
  assert.equal(diagnostic.mode, "subscription_unavailable");
  assert.equal(diagnostic.status, 401);
  assert.equal(diagnostic.path, "/v3/wnba/scores/JSON/Players");
  assert.equal(diagnostic.coverageChecked, false);
  assert.equal(diagnostic.subscriptionUnavailable, true);
  assert.equal(diagnostic.rawPayloadRetained, false);
  assert.equal(diagnostic.credentialRetained, false);
  assert.equal(JSON.stringify(diagnostic).includes(secret), false);
  assert.equal("raw" in diagnostic, false);
  assert.equal("data" in diagnostic, false);
  assert.equal("apiKey" in diagnostic, false);
});

test("NewsAPI rate-limit diagnostics preserve only allowlisted cooldown evidence", () => {
  const secret = "news-secret-value";
  const diagnostic = safeSportsProviderDiagnostic({
    ok: false,
    source: "newsapi",
    mode: "rate_limited",
    status: 429,
    errorCode: "rateLimited",
    retryAfterSeconds: 75,
    backoffActive: true,
    networkRequestMade: false,
    message: `provider said ${secret}`,
    raw: { apiKey: secret }
  }, "news-provider");

  assert.equal(diagnostic.source, "newsapi");
  assert.equal(diagnostic.status, 429);
  assert.equal(diagnostic.errorCode, "rateLimited");
  assert.equal(diagnostic.retryAfterSeconds, 75);
  assert.equal(diagnostic.backoffActive, true);
  assert.equal(diagnostic.networkRequestMade, false);
  assert.equal(diagnostic.rawPayloadRetained, false);
  assert.equal(diagnostic.rawErrorMessageRetained, false);
  assert.equal(diagnostic.credentialRetained, false);
  assert.equal(JSON.stringify(diagnostic).includes(secret), false);
  assert.equal("message" in diagnostic, false);
  assert.equal("raw" in diagnostic, false);

  const rejected = safeSportsProviderDiagnostic({
    source: "newsapi",
    mode: "rate_limited",
    errorCode: "arbitrary-secret-bearing-code"
  }, "news-provider");
  assert.equal(rejected.errorCode, null);
});

test("lineup diagnostics preserve incomplete starter and fallback blockers", () => {
  const diagnostic = safeSportsProviderDiagnostic({
    ok: true,
    source: "sportsdata-soccer-lineups",
    providerFamily: "sportsdataio",
    mode: "not_confirmed",
    starterCounts: { home: 10, away: 11 },
    fallbackAttempted: true,
    fallbackUsed: false,
    primaryProviderMode: "not_configured",
    sportsDataFallbackMode: "not_confirmed",
    retrievedAt: "2026-08-15T03:22:00Z"
  }, "lineup-provider");

  assert.equal(diagnostic.source, "sportsdata-soccer-lineups");
  assert.equal(diagnostic.providerFamily, "sportsdataio");
  assert.equal(diagnostic.mode, "not_confirmed");
  assert.deepEqual(diagnostic.starterCounts, { home: 10, away: 11 });
  assert.equal(diagnostic.fallbackAttempted, true);
  assert.equal(diagnostic.fallbackUsed, false);
  assert.equal(diagnostic.primaryProviderMode, "not_configured");
  assert.equal(diagnostic.fallbackMode, "not_confirmed");
  assert.equal(diagnostic.subscriptionUnavailable, false);
});

test("fallback subscription blocker is explicit even when primary lineup provider failed separately", () => {
  const diagnostic = safeSportsProviderDiagnostic({
    ok: false,
    source: "lineup-provider",
    mode: "fetch_error",
    status: null,
    fallbackAttempted: true,
    sportsDataFallbackMode: "subscription_unavailable",
    sportsDataSubscriptionUnavailable: true
  }, "lineup-provider");

  assert.equal(diagnostic.mode, "fetch_error");
  assert.equal(diagnostic.fallbackMode, "subscription_unavailable");
  assert.equal(diagnostic.subscriptionUnavailable, true);
});

test("Sports Intelligence attaches diagnostics without changing readiness or probability flags", () => {
  const report = baseReport();
  const attached = attachSportsProviderDiagnostics(report, {
    news: { ok: true, source: "newsapi", mode: "live", count: 3 },
    injuries: {
      ok: false,
      source: "sportsdata",
      mode: "subscription_unavailable",
      status: 401,
      path: "/v3/wnba/scores/JSON/Players"
    },
    lineup: {
      ok: true,
      source: "sportsdata-soccer-lineups",
      mode: "not_confirmed",
      starterCounts: { home: 9, away: 11 }
    }
  });

  assert.equal(attached.readiness, report.readiness);
  assert.equal(attached.probabilityAdjusted, false);
  assert.equal(attached.marketProbabilityChanged, false);
  assert.equal(attached.providerDiagnostics.injuries.status, 401);
  assert.equal(attached.providerDiagnostics.lineup.starterCounts.home, 9);
  assert.equal(attached.providerDiagnostics.probabilityChanged, false);
  assert.equal(attached.providerDiagnostics.decisionChanged, false);
  assert.equal(attached.providerDiagnostics.paperOnly, true);
});

test("budget exhaustion remains visible as a provider blocker", () => {
  const attached = attachSportsProviderDiagnostics(baseReport(), {
    news: { ok: false, source: "news-provider", mode: "budget_exhausted" },
    injuries: { ok: false, source: "injury-provider", mode: "budget_exhausted" },
    lineup: { ok: false, source: "lineup-provider", mode: "budget_exhausted" }
  });
  assert.equal(attached.providerDiagnostics.news.mode, "budget_exhausted");
  assert.equal(attached.providerDiagnostics.injuries.mode, "budget_exhausted");
  assert.equal(attached.providerDiagnostics.lineup.mode, "budget_exhausted");
});

test("Unified Data service consumes safe Sports Intelligence diagnostics including NewsAPI cooldown state", async () => {
  const service = await readFile(new URL("../lib/unified-sports-data-service.js", import.meta.url), "utf8");
  const intelligence = await readFile(new URL("../lib/sports-intelligence-service.js", import.meta.url), "utf8");

  assert.match(intelligence, /attachSportsProviderDiagnostics/);
  assert.match(intelligence, /reportWithDiagnostics/);
  assert.match(service, /safeDiagnostic\(sportsReport, "injuries"\)/);
  assert.match(service, /safeDiagnostic\(sportsReport, "lineup"\)/);
  assert.match(service, /safeDiagnostic\(sportsReport, "news"\)/);
  assert.match(service, /errorCode/);
  assert.match(service, /retryAfterSeconds/);
  assert.match(service, /backoffActive/);
  assert.match(service, /networkRequestMade/);
  assert.match(service, /subscriptionUnavailable/);
  assert.match(service, /rawPayloadRetained:\s*false/);
  assert.match(service, /rawErrorMessageRetained:\s*false/);
  assert.match(service, /credentialRetained:\s*false/);
});

test("diagnostics policy cannot change production decisions", () => {
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.rawPayloadRetained, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.rawErrorMessageRetained, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.credentialRetained, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.newsApiErrorCodeAllowlist, true);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.probabilityChanged, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.decisionChanged, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.stakeChanged, false);
  assert.equal(SPORTS_PROVIDER_DIAGNOSTICS_POLICY.paperOnly, true);
});
