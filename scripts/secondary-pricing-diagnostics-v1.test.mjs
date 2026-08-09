import test from "node:test";
import assert from "node:assert/strict";
import { buildSecondaryPricingDiagnostics } from "../lib/secondary-pricing-diagnostics-v1.mjs";

const snapshot = (eventId, league = "wnba", sport = "basketball_wnba", captured = "2026-08-09T04:00:00.000Z") => ({
  event_id: eventId,
  league,
  sport_key: sport,
  captured_at: captured
});

const observation = (eventId, provider, mode, {
  ok = mode === "live",
  confidence = null,
  captured = "2026-08-09T04:01:00.000Z",
  details = null
} = {}) => ({
  event_id: eventId,
  provider_key: provider,
  family: "odds",
  mode,
  ok,
  confidence,
  details,
  observed_at: captured,
  captured_at: captured
});

const matchDiagnostics = (rejectionReason, overrides = {}) => ({
  rejectionReason,
  candidateCount: 10,
  orientationCount: 20,
  teamEligibleCount: 4,
  timeEligibleCount: 3,
  thresholdEligibleCount: rejectionReason === "matched" ? 1 : 0,
  bestConfidence: rejectionReason === "confidence_threshold" ? 0.69 : 0.91,
  bestHomeSimilarity: 0.88,
  bestAwaySimilarity: 0.82,
  bestTimeDifferenceHours: 1.5,
  teamSimilarityThreshold: 0.55,
  timeWindowHours: 8,
  matchConfidenceThreshold: 0.72,
  ...overrides
});

test("diagnostics aggregate mode distribution by provider without exposing event IDs", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one"), snapshot("two"), snapshot("three")],
    providerObservations: [
      observation("one", "sportsgameodds", "live", { confidence: 0.91 }),
      observation("two", "sportsgameodds", "no_match"),
      observation("three", "sportsgameodds", "low_match_confidence", { confidence: 0.68 })
    ]
  });
  assert.equal(report.providers.length, 1);
  const provider = report.providers[0];
  assert.equal(provider.observations, 3);
  assert.equal(provider.eligibleObservations, 3);
  assert.equal(provider.liveObservations, 1);
  assert.equal(provider.usableRate, 0.3333);
  assert.equal(provider.modeCounts.live, 1);
  assert.equal(provider.modeCounts.no_match, 1);
  assert.equal(provider.modeCounts.low_match_confidence, 1);
  assert.equal(provider.confidence.samples, 2);
  assert.equal(provider.confidence.average, 0.795);
  assert.doesNotMatch(JSON.stringify(report), /"event_id"|"eventId"|"home_team"|"away_team"/);
});

test("rejection diagnostics aggregate only allowlisted counts and numeric gate evidence", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one"), snapshot("two"), snapshot("three"), snapshot("four")],
    providerObservations: [
      observation("one", "sportsgameodds", "live", {
        confidence: 0.91,
        details: { matchDiagnostics: matchDiagnostics("matched") }
      }),
      observation("two", "sportsgameodds", "no_match", {
        details: { matchDiagnostics: matchDiagnostics("team_similarity", { teamEligibleCount: 0, timeEligibleCount: 0, bestConfidence: 0.54 }) }
      }),
      observation("three", "sportsgameodds", "no_match", {
        details: { matchDiagnostics: matchDiagnostics("time_window", { teamEligibleCount: 2, timeEligibleCount: 0, bestTimeDifferenceHours: 9.4 }) }
      }),
      observation("four", "sportsgameodds", "low_match_confidence", {
        confidence: 0.69,
        details: {
          matchDiagnostics: matchDiagnostics("confidence_threshold", { bestConfidence: 0.69 }),
          providerHomeTeam: "must-not-leak",
          providerAwayTeam: "must-not-leak",
          eventId: "must-not-leak"
        }
      })
    ]
  });
  const diagnostic = report.providers[0].matchDiagnostics;
  assert.equal(diagnostic.samples, 4);
  assert.equal(diagnostic.rejectionReasonCounts.matched, 1);
  assert.equal(diagnostic.rejectionReasonCounts.team_similarity, 1);
  assert.equal(diagnostic.rejectionReasonCounts.time_window, 1);
  assert.equal(diagnostic.rejectionReasonCounts.confidence_threshold, 1);
  assert.equal(diagnostic.averageCandidateCount, 10);
  assert.equal(diagnostic.observedThresholds.teamSimilarity, 0.55);
  assert.equal(diagnostic.observedThresholds.timeWindowHours, 8);
  assert.equal(diagnostic.observedThresholds.matchConfidence, 0.72);
  assert.doesNotMatch(JSON.stringify(report), /must-not-leak|providerHomeTeam|providerAwayTeam|"eventId"/);
});

