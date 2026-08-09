import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSportsGameOddsForMatch,
  resetSportsGameOddsRequestCacheForTests
} from "../lib/sportsgameodds-provider.js";
import {
  buildSportsGameOddsRequestWindow,
  sportsGameOddsRateLimitCooldownMs,
  SPORTSGAMEODDS_RATE_LIMIT_FALLBACK_MS
} from "../lib/sportsgameodds-request-window-v1.mjs";

const MATCH = Object.freeze({
  sportKey: "basketball_wnba",
  homeTeam: "Alpha",
  awayTeam: "Beta",
  commenceTime: "2026-08-09T18:00:00.000Z"
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

function isUsageUrl(value) {
  return new URL(value).pathname === "/v2/account/usage";
}

function safeUsagePayload(overrides = {}) {
  return {
    success: true,
    data: {
      isActive: true,
      keyID: "must-never-leak",
      customerID: "must-never-leak-customer",
      email: "must-never-leak@example.com",
      rateLimits: {
        "per-minute": {
          "max-requests": 10,
          "current-requests": 10,
          "max-entities": 100,
          "current-entities": 50
        },
        ...overrides
      }
    }
  };
}

async function withMockFetch(handler, run) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.SPORTSGAMEODDS_API_KEY;
  process.env.SPORTSGAMEODDS_API_KEY = "test-key-not-a-production-secret";
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

test("401 is classified, never retried and never triggers usage lookup", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(safeUsagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: false, error: "not retained" }, 401);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 1);
    assert.equal(usageCalls, 0);
    assert.equal(result.ok, false);
    assert.equal(result.mode, "api_error");
    assert.equal(result.status, 401);
    assert.equal(result.errorCategory, "unauthorized");
    assert.equal(result.attempts, 1);
    assert.equal(result.retried, false);
    assert.equal(result.usage, null);
    assert.doesNotMatch(JSON.stringify(result), /not retained/);
  });
});

test("429 triggers one safe usage lookup, retains bounded evidence and is not immediately retried", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url, options) => {
    assert.equal(new URL(url).searchParams.has("apiKey"), false);
    assert.equal(options.headers["x-api-key"], "test-key-not-a-production-secret");
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(safeUsagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: false, error: "quota text must not leak" }, 429, { "retry-after": "17" });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 1);
    assert.equal(usageCalls, 1);
    assert.equal(result.errorCategory, "rate_limited");
    assert.equal(result.retryAfterSeconds, 17);
    assert.equal(result.attempts, 1);
    assert.equal(result.retried, false);
    assert.deepEqual(result.usage.bindingLimits, ["per-minute:requests"]);
    assert.equal(result.usage.intervals["per-minute"].requestRatio, 1);
    assert.equal(result.usage.emailRetained, false);
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /quota text must not leak|must-never-leak|keyID|customerID/i);
    assert.doesNotMatch(serialized, /must-never-leak@example\.com/i);
  });
});

test("429 usage lookup failure is non-cascading and stays rate_limited", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse({ success: false, error: "usage unavailable" }, 503);
    }
    eventCalls += 1;
    return jsonResponse({ success: false }, 429);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 1);
    assert.equal(usageCalls, 1);
    assert.equal(result.errorCategory, "rate_limited");
    assert.equal(result.usage, null);
  });
});

test("429 without useful Retry-After uses at least a one-minute local cooldown", () => {
  assert.equal(SPORTSGAMEODDS_RATE_LIMIT_FALLBACK_MS, 60_000);
  assert.equal(sportsGameOddsRateLimitCooldownMs(null), 60_000);
  assert.equal(sportsGameOddsRateLimitCooldownMs(0), 60_000);
  assert.equal(sportsGameOddsRateLimitCooldownMs(17), 60_000);
  assert.equal(sportsGameOddsRateLimitCooldownMs(75), 75_000);
});

test("a cached 429 and cached usage snapshot are reused across same-league matches", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return jsonResponse(safeUsagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: false, error: "do not retain" }, 429);
  }, async () => {
    const [first, second] = await Promise.all([
      fetchSportsGameOddsForMatch({ ...MATCH, commenceTime: "2026-08-09T02:00:00.000Z" }),
      fetchSportsGameOddsForMatch({ ...MATCH, homeTeam: "Gamma", awayTeam: "Delta", commenceTime: "2026-08-09T23:00:00.000Z" })
    ]);
    assert.equal(eventCalls, 1);
    assert.equal(usageCalls, 1);
    assert.equal(first.errorCategory, "rate_limited");
    assert.equal(second.errorCategory, "rate_limited");
    assert.deepEqual(first.usage.bindingLimits, ["per-minute:requests"]);
    assert.deepEqual(second.usage.bindingLimits, ["per-minute:requests"]);
    assert.doesNotMatch(JSON.stringify([first, second]), /do not retain|must-never-leak/i);
  });
});

