import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchNewsForMatch,
  NEWS_API_PROVIDER_POLICY,
  resetNewsApiCircuitForTests
} from "../lib/news-fetcher.js";

const MATCH = Object.freeze({
  homeTeam: "Alpha United",
  awayTeam: "Beta City",
  sport: "soccer",
  league: "Test League"
});

test.afterEach(() => {
  resetNewsApiCircuitForTests();
});

async function withNewsFetch(responseFactory, run) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.NEWS_API_KEY;
  process.env.NEWS_API_KEY = "newsapi-test-key-not-production";
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).hostname, "newsapi.org");
    assert.equal(new URL(url).searchParams.has("apiKey"), false);
    assert.equal(options.headers["X-Api-Key"], "newsapi-test-key-not-production");
    return responseFactory();
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.NEWS_API_KEY;
    else process.env.NEWS_API_KEY = previousKey;
  }
}

function errorResponse(code, status = 429, headers = {}) {
  return new Response(JSON.stringify({
    status: "error",
    code,
    message: "provider diagnostic text that must never be retained"
  }), {
    status,
    headers: { "content-type": "application/json", ...headers }
  });
}

test("NewsAPI apiKeyExhausted becomes explicit quota exhaustion without retaining provider message", async () => {
  const result = await withNewsFetch(
    () => errorResponse("apiKeyExhausted", 429),
    () => fetchNewsForMatch(MATCH)
  );
  assert.equal(result.ok, false);
  assert.equal(result.mode, "quota_exhausted");
  assert.equal(result.status, 429);
  assert.equal(result.errorCode, "apiKeyExhausted");
  assert.equal(result.retryAfterSeconds, null);
  assert.doesNotMatch(JSON.stringify(result), /provider diagnostic text/);
});

test("NewsAPI rateLimited preserves a bounded numeric Retry-After", async () => {
  const result = await withNewsFetch(
    () => errorResponse("rateLimited", 429, { "retry-after": "45" }),
    () => fetchNewsForMatch(MATCH)
  );
  assert.equal(result.mode, "rate_limited");
  assert.equal(result.errorCode, "rateLimited");
  assert.equal(result.retryAfterSeconds, 45);
});

test("NewsAPI credential failures are distinct from quota failures", async () => {
  const result = await withNewsFetch(
    () => errorResponse("apiKeyInvalid", 401),
    () => fetchNewsForMatch(MATCH)
  );
  assert.equal(result.mode, "auth_error");
  assert.equal(result.errorCode, "apiKeyInvalid");
  assert.equal(result.status, 401);
});

test("unknown provider error codes are not retained", async () => {
  const result = await withNewsFetch(
    () => errorResponse("futurePrivateDiagnosticCode", 503),
    () => fetchNewsForMatch(MATCH)
  );
  assert.equal(result.mode, "api_error");
  assert.equal(result.errorCode, null);
  assert.doesNotMatch(JSON.stringify(result), /futurePrivateDiagnosticCode/);
});

test("successful NewsAPI results still require both team names and safe HTTPS URLs", async () => {
  const result = await withNewsFetch(
    () => new Response(JSON.stringify({
      status: "ok",
      totalResults: 2,
      articles: [
        {
          title: "Alpha United prepares to face Beta City",
          description: "Beta City and Alpha United meet tonight",
          source: { name: "Example Sports" },
          url: "https://example.org/match-preview",
          publishedAt: "2026-08-18T09:00:00Z"
        },
        {
          title: "Alpha United training update",
          description: "Only Alpha United is mentioned",
          source: { name: "Example Sports" },
          url: "https://example.org/training",
          publishedAt: "2026-08-18T08:00:00Z"
        }
      ]
    }), { status: 200, headers: { "content-type": "application/json" } }),
    () => fetchNewsForMatch(MATCH)
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.relevantCount, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].url, "https://example.org/match-preview");
});

test("NewsAPI provider policy keeps raw provider errors and credentials out of retained evidence", () => {
  assert.equal(NEWS_API_PROVIDER_POLICY.safeErrorCodesOnly, true);
  assert.equal(NEWS_API_PROVIDER_POLICY.rawErrorMessageRetained, false);
  assert.equal(NEWS_API_PROVIDER_POLICY.credentialRetained, false);
  assert.equal(NEWS_API_PROVIDER_POLICY.rawPayloadRetained, false);
  assert.equal(NEWS_API_PROVIDER_POLICY.paperOnly, true);
});
