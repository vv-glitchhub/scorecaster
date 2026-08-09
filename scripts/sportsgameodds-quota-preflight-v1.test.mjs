import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSportsGameOddsForMatch,
  resetSportsGameOddsRequestCacheForTests
} from "../lib/sportsgameodds-provider.js";

const MATCH = Object.freeze({
  sportKey: "basketball_wnba",
  homeTeam: "Alpha",
  awayTeam: "Beta",
  commenceTime: "2026-08-09T18:00:00.000Z"
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function isUsageUrl(value) {
  return new URL(value).pathname === "/v2/account/usage";
}

function usagePayload({ monthlyEntities = 2500, monthlyLimit = 2500, minuteRequests = 3 } = {}) {
  return {
    success: true,
    data: {
      isActive: true,
      keyID: "must-not-leak",
      customerID: "must-not-leak-customer",
      email: "must-not-leak@example.com",
      rateLimits: {
        "per-minute": { "max-requests": 10, "current-requests": minuteRequests },
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

test("worker preflight blocks events when monthly entity quota is exhausted", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url, options) => {
    assert.equal(options.headers["x-api-key"], "test-key-not-production");
    assert.equal(new URL(url).searchParams.has("apiKey"), false);
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(usagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 0);
    assert.equal(result.ok, false);
    assert.equal(result.mode, "api_error");
    assert.equal(result.errorCategory, "rate_limited");
    assert.equal(result.attempts, 0);
    assert.equal(result.retried, false);
    assert.equal(result.quotaPreflightBlocked, true);
    assert.deepEqual(result.usage.bindingLimits, ["per-month:entities"]);
    assert.equal(result.usage.intervals["per-minute"].requestRatio, 0.3);
    assert.equal(result.usage.intervals["per-month"].entityRatio, 1);
    assert.doesNotMatch(JSON.stringify(result), /must-not-leak|keyID|customerID|email/i);
  });
});

test("worker preflight allows a batched event request below the binding limit", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(usagePayload({ monthlyEntities: 2499 }));
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 1);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "no_match");
    assert.equal(result.quotaPreflightBlocked, false);
  });
});

test("usage endpoint failure is non-cascading and falls through to the normal event path", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse({ success: false }, 503);
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH, { preflightUsage: true });
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 1);
    assert.equal(result.mode, "no_match");
  });
});

test("public/general provider call keeps preflight opt-in and makes no usage request by default", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(usagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(usageCalls, 0);
    assert.equal(eventCalls, 1);
    assert.equal(result.mode, "no_match");
  });
});

test("concurrent worker matches share one usage preflight and one league/day events request", async () => {
  let usageCalls = 0;
  let eventCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse(usagePayload({ monthlyEntities: 2000 }));
    }
    eventCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return jsonResponse({ success: true, data: [] });
  }, async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, (_, index) => fetchSportsGameOddsForMatch({
      ...MATCH,
      homeTeam: `Home ${index}`,
      awayTeam: `Away ${index}`,
      commenceTime: `2026-08-09T${String(index * 3).padStart(2, "0")}:00:00.000Z`
    }, { preflightUsage: true })));
    assert.equal(usageCalls, 1);
    assert.equal(eventCalls, 1);
    assert.equal(rows.every((row) => row.mode === "no_match"), true);
  });
});
