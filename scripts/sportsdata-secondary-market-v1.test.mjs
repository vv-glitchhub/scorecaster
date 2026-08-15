import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  americanToDecimal,
  normalizeSportsDataWnbaOdds,
  sportsDataWnbaOddsDate,
  sportsDataWnbaOddsPath,
  SPORTSDATA_ODDS_POLICY
} from "../lib/sportsdata-odds-provider.js";
import {
  fetchVerifiedSecondaryOddsForMatch,
  SECONDARY_ODDS_PROVIDER_CHAIN_POLICY
} from "../lib/secondary-odds-provider-chain-v1.mjs";
import { buildUnifiedSportsDataLedger } from "../lib/unified-sports-data-v1.mjs";
import { mergeSecondaryPricingIntoCaptureLedger } from "../lib/unified-capture-ledger-merge-v1.mjs";
import { summarizeUnifiedCaptureSecondaryPricing } from "../lib/unified-capture-secondary-summary-v1.mjs";

const match = {
  eventId: "wnba-1",
  homeTeam: "New York Liberty",
  awayTeam: "Las Vegas Aces",
  sportKey: "basketball_wnba",
  sport: "WNBA",
  league: "WNBA",
  commenceTime: "2026-08-15T00:00:00.000Z"
};

const payload = [{
  GameID: 501,
  HomeTeamName: "New York Liberty",
  AwayTeamName: "Las Vegas Aces",
  PregameOdds: [
    { Sportsbook: "Book A", OddType: "pregame", HomeMoneyLine: -125, AwayMoneyLine: 110, Updated: "2026-08-14T18:00:00" },
    { Sportsbook: "Book B", OddType: "pregame", HomeMoneyLine: -120, AwayMoneyLine: 105, Updated: "2026-08-14T18:05:00" }
  ]
}];

function quotaBlockedSportsGameOdds() {
  return {
    ok: false,
    source: "sportsgameodds",
    mode: "api_error",
    status: 429,
    usageRequestMade: true,
    eventRequestMade: false,
    quotaPreflightBlocked: true,
    usage: { bindingLimits: ["per-month:entities"] },
    data: null
  };
}

function sportsDataLive() {
  const normalized = normalizeSportsDataWnbaOdds(payload, match);
  return {
    ...normalized,
    source: "sportsdata",
    providerFamily: "sportsdataio",
    retrievedAt: "2026-08-14T18:06:00.000Z",
    eventRequestMade: true,
    subscriptionUnavailable: false
  };
}

test("SportsData WNBA adapter converts American prices and matches exactly one event", () => {
  assert.equal(americanToDecimal(-125), 1.8);
  assert.equal(americanToDecimal(110), 2.1);
  assert.equal(americanToDecimal(0), null);

  const normalized = normalizeSportsDataWnbaOdds(payload, match);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.mode, "live");
  assert.equal(normalized.matchConfidence, 1);
  assert.equal(normalized.data.home.bookmakerCount, 2);
  assert.equal(normalized.data.away.bookmakerCount, 2);
  assert.equal(normalized.data.home.average, 1.8167);
  assert.equal(normalized.data.away.best, 2.1);
  assert.equal(normalized.underlyingSportsbookCount, 2);
  assert.equal(SPORTSDATA_ODDS_POLICY.providerFamilyCount, 1);
});

test("SportsData WNBA adapter fails closed on ambiguous or wrong matchup", () => {
  const ambiguous = normalizeSportsDataWnbaOdds([...payload, { ...payload[0], GameID: 502 }], match);
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.mode, "ambiguous_match");

  const wrong = normalizeSportsDataWnbaOdds(payload, { ...match, homeTeam: "Chicago Sky" });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.mode, "event_not_found");
});

test("SportsData WNBA odds path uses scores API and SportsData Eastern date format", () => {
  assert.equal(sportsDataWnbaOddsDate(match.commenceTime), "2026-AUG-14");
  assert.equal(sportsDataWnbaOddsPath(match), "/v3/wnba/scores/JSON/GameOddsByDate/2026-AUG-14");
  assert.equal(SPORTSDATA_ODDS_POLICY.endpointFamily, "wnba-v3-scores-pregame-odds");
  assert.equal(SPORTSDATA_ODDS_POLICY.dateFormat, "YYYY-MMM-DD-eastern");
});

test("WNBA provider chain falls back after SportsGameOdds quota block without bypassing quota", async () => {
  const result = await fetchVerifiedSecondaryOddsForMatch(match, {
    fetchSportsGameOdds: async () => quotaBlockedSportsGameOdds(),
    fetchSportsDataOdds: async () => sportsDataLive()
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "live");
  assert.equal(result.source, "sportsdata");
  assert.equal(result.providerFamily, "sportsdataio");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.quotaPreflightBlocked, true);
  assert.deepEqual(result.fallbackFrom.bindingLimits, ["per-month:entities"]);
  assert.equal(result.providerAttempts.length, 2);
  assert.equal(SECONDARY_ODDS_PROVIDER_CHAIN_POLICY.noQuotaBypass, true);
});