test("one transient 500 is retried once and can recover without usage lookup", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(safeUsagePayload());
    }
    eventCalls += 1;
    if (eventCalls === 1) return jsonResponse({ success: false, error: "temporary" }, 500);
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 2);
    assert.equal(usageCalls, 0);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "no_match");
    assert.equal(result.attempts, 2);
    assert.equal(result.retried, true);
  });
});

test("persistent 503 is retried only once and does not trigger usage lookup", async () => {
  let eventCalls = 0;
  let usageCalls = 0;
  await withMockFetch(async (url) => {
    if (isUsageUrl(url)) {
      usageCalls += 1;
      return jsonResponse(safeUsagePayload());
    }
    eventCalls += 1;
    return jsonResponse({ success: false, error: "temporary" }, 503);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(eventCalls, 2);
    assert.equal(usageCalls, 0);
    assert.equal(result.ok, false);
    assert.equal(result.errorCategory, "provider_unavailable");
    assert.equal(result.attempts, 2);
    assert.equal(result.retried, true);
  });
});

test("same UTC-day matches share a deterministic 40-hour candidate window", () => {
  const first = buildSportsGameOddsRequestWindow(Date.parse("2026-08-09T00:01:00.000Z"), 8 * 60 * 60 * 1000);
  const last = buildSportsGameOddsRequestWindow(Date.parse("2026-08-09T23:59:00.000Z"), 8 * 60 * 60 * 1000);
  const next = buildSportsGameOddsRequestWindow(Date.parse("2026-08-10T00:01:00.000Z"), 8 * 60 * 60 * 1000);
  assert.equal(first.bucketKey, "2026-08-09");
  assert.equal(first.startsAfter, last.startsAfter);
  assert.equal(first.startsBefore, last.startsBefore);
  assert.equal(first.spanHours, 40);
  assert.notEqual(first.startsAfter, next.startsAfter);
});

test("eight same-league same-day matches collapse to one upstream fetch", async () => {
  let calls = 0;
  const urls = [];
  await withMockFetch(async (url) => {
    assert.equal(isUsageUrl(url), false);
    calls += 1;
    urls.push(String(url));
    await new Promise((resolve) => setTimeout(resolve, 20));
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    const matches = Array.from({ length: 8 }, (_, index) => ({
      ...MATCH,
      homeTeam: `Home ${index}`,
      awayTeam: `Away ${index}`,
      commenceTime: `2026-08-09T${String(index * 3).padStart(2, "0")}:00:00.000Z`
    }));
    const results = await Promise.all(matches.map((match) => fetchSportsGameOddsForMatch(match)));
    assert.equal(calls, 1);
    assert.equal(new Set(urls).size, 1);
    assert.equal(results.every((result) => result.mode === "no_match"), true);
    const requestUrl = new URL(urls[0]);
    assert.equal(requestUrl.searchParams.get("leagueID"), "WNBA");
    assert.equal(requestUrl.searchParams.get("startsAfter"), "2026-08-08T16:00:00.000Z");
    assert.equal(requestUrl.searchParams.get("startsBefore"), "2026-08-10T08:00:00.000Z");
  });
});

test("different leagues keep separate batch keys", async () => {
  let calls = 0;
  await withMockFetch(async (url) => {
    assert.equal(isUsageUrl(url), false);
    calls += 1;
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    await Promise.all([
      fetchSportsGameOddsForMatch(MATCH),
      fetchSportsGameOddsForMatch({ ...MATCH, sportKey: "baseball_mlb" })
    ]);
    assert.equal(calls, 2);
  });
});

test("identical concurrent league/time requests share one upstream fetch", async () => {
  let calls = 0;
  await withMockFetch(async (url) => {
    assert.equal(isUsageUrl(url), false);
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    const [left, right] = await Promise.all([
      fetchSportsGameOddsForMatch(MATCH),
      fetchSportsGameOddsForMatch({ ...MATCH })
    ]);
    assert.equal(calls, 1);
    assert.equal(left.mode, "no_match");
    assert.equal(right.mode, "no_match");
  });
});

test("API key is sent only in x-api-key headers and never in event or usage URLs", async () => {
  const seen = [];
  await withMockFetch(async (url, options) => {
    seen.push(String(url));
    assert.equal(new URL(url).searchParams.has("apiKey"), false);
    assert.equal(options.headers["x-api-key"], "test-key-not-a-production-secret");
    if (isUsageUrl(url)) return jsonResponse(safeUsagePayload());
    return jsonResponse({ success: false }, 429);
  }, async () => {
    await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(seen.length, 2);
    assert.equal(seen.some((url) => new URL(url).pathname === "/v2/account/usage"), true);
    assert.equal(seen.some((url) => new URL(url).pathname === "/v2/events"), true);
  });
});
