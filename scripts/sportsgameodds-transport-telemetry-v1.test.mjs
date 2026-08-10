import test from "node:test";
import assert from "node:assert/strict";
import {
  safeSportsGameOddsUpstreamEvidence
} from "../lib/sportsgameodds-upstream-v1.mjs";
import {
  fetchSportsGameOddsForMatch,
  resetSportsGameOddsRequestCacheForTests
} from "../lib/sportsgameodds-provider.js";
import { enrichPickForUnifiedCapture } from "../lib/unified-capture-enrichment-v1.mjs";

const MATCH = Object.freeze({
  sportKey: "basketball_wnba",
  homeTeam: "Alpha",
  awayTeam: "Beta",
  commenceTime: "2026-08-10T18:00:00.000Z"
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function usagePayload({ monthlyEntities = 2500, monthlyLimit = 2500 } = {}) {
  return {
    success: true,
    data: {
      isActive: true,
      keyID: "do-not-retain",
      customerID: "do-not-retain",
      email: "do-not-retain@example.com",
      rateLimits: {
        "per-minute": { "max-requests": 10, "current-requests": 2 },
        "per-month": { "max-entities": monthlyLimit, "current-entities": monthlyEntities }
      }
    }
  };
}

async function withMockFetch(handler, run) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.SPORTSGAMEODDS_API_KEY;
  process.env.SPORTSGAMEODDS_API_KEY = "test-key-not-production";
  resetSportsGameOddsRequestCacheForTests();
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.SPORTSGAMEODDS_API_KEY;
    else process.env.SPORTSGAMEODDS_API_KEY = previousKey;
    resetSportsGameOddsRequestCacheForTests();
  }
}

test("safe upstream evidence preserves explicit zero, one and two event attempts", () => {
  const zero = safeSportsGameOddsUpstreamEvidence({ errorCategory: "rate_limited", attempts: 0, retried: false });
  const one = safeSportsGameOddsUpstreamEvidence({ status: 429, attempts: 1, retried: false });
  const two = safeSportsGameOddsUpstreamEvidence({ status: 503, attempts: 2, retried: true });
  assert.equal(zero.attempts, 0);
  assert.equal(zero.retried, false);
  assert.equal(one.attempts, 1);
  assert.equal(one.retried, false);
  assert.equal(two.attempts, 2);
  assert.equal(two.retried, true);
});

test("not-configured and unsupported league make neither usage nor event request", async () => {
  const previousKey = process.env.SPORTSGAMEODDS_API_KEY;
  delete process.env.SPORTSGAMEODDS_API_KEY;
  try {
    const missing = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(missing.mode, "not_configured");
    assert.equal(missing.attempts, 0);
    assert.equal(missing.usageRequestMade, false);
    assert.equal(missing.eventRequestMade, false);
  } finally {
    if (previousKey === undefined) delete process.env.SPORTSGAMEODDS_API_KEY;
    else process.env.SPORTSGAMEODDS_API_KEY = previousKey;
  }

  await withMockFetch(async () => {
    throw new Error("unsupported league must not reach network");
  }, async () => {
    const unsupported = await fetchSportsGameOddsForMatch({ ...MATCH, sportKey: "soccer_finland_veikkausliiga" }, { preflightUsage: true });
    assert.equal(unsupported.mode, "unsupported_league");
    assert.equal(unsupported.attempts, 0);
    assert.equal(unsupported.usageRequestMade, false);
    assert.equal(unsupported.eventRequestMade, false);
  });
});

test("quota preflight block records usage lookup but zero event attempts", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (new URL(url).pathname === "/v2/account/usage") {
      usageCalls += 1;
      return jsonResponse(usagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 0);
    assert.equal(result.quotaPreflightBlocked, true);
    assert.equal(result.attempts, 0);
    assert.equal(result.usageRequestMade, true);
    assert.equal(result.eventRequestMade, false);
  });
});

test("preflight below quota records both usage and event transport", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (new URL(url).pathname === "/v2/account/usage") {
      usageCalls += 1;
      return jsonResponse(usagePayload({ monthlyEntities: 2000 }));
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 1);
    assert.equal(result.mode, "no_match");
    assert.equal(result.attempts, 1);
    assert.equal(result.usageRequestMade, true);
    assert.equal(result.eventRequestMade, true);
  });
});

test("general event fetch records no preflight usage and one event request", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (new URL(url).pathname === "/v2/account/usage") {
      usageCalls += 1;
      return jsonResponse(usagePayload({ monthlyEntities: 1000 }));
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(usageCalls, 0);
    assert.equal(eventCalls, 1);
    assert.equal(result.attempts, 1);
    assert.equal(result.usageRequestMade, false);
    assert.equal(result.eventRequestMade, true);
  });
});

test("429 after an event request records the follow-up usage lookup", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (new URL(url).pathname === "/v2/account/usage") {
      usageCalls += 1;
      return jsonResponse(usagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: false }, 429, { "retry-after": "60" });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 1);
    assert.equal(usageCalls, 1);
    assert.equal(result.errorCategory, "rate_limited");
    assert.equal(result.attempts, 1);
    assert.equal(result.usageRequestMade, true);
    assert.equal(result.eventRequestMade, true);
  });
});

test("protected capture stores explicit provider transport flags without inferring unsupported events", async () => {
  const baseLedger = {
    factors: [],
    coverage: { independentOddsProviders: 1 },
    sources: [],
    totalBoundedContextImpact: 0,
    aiExplanation: { explanation: ["unchanged"] },
    safetyRecommendation: { action: "KEEP_CURRENT_DECISION" }
  };
  const pick = {
    id: "evt-1",
    gameId: "evt-1",
    homeTeam: "Alpha",
    awayTeam: "Beta",
    selection: "Alpha",
    sportKey: "soccer_finland_veikkausliiga",
    commenceTime: MATCH.commenceTime,
    consensusProbability: 0.5,
    productDecision: "CAUTION",
    unifiedSportsData: baseLedger,
    unifiedDataProviders: { primaryOdds: { source: "the-odds-api", mode: "live" } }
  };
  const enriched = await enrichPickForUnifiedCapture(pick, {
    fetchSecondary: async () => ({
      ok: true,
      source: "sportsgameodds",
      mode: "unsupported_league",
      attempts: 0,
      retried: false,
      usageRequestMade: false,
      eventRequestMade: false,
      data: null
    })
  });
  assert.equal(enriched.unifiedDataProviders?.secondaryOdds?.usageRequestMade, false);
  assert.equal(enriched.unifiedDataProviders?.secondaryOdds?.eventRequestMade, false);
  assert.equal(enriched.unifiedDataProviders?.secondaryOdds?.networkRequestMade, false);
});