test("subscription failure never becomes verified secondary pricing", async () => {
  const result = await fetchVerifiedSecondaryOddsForMatch(match, {
    fetchSportsGameOdds: async () => quotaBlockedSportsGameOdds(),
    fetchSportsDataOdds: async () => ({
      ok: false,
      source: "sportsdata",
      mode: "subscription_unavailable",
      status: 403,
      eventRequestMade: true,
      subscriptionUnavailable: true,
      data: null
    })
  });

  assert.notEqual(result.mode, "live");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.fallbackAttempted, true);
  assert.equal(result.fallbackSubscriptionUnavailable, true);
});

test("non-WNBA leagues do not trigger the SportsData fallback", async () => {
  let sportsDataCalls = 0;
  const result = await fetchVerifiedSecondaryOddsForMatch({ ...match, sportKey: "soccer_usa_mls", league: "MLS" }, {
    fetchSportsGameOdds: async () => quotaBlockedSportsGameOdds(),
    fetchSportsDataOdds: async () => {
      sportsDataCalls += 1;
      return sportsDataLive();
    }
  });
  assert.equal(sportsDataCalls, 0);
  assert.notEqual(result.mode, "live");
});

test("capture ledger records SportsDataIO as one secondary provider family", () => {
  const pick = {
    id: match.eventId,
    gameId: match.eventId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    selection: match.homeTeam,
    sportKey: match.sportKey,
    leagueTitle: match.league,
    commenceTime: match.commenceTime,
    odds: 1.84,
    marketAverageOdds: 1.82,
    bookmakerCount: 7,
    confidence: 0.7,
    productDecision: "CAUTION",
    decision: "WATCH"
  };
  const baseLedger = buildUnifiedSportsDataLedger({ pick, now: Date.parse("2026-08-14T18:00:00.000Z") });
  const secondaryOdds = sportsDataLive();
  const merged = mergeSecondaryPricingIntoCaptureLedger({ pick, baseLedger, secondaryOdds, now: Date.parse("2026-08-14T18:06:00.000Z") });
  const odds = merged.ledger.factors.find((factor) => factor.key === "odds-consensus");
  const secondarySource = odds.sources.find((source) => source.id === "odds:secondary");
  const providerEvidence = odds.evidence.find((item) => item.label === "secondaryProviderFamily");

  assert.equal(merged.reason, "secondary-pricing-verified");
  assert.equal(merged.ledger.coverage.independentOddsProviders, 2);
  assert.equal(secondarySource.provider, "sportsdataio");
  assert.equal(secondarySource.name, "SportsDataIO betting feed");
  assert.equal(providerEvidence.value, "sportsdataio");
  assert.equal(merged.ledger.captureEvidence.secondaryProviderFamily, "sportsdataio");
  assert.equal(merged.ledger.captureEvidence.probabilityChanged, false);
  assert.equal(merged.ledger.captureEvidence.decisionChanged, false);
});

test("capture diagnostics distinguish quota blockage from a live fallback provider", () => {
  const summary = summarizeUnifiedCaptureSecondaryPricing([{ unifiedDataProviders: { secondaryOdds: {
    source: "sportsdata",
    providerFamily: "sportsdataio",
    mode: "live",
    fallbackAttempted: true,
    fallbackUsed: true,
    quotaPreflightBlocked: true,
    usageRequestMade: true,
    eventRequestMade: true,
    upstream: { usage: { bindingLimits: ["per-month:entities"] } }
  } } }]);

  assert.equal(summary.live, 1);
  assert.equal(summary.quotaBlocked, 1);
  assert.equal(summary.quotaExhausted, true);
  assert.equal(summary.fallbackAttempted, 1);
  assert.equal(summary.fallbackLive, 1);
  assert.equal(summary.sportsDataLive, 1);
  assert.deepEqual(summary.liveProviderFamilies, ["sportsdataio"]);
  assert.equal(summary.quotaBypassAttempted, false);
});

test("SportsData API key is transported in a header, never appended to the URL", async () => {
  const source = await readFile(new URL("../lib/sportsdata-fetcher.js", import.meta.url), "utf8");
  assert.match(source, /Ocp-Apim-Subscription-Key/);
  assert.doesNotMatch(source, /[?&]key=\$\{API_KEY\}/);
  assert.match(source, /AbortSignal\.timeout/);
});
