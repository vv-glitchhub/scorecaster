import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySportsGameOddsStatus,
  isSportsGameOddsRetryableCategory,
  parseSportsGameOddsRetryAfter,
  safeSportsGameOddsUpstreamEvidence,
  sportsGameOddsNetworkCategory
} from "../lib/sportsgameodds-upstream-v1.mjs";

test("documented SportsGameOdds HTTP statuses map to stable safe categories", () => {
  assert.equal(classifySportsGameOddsStatus(400), "bad_request");
  assert.equal(classifySportsGameOddsStatus(401), "unauthorized");
  assert.equal(classifySportsGameOddsStatus(403), "forbidden");
  assert.equal(classifySportsGameOddsStatus(404), "not_found");
  assert.equal(classifySportsGameOddsStatus(429), "rate_limited");
  assert.equal(classifySportsGameOddsStatus(500), "provider_server_error");
  assert.equal(classifySportsGameOddsStatus(502), "provider_server_error");
  assert.equal(classifySportsGameOddsStatus(503), "provider_unavailable");
  assert.equal(classifySportsGameOddsStatus(504), "provider_timeout");
  assert.equal(classifySportsGameOddsStatus(418), "unknown_http_error");
});

test("only transient upstream categories are retryable", () => {
  for (const category of ["bad_request", "unauthorized", "forbidden", "not_found", "rate_limited", "unknown_http_error"]) {
    assert.equal(isSportsGameOddsRetryableCategory(category), false, category);
  }
  for (const category of ["provider_server_error", "provider_unavailable", "provider_timeout", "network_error", "invalid_response"]) {
    assert.equal(isSportsGameOddsRetryableCategory(category), true, category);
  }
});

test("Retry-After is reduced to a bounded numeric duration", () => {
  assert.equal(parseSportsGameOddsRetryAfter("12"), 12);
  assert.equal(parseSportsGameOddsRetryAfter("99999"), 3600);
  assert.equal(parseSportsGameOddsRetryAfter("garbage"), null);
  assert.equal(parseSportsGameOddsRetryAfter("Wed, 21 Oct 2026 07:28:00 GMT", {
    now: Date.parse("2026-10-21T07:27:50.000Z")
  }), 10);
});

test("network timeouts are separated from other network failures", () => {
  assert.equal(sportsGameOddsNetworkCategory({ name: "TimeoutError" }), "provider_timeout");
  assert.equal(sportsGameOddsNetworkCategory({ name: "AbortError" }), "provider_timeout");
  assert.equal(sportsGameOddsNetworkCategory({ name: "TypeError" }), "network_error");
});

test("safe upstream evidence rejects arbitrary text and clamps numeric fields", () => {
  const evidence = safeSportsGameOddsUpstreamEvidence({
    status: 429,
    errorCategory: "provider-said-secret-token-here",
    retryAfterSeconds: 99999,
    attempts: 99,
    retried: true,
    error: "must-not-leak"
  });
  assert.equal(evidence.httpStatus, 429);
  assert.equal(evidence.errorCategory, "rate_limited");
  assert.equal(evidence.retryAfterSeconds, 3600);
  assert.equal(evidence.attempts, 2);
  assert.equal(evidence.retried, true);
  assert.deepEqual(Object.keys(evidence).sort(), ["attempts", "errorCategory", "httpStatus", "retried", "retryAfterSeconds"].sort());
  assert.doesNotMatch(JSON.stringify(evidence), /secret|token|must-not-leak/i);
});
