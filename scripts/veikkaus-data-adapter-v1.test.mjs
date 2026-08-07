import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getCollectorSource, sourceCanCollect, sourceCanPublish } from "../lib/collector-source-registry.mjs";
import {
  VEIKKAUS_SOURCE_ID,
  assertVeikkausProductionCollectionEnabled,
  inspectVeikkausObservation,
  veikkausDiscoveryStatus,
} from "../lib/veikkaus-data-adapter-v1.mjs";

const collectedAt = "2026-08-07T09:00:00.000Z";

test("Veikkaus official developer terms are recorded but production rights and endpoint still fail closed", () => {
  const source = getCollectorSource(VEIKKAUS_SOURCE_ID, {});
  assert.equal(source?.id, "veikkaus_public_data");
  assert.equal(source?.enabled, false);
  assert.equal(source?.accessMode, "disabled");
  assert.equal(source?.commercialUseAllowed, false);
  assert.match(source?.license || "", /Developer Portal EULA/);
  assert.equal(source?.baseUrl, null);
  assert.equal(source?.termsUrl, "https://dev.developer.api.veikkaus.fi/terms");
  assert.ok(source?.restrictedFields.includes("x-apikey"));
  assert.equal(sourceCanCollect(source).allowed, false);
  assert.equal(sourceCanPublish(source).allowed, false);

  const status = veikkausDiscoveryStatus({});
  assert.equal(status.rightsVerified, false);
  assert.equal(status.endpointVerified, false);
  assert.equal(status.termsVerified, true);
  assert.equal(status.collectionAllowed, false);
  assert.equal(status.publishingAllowed, false);
  assert.equal(status.liveFetchImplemented, false);
  assert.equal(status.accountAccessImplemented, false);
  assert.equal(status.betPlacementImplemented, false);
});

test("manual discovery inspection normalizes fixed odds without making them publishable", () => {
  const result = inspectVeikkausObservation({
    eventId: "sjk-if-gnistan",
    sport: "soccer",
    league: "Veikkausliiga",
    gameName: "Pitkäveto",
    observationType: "fixed_odds",
    marketLabel: "Voittaja (1X2)",
    selection: "SJK",
    decimalOdds: 2.08,
    observedAt: "2026-08-07T08:55:00.000Z",
    eventStartAt: "2026-08-07T16:00:00.000Z",
  }, { collectedAt, env: {} });

  assert.equal(result.ok, true);
  assert.equal(result.observation.canonicalMarket, "h2h_1x2");
  assert.equal(result.observation.value, 2.08);
  assert.equal(result.observation.unit, "decimal_odds");
  assert.equal(result.observation.publishable, false);
  assert.equal(result.observation.productionCollectable, false);
  assert.equal(result.observation.paperOnly, true);
});

test("pool observations stay separate from fixed odds", () => {
  const result = inspectVeikkausObservation({
    eventId: "vakio-round-1-match-1",
    sport: "soccer",
    gameName: "Vakio 1",
    observationType: "pool_share",
    selection: "1",
    playedShare: 0.41,
    observedAt: "2026-08-07T08:50:00.000Z",
    eventStartAt: "2026-08-07T12:00:00.000Z",
  }, { collectedAt, env: {} });

  assert.equal(result.ok, true);
  assert.equal(result.observation.gameFamily, "pari_mutuel_1x2_pool");
  assert.equal(result.observation.observationType, "pool_share");
  assert.equal(result.observation.unit, "probability_share");
  assert.equal(result.observation.canonicalMarket, null);
});

test("discovery inspection rejects future and post-start pre-match observations", () => {
  const future = inspectVeikkausObservation({
    eventId: "evt-future",
    gameName: "Pitkäveto",
    observationType: "fixed_odds",
    marketLabel: "Voittaja (1X2)",
    decimalOdds: 2,
    observedAt: "2026-08-07T09:05:00.000Z",
  }, { collectedAt, env: {} });
  assert.equal(future.ok, false);
  assert.equal(future.error, "future-observation");

  const postStart = inspectVeikkausObservation({
    eventId: "evt-started",
    gameName: "Pitkäveto",
    observationType: "fixed_odds",
    marketLabel: "Voittaja (1X2)",
    decimalOdds: 2,
    observedAt: "2026-08-07T08:55:00.000Z",
    eventStartAt: "2026-08-07T08:50:00.000Z",
  }, { collectedAt, env: {} });
  assert.equal(postStart.ok, false);
  assert.equal(postStart.error, "post-start-pre-match-observation");
});

test("unsupported market labels and malformed values fail closed", () => {
  const market = inspectVeikkausObservation({
    eventId: "evt-market",
    gameName: "Pitkäveto",
    observationType: "fixed_odds",
    marketLabel: "Unknown private market",
    decimalOdds: 2,
    observedAt: "2026-08-07T08:55:00.000Z",
  }, { collectedAt, env: {} });
  assert.equal(market.ok, false);
  assert.equal(market.error, "unsupported-market-label");

  const share = inspectVeikkausObservation({
    eventId: "evt-share",
    gameName: "Vakio",
    observationType: "pool_share",
    playedShare: 1.2,
    observedAt: "2026-08-07T08:55:00.000Z",
  }, { collectedAt, env: {} });
  assert.equal(share.ok, false);
  assert.equal(share.error, "invalid-played-share");
});

test("production collection assertion cannot be enabled by discovery inputs", () => {
  const permission = assertVeikkausProductionCollectionEnabled({});
  assert.equal(permission.allowed, false);
  assert.equal(permission.reason, "rights-or-endpoint-unverified");
});

test("source health route is redacted and does not implement fetching or credentials", async () => {
  const route = await readFile(new URL("../app/api/veikkaus-intelligence/source-health/route.js", import.meta.url), "utf8");
  assert.match(route, /credentialsReturned: false/);
  assert.match(route, /cookiesReturned: false/);
  assert.match(route, /rawPayloadReturned: false/);
  assert.match(route, /requestUrlReturned: false/);
  assert.match(route, /Production collection remains fail-closed/);
  assert.doesNotMatch(route, /fetch\(/);
  assert.doesNotMatch(route, /Authorization/);
  assert.doesNotMatch(route, /VEIKKAUS.*KEY|PASSWORD|COOKIE/i);
});
