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

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
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

test("401 is classified and is never retried", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    return jsonResponse({ success: false, error: "not retained" }, 401);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(calls, 1);
    assert.equal(result.ok, false);
    assert.equal(result.mode, "api_error");
    assert.equal(result.status, 401);
    assert.equal(result.errorCategory, "unauthorized");
    assert.equal(result.attempts, 1);
    assert.equal(result.retried, false);
    assert.doesNotMatch(JSON.stringify(result), /not retained/);
  });
});

test("429 retains only bounded Retry-After evidence and is not immediately retried", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    return jsonResponse({ success: false, error: "quota text must not leak" }, 429, { "retry-after": "17" });
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(calls, 1);
    assert.equal(result.errorCategory, "rate_limited");
    assert.equal(result.retryAfterSeconds, 17);
    assert.equal(result.attempts, 1);
    assert.equal(result.retried, false);
    assert.doesNotMatch(JSON.stringify(result), /quota text must not leak/);
  });
});

test("one transient 500 is retried once and can recover", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ success: false, error: "temporary" }, 500);
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(calls, 2);
    assert.equal(result.ok, true);
    assert.equal(result.mode, "no_match");
    assert.equal(result.attempts, 2);
    assert.equal(result.retried, true);
  });
});

test("persistent 503 is retried only once", async () => {
  let calls = 0;
  await withMockFetch(async () => {
    calls += 1;
    return jsonResponse({ success: false, error: "temporary" }, 503);
  }, async () => {
    const result = await fetchSportsGameOddsForMatch(MATCH);
    assert.equal(calls, 2);
    assert.equal(result.ok, false);
    assert.equal(result.errorCategory, "provider_unavailable");
    assert.equal(result.attempts, 2);
    assert.equal(result.retried, true);
  });
});

test("identical concurrent league/time requests share one upstream fetch", async () => {
  let calls = 0;
  await withMockFetch(async () => {
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

test("API key is sent only in the x-api-key header, never in the request URL", async () => {
  await withMockFetch(async (url, options) => {
    assert.equal(new URL(url).searchParams.has("apiKey"), false);
    assert.equal(options.headers["x-api-key"], "test-key-not-a-production-secret");
    return jsonResponse({ success: true, data: [] }, 200);
  }, async () => {
    await fetchSportsGameOddsForMatch(MATCH);
  });
});
