import test from "node:test";
import assert from "node:assert/strict";
import { buildSecondaryPricingDiagnostics } from "../lib/secondary-pricing-diagnostics-v1.mjs";

const snapshot = (eventId, league = "wnba", sport = "basketball_wnba") => ({
  event_id: eventId,
  league,
  sport_key: sport,
  captured_at: "2026-08-09T06:00:00.000Z"
});

const observation = (eventId, upstream, leagueMode = "api_error") => ({
  event_id: eventId,
  provider_key: "sportsgameodds",
  family: "odds",
  mode: leagueMode,
  ok: false,
  details: {
    upstream,
    providerErrorText: "must-not-leak",
    apiKey: "must-not-leak"
  },
  observed_at: "2026-08-09T06:01:00.000Z",
  captured_at: "2026-08-09T06:01:00.000Z"
});

test("upstream status categories aggregate by provider without retaining error body text", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one"), snapshot("two"), snapshot("three")],
    providerObservations: [
      observation("one", { httpStatus: 429, errorCategory: "rate_limited", retryAfterSeconds: 12, attempts: 1, retried: false }),
      observation("two", { httpStatus: 429, errorCategory: "rate_limited", retryAfterSeconds: 18, attempts: 1, retried: false }),
      observation("three", { httpStatus: 503, errorCategory: "provider_unavailable", retryAfterSeconds: null, attempts: 2, retried: true })
    ]
  });
  const upstream = report.providers[0].upstreamErrors;
  assert.equal(upstream.samples, 3);
  assert.equal(upstream.errorCategoryCounts.rate_limited, 2);
  assert.equal(upstream.errorCategoryCounts.provider_unavailable, 1);
  assert.equal(upstream.httpStatusCounts["429"], 2);
  assert.equal(upstream.httpStatusCounts["503"], 1);
  assert.equal(upstream.averageRetryAfterSeconds, 15);
  assert.equal(upstream.averageAttempts, 1.33);
  assert.equal(upstream.retriedCount, 1);
  assert.doesNotMatch(JSON.stringify(report), /must-not-leak|apiKey|providerErrorText/);
});

test("upstream evidence is independently aggregated per league", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [
      snapshot("one", "mlb", "baseball_mlb"),
      snapshot("two", "wnba", "basketball_wnba")
    ],
    providerObservations: [
      observation("one", { httpStatus: 403, errorCategory: "forbidden", attempts: 1, retried: false }),
      observation("two", { httpStatus: 429, errorCategory: "rate_limited", retryAfterSeconds: 30, attempts: 1, retried: false })
    ]
  });
  const mlb = report.byLeague.find((row) => row.league === "mlb");
  const wnba = report.byLeague.find((row) => row.league === "wnba");
  assert.equal(mlb.upstreamErrors.errorCategoryCounts.forbidden, 1);
  assert.equal(wnba.upstreamErrors.errorCategoryCounts.rate_limited, 1);
});

test("unknown upstream category is reduced to a safe allowlisted bucket", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one")],
    providerObservations: [
      observation("one", { httpStatus: 418, errorCategory: "secret-provider-message", attempts: 1, retried: false })
    ]
  });
  const upstream = report.providers[0].upstreamErrors;
  assert.equal(upstream.errorCategoryCounts.unknown_http_error, 1);
  assert.equal(upstream.httpStatusCounts["418"], 1);
  assert.doesNotMatch(JSON.stringify(report), /secret-provider-message/);
});

test("legacy observations without upstream evidence remain valid with zero samples", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one")],
    providerObservations: [{
      event_id: "one",
      provider_key: "sportsgameodds",
      family: "odds",
      mode: "api_error",
      ok: false,
      captured_at: "2026-08-09T06:01:00.000Z"
    }]
  });
  assert.equal(report.providers[0].upstreamErrors.samples, 0);
  assert.deepEqual(report.providers[0].upstreamErrors.httpStatusCounts, {});
});
