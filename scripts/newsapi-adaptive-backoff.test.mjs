import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchNewsForMatch,
  NEWS_API_PROVIDER_POLICY,
  resetNewsApiCircuitForTests
} from "../lib/news-fetcher.js";

const previousKey = process.env.NEWS_API_KEY;
const MATCH = Object.freeze({ homeTeam: "Alpha United", awayTeam: "Beta City", sport: "soccer", league: "Test League" });

function setKey() {
  process.env.NEWS_API_KEY = "newsapi-adaptive-ci-key-not-production";
}

function restoreKey() {
  if (previousKey === undefined) delete process.env.NEWS_API_KEY;
  else process.env.NEWS_API_KEY = previousKey;
}

function errorResponse(code, status = 429, headers = {}) {
  return new Response(JSON.stringify({ status: "error", code, message: "must not be retained" }), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

test.afterEach(() => {
  resetNewsApiCircuitForTests();
  restoreKey();
});

test("a quota response opens a fail-fast circuit so the next match makes no network request", async () => {
  setKey();
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return errorResponse("apiKeyExhausted", 429);
  };
  try {
    const first = await fetchNewsForMatch(MATCH);
    const second = await fetchNewsForMatch({ ...MATCH, homeTeam: "Gamma FC", awayTeam: "Delta FC" });
    assert.equal(first.mode, "quota_exhausted");
    assert.equal(first.networkRequestMade, true);
    assert.equal(second.mode, "quota_exhausted");
    assert.equal(second.backoffActive, true);
    assert.equal(second.networkRequestMade, false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("rate-limit Retry-After is retained and queued calls fail fast after the first limited pair", async () => {
  setKey();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 25));
    active -= 1;
    return errorResponse("rateLimited", 429, { "retry-after": "120" });
  };
  try {
    const matches = Array.from({ length: 8 }, (_, index) => ({
      ...MATCH,
      homeTeam: `Home ${index}`,
      awayTeam: `Away ${index}`
    }));
    const results = await Promise.all(matches.map((match) => fetchNewsForMatch(match)));
    assert.ok(maxActive <= 2);
    assert.ok(calls <= 2);
    assert.ok(results.every((result) => result.mode === "rate_limited"));
    assert.ok(results.some((result) => result.networkRequestMade === false));
    assert.ok(results.filter((result) => result.networkRequestMade === true).every((result) => result.retryAfterSeconds === 120));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("a transient network failure also prevents an immediate retry storm", async () => {
  setKey();
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("synthetic network failure");
  };
  try {
    const first = await fetchNewsForMatch(MATCH);
    const second = await fetchNewsForMatch({ ...MATCH, homeTeam: "Gamma", awayTeam: "Delta" });
    assert.equal(first.mode, "fetch_error");
    assert.equal(first.networkRequestMade, true);
    assert.equal(second.mode, "fetch_error");
    assert.equal(second.networkRequestMade, false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("successful provider calls remain live and preserve the relevance filter", async () => {
  setKey();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: "ok",
    totalResults: 1,
    articles: [{
      title: "Alpha United meets Beta City",
      description: "Beta City faces Alpha United",
      source: { name: "Example Sports" },
      url: "https://example.org/preview",
      publishedAt: "2026-08-18T10:00:00Z"
    }]
  }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    const result = await fetchNewsForMatch(MATCH);
    assert.equal(result.mode, "live");
    assert.equal(result.networkRequestMade, true);
    assert.equal(result.backoffActive, false);
    assert.equal(result.relevantCount, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("provider policy makes the quota protection explicit without changing decision semantics", () => {
  assert.equal(NEWS_API_PROVIDER_POLICY.maxConcurrency, 2);
  assert.equal(NEWS_API_PROVIDER_POLICY.adaptiveBackoff, true);
  assert.equal(NEWS_API_PROVIDER_POLICY.rateLimitMinimumBackoffSeconds, 60);
  assert.equal(NEWS_API_PROVIDER_POLICY.quotaBackoffMinutes, 30);
  assert.equal(NEWS_API_PROVIDER_POLICY.authBackoffMinutes, 15);
  assert.equal(NEWS_API_PROVIDER_POLICY.probabilityChanged, false);
  assert.equal(NEWS_API_PROVIDER_POLICY.decisionChanged, false);
  assert.equal(NEWS_API_PROVIDER_POLICY.paperOnly, true);
});
