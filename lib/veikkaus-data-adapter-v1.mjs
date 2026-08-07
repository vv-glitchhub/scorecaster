import { getCollectorSource, sourceCanCollect, sourceCanPublish } from "./collector-source-registry.mjs";
import { classifyVeikkausGame } from "./veikkaus-pool-games.mjs";
import { mapVeikkausMarketLabel } from "./veikkaus-intelligence-v1.mjs";

export const VEIKKAUS_DATA_ADAPTER_VERSION = "veikkaus-data-adapter-discovery-v1.0";
export const VEIKKAUS_SOURCE_ID = "veikkaus_public_data";

const clean = (value, limit = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isoTime = (value) => {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

function chronologicalState({ observedAt, eventStartAt, collectedAt }) {
  const observed = Date.parse(observedAt);
  const collected = Date.parse(collectedAt);
  const start = eventStartAt ? Date.parse(eventStartAt) : null;
  if (!Number.isFinite(observed) || !Number.isFinite(collected)) return { ok: false, error: "invalid-timestamp" };
  if (observed > collected + 60_000) return { ok: false, error: "future-observation" };
  if (Number.isFinite(start) && observed >= start) return { ok: false, error: "post-start-pre-match-observation" };
  return { ok: true, error: null };
}

export function veikkausDiscoveryStatus(env = process.env) {
  const source = getCollectorSource(VEIKKAUS_SOURCE_ID, env);
  const collect = sourceCanCollect(source, { production: true });
  const publish = sourceCanPublish(source);
  const rightsVerified = Boolean(
    source?.enabled &&
    source?.accessMode === "production" &&
    source?.commercialUseAllowed &&
    source?.license &&
    source.license !== "unverified" &&
    source?.termsUrl &&
    source?.baseUrl
  );

  return Object.freeze({
    version: VEIKKAUS_DATA_ADAPTER_VERSION,
    sourceId: VEIKKAUS_SOURCE_ID,
    sourceStatus: source?.status ?? "unknown",
    rightsVerified,
    endpointVerified: Boolean(source?.baseUrl),
    termsVerified: Boolean(source?.termsUrl && source?.license && source.license !== "unverified"),
    collectionAllowed: rightsVerified && collect.allowed,
    collectionBlockReason: rightsVerified ? collect.reason : "rights-or-endpoint-unverified",
    publishingAllowed: rightsVerified && publish.allowed,
    publishingBlockReason: rightsVerified ? publish.reason : "rights-or-endpoint-unverified",
    liveFetchImplemented: false,
    accountAccessImplemented: false,
    betPlacementImplemented: false,
    cashOutImplemented: false,
    moneyMovementImplemented: false,
    rawPayloadRetention: false,
  });
}

export function inspectVeikkausObservation(input = {}, { collectedAt = new Date().toISOString(), env = process.env } = {}) {
  const status = veikkausDiscoveryStatus(env);
  const eventId = clean(input.eventId, 160);
  if (!eventId) return { ok: false, error: "missing-event-id", status };

  const observedAt = isoTime(input.observedAt);
  const collected = isoTime(collectedAt);
  const eventStartAt = input.eventStartAt ? isoTime(input.eventStartAt) : null;
  if (!observedAt || !collected || (input.eventStartAt && !eventStartAt)) {
    return { ok: false, error: "invalid-timestamp", status };
  }
  const chronology = chronologicalState({ observedAt, eventStartAt, collectedAt: collected });
  if (!chronology.ok) return { ok: false, error: chronology.error, status };

  const gameName = clean(input.gameName, 100);
  const gameFamily = classifyVeikkausGame(gameName);
  if (!gameFamily) return { ok: false, error: "unsupported-game-family", status };

  const observationType = clean(input.observationType, 40).toLowerCase();
  if (!["fixed_odds", "pool_share", "pool_turnover"].includes(observationType)) {
    return { ok: false, error: "unsupported-observation-type", status };
  }

  const marketLabel = clean(input.marketLabel, 160);
  const mappedMarket = marketLabel ? mapVeikkausMarketLabel(marketLabel) : null;
  if (observationType === "fixed_odds" && (!mappedMarket || !mappedMarket.supported)) {
    return { ok: false, error: "unsupported-market-label", status };
  }

  let value = null;
  let unit = null;
  if (observationType === "fixed_odds") {
    value = finite(input.decimalOdds);
    unit = "decimal_odds";
    if (value === null || value <= 1) return { ok: false, error: "invalid-decimal-odds", status };
  } else if (observationType === "pool_share") {
    value = finite(input.playedShare);
    unit = "probability_share";
    if (value === null || value <= 0 || value >= 1) return { ok: false, error: "invalid-played-share", status };
  } else {
    value = finite(input.turnover);
    unit = "eur";
    if (value === null || value < 0) return { ok: false, error: "invalid-turnover", status };
  }

  return {
    ok: true,
    observation: Object.freeze({
      adapterVersion: VEIKKAUS_DATA_ADAPTER_VERSION,
      sourceId: VEIKKAUS_SOURCE_ID,
      eventId,
      sport: clean(input.sport, 80) || null,
      league: clean(input.league, 120) || null,
      gameName,
      gameFamily,
      observationType,
      marketLabel: marketLabel || null,
      canonicalMarket: mappedMarket?.canonicalMarket ?? null,
      selection: clean(input.selection, 160) || null,
      value,
      unit,
      observedAt,
      collectedAt: collected,
      eventStartAt,
      publishable: false,
      productionCollectable: false,
      paperOnly: true,
      sourceRightsStatus: status.sourceStatus,
    }),
    status,
  };
}

export function assertVeikkausProductionCollectionEnabled(env = process.env) {
  const status = veikkausDiscoveryStatus(env);
  if (!status.collectionAllowed || !status.publishingAllowed || !status.endpointVerified || !status.termsVerified) {
    return { allowed: false, reason: status.collectionBlockReason || status.publishingBlockReason || "veikkaus-source-not-approved", status };
  }
  return { allowed: true, reason: null, status };
}