test("unsupported and unconfigured observations remain visible but are excluded from usable denominator", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [
      snapshot("one", "veikkausliiga", "soccer_finland_veikkausliiga"),
      snapshot("two", "allsvenskan", "soccer_sweden_allsvenskan"),
      snapshot("three", "mls", "soccer_usa_mls")
    ],
    providerObservations: [
      observation("one", "sportsgameodds", "unsupported_league", { ok: true }),
      observation("two", "sportsgameodds", "not_configured", { ok: true }),
      observation("three", "sportsgameodds", "live", { ok: true, confidence: 0.93 })
    ]
  });
  const provider = report.providers[0];
  assert.equal(provider.observations, 3);
  assert.equal(provider.eligibleObservations, 1);
  assert.equal(provider.liveObservations, 1);
  assert.equal(provider.usableRate, 1);
  assert.equal(provider.excludedUnsupportedOrUnconfigured, 2);
  assert.equal(provider.modeCounts.unsupported_league, 1);
  assert.equal(provider.modeCounts.not_configured, 1);
});

test("league coverage denominator comes from latest event snapshots rather than provider observations", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [snapshot("one", "mls", "soccer_usa_mls"), snapshot("two", "mls", "soccer_usa_mls")],
    providerObservations: [observation("one", "sportsgameodds", "live", { confidence: 0.9 })]
  });
  assert.equal(report.byLeague.length, 1);
  assert.equal(report.byLeague[0].totalLeagueEvents, 2);
  assert.equal(report.byLeague[0].liveCoverageOfLeague, 0.5);
  assert.equal(report.byLeague[0].usableRate, 1);
});

test("latest event-provider observation wins and repeated captures do not inflate diagnostics", () => {
  const report = buildSecondaryPricingDiagnostics({
    snapshots: [
      snapshot("one", "wnba", "basketball_wnba", "2026-08-09T03:00:00.000Z"),
      snapshot("one", "wnba", "basketball_wnba", "2026-08-09T04:00:00.000Z")
    ],
    providerObservations: [
      observation("one", "sportsgameodds", "no_match", { captured: "2026-08-09T03:30:00.000Z" }),
      observation("one", "sportsgameodds", "live", { confidence: 0.88, captured: "2026-08-09T04:01:00.000Z" })
    ]
  });
  assert.equal(report.eventCount, 1);
  assert.equal(report.oddsObservationCount, 1);
  assert.equal(report.providers[0].modeCounts.live, 1);
  assert.equal(report.providers[0].modeCounts.no_match, 0);
});

test("diagnostics preserve paper-only measurement boundary", () => {
  const report = buildSecondaryPricingDiagnostics();
  assert.equal(report.safety.paperOnly, true);
  assert.equal(report.safety.bookmakerCredentials, false);
  assert.equal(report.safety.realMoneyExecution, false);
  assert.equal(report.safety.probabilityChanged, false);
  assert.equal(report.safety.stakeChanged, false);
  assert.equal(report.semantics.thresholdChanged, false);
  assert.equal(report.semantics.rejectionDiagnosticsAggregateOnly, true);
  assert.equal(report.semantics.rawProviderPayloadsExposed, false);
});
