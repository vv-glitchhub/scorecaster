import { buildContextProviderDiagnostics } from "./context-provider-diagnostics-v1.mjs";
import { buildProviderEvidence } from "./production-evidence-v1.mjs";
import { buildSecondaryPricingDiagnostics } from "./secondary-pricing-diagnostics-v1.mjs";

export const PROVIDER_READINESS_INPUT_VERSION = "scorecaster-provider-readiness-input-v1";

const NON_ELIGIBLE_ODDS_MODES = new Set([
  "not_configured",
  "unsupported_league"
]);

const UNUSABLE_ODDS_MODES = new Set([
  "api_error",
  "fetch_error",
  "timeout",
  "no_match",
  "low_match_confidence",
  "not_verified",
  "unavailable"
]);

function clean(value, fallback = "") {
  return String(value ?? fallback).trim().toLowerCase();
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function average(values = []) {
  const usable = values.map(finite).filter((value) => value !== null);
  if (!usable.length) return null;
  return Number((usable.reduce((sum, value) => sum + value, 0) / usable.length).toFixed(4));
}

function familyForObservation(row = {}) {
  return clean(row.family, "other") || "other";
}

function modeForObservation(row = {}) {
  return clean(row.mode, "unknown") || "unknown";
}

function incidentType(row = {}) {
  return clean(row.incidentType || row.incident_type);
}

function incidentFamily(row = {}) {
  const details = row.details && typeof row.details === "object" ? row.details : {};
  return clean(details.family || details.providerFamily || details.provider_family);
}

function incidentEventId(row = {}) {
  return String(row.eventId || row.event_id || "").trim();
}

export function normalizePricingProviderObservations(rows = []) {
  const eligible = [];
  const excluded = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (familyForObservation(row) !== "odds") continue;
    const mode = modeForObservation(row);

    if (NON_ELIGIBLE_ODDS_MODES.has(mode)) {
      excluded.push({
        provider: String(row.providerKey || row.provider_key || "unknown"),
        mode,
        reason: "not-eligible-for-pricing-availability-denominator"
      });
      continue;
    }

    eligible.push({
      ...row,
      ok: row.ok === true && !UNUSABLE_ODDS_MODES.has(mode)
    });
  }

  return { eligible, excluded };
}

export function normalizeReadinessIncidents(rows = []) {
  const readiness = [];
  const optionalProviderHealth = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const type = incidentType(row);
    const family = incidentFamily(row);
    const eventScoped = Boolean(incidentEventId(row));

    if (type === "provider_health" && !eventScoped && family && family !== "odds") {
      optionalProviderHealth.push(row);
      continue;
    }

    readiness.push(row);
  }

  return { readiness, optionalProviderHealth };
}

export function buildProviderReadinessInput({ snapshots = [], providerObservations = [], incidents = [] } = {}) {
  const allProviderEvidence = buildProviderEvidence(providerObservations);
  const pricing = normalizePricingProviderObservations(providerObservations);
  const pricingProviderEvidence = buildProviderEvidence(pricing.eligible);
  const incidentPartition = normalizeReadinessIncidents(incidents);
  const secondaryPricingDiagnostics = buildSecondaryPricingDiagnostics({ snapshots, providerObservations });
  const contextProviderDiagnostics = buildContextProviderDiagnostics(providerObservations);

  return {
    version: PROVIDER_READINESS_INPUT_VERSION,
    pricingProviderObservations: pricing.eligible,
    readinessIncidents: incidentPartition.readiness,
    allProviderEvidence,
    pricingProviderEvidence,
    secondaryPricingDiagnostics,
    contextProviderDiagnostics,
    telemetry: {
      allProviderCount: allProviderEvidence.length,
      oddsProviderCount: pricingProviderEvidence.length,
      optionalProviderCount: allProviderEvidence.filter((provider) => !(provider.families || []).includes("odds")).length,
      averageAllProviderAvailability: average(allProviderEvidence.map((provider) => provider.availabilityRate)),
      averageOddsProviderAvailability: average(pricingProviderEvidence.map((provider) => provider.availabilityRate)),
      nonEligibleOddsObservationCount: pricing.excluded.length,
      optionalProviderHealthIncidentCount: incidentPartition.optionalProviderHealth.length,
      readinessIncidentCount: incidentPartition.readiness.length,
      allIncidentCount: Array.isArray(incidents) ? incidents.length : 0,
      contextBlockedFamilyCount: contextProviderDiagnostics.summary.blockedFamilies.length,
      contextSubscriptionBlockedFamilyCount: contextProviderDiagnostics.summary.subscriptionBlockedFamilies.length
    },
    exclusions: {
      oddsAvailability: pricing.excluded,
      optionalProviderHealthIncidents: incidentPartition.optionalProviderHealth.map((row) => ({
        incidentType: incidentType(row),
        family: incidentFamily(row),
        severity: clean(row.severity, "unknown") || "unknown"
      }))
    },
    safety: {
      paperOnly: true,
      realMoneyExecution: false,
      bookmakerCredentials: false,
      thresholdsChanged: false,
      multiProviderCoverageChanged: false,
      missingEvidenceImputed: false
    }
  };
}

export function applyProviderReadinessTelemetry(report = {}, input = {}) {
  const telemetry = input.telemetry || {};
  return {
    ...report,
    providers: Array.isArray(input.allProviderEvidence) ? input.allProviderEvidence : report.providers,
    summary: {
      ...(report.summary || {}),
      averageAllProviderAvailability: telemetry.averageAllProviderAvailability ?? null,
      averageOddsProviderAvailability: telemetry.averageOddsProviderAvailability ?? null,
      oddsProviderCount: telemetry.oddsProviderCount ?? 0,
      optionalProviderCount: telemetry.optionalProviderCount ?? 0,
      readinessActiveIncidents: telemetry.readinessIncidentCount ?? 0,
      allActiveIncidents: telemetry.allIncidentCount ?? 0,
      optionalProviderHealthIncidents: telemetry.optionalProviderHealthIncidentCount ?? 0,
      nonEligibleOddsObservations: telemetry.nonEligibleOddsObservationCount ?? 0,
      contextBlockedFamilies: telemetry.contextBlockedFamilyCount ?? 0,
      contextSubscriptionBlockedFamilies: telemetry.contextSubscriptionBlockedFamilyCount ?? 0
    },
    providerReadiness: {
      version: input.version || PROVIDER_READINESS_INPUT_VERSION,
      pricingFamilies: ["odds"],
      contextFamilies: ["injuries", "lineups", "context", "news", "weather"],
      pricingProviderCount: telemetry.oddsProviderCount ?? 0,
      optionalProviderCount: telemetry.optionalProviderCount ?? 0,
      averagePricingAvailability: telemetry.averageOddsProviderAvailability ?? null,
      averageAllProviderAvailability: telemetry.averageAllProviderAvailability ?? null,
      nonEligibleOddsObservationCount: telemetry.nonEligibleOddsObservationCount ?? 0,
      optionalProviderHealthIncidentCount: telemetry.optionalProviderHealthIncidentCount ?? 0,
      secondaryPricingDiagnostics: input.secondaryPricingDiagnostics || buildSecondaryPricingDiagnostics(),
      contextProviderDiagnostics: input.contextProviderDiagnostics || buildContextProviderDiagnostics(),
      semantics: {
        unsupportedLeagueExcludedFromAvailabilityDenominator: true,
        noMatchCountsAsUnavailablePricingEvidence: true,
        lowMatchConfidenceCountsAsUnavailablePricingEvidence: true,
        optionalProviderHealthCannotHardDisablePricingByItself: true,
        contextProviderDiagnosticsAreTelemetryOnly: true,
        contextProviderBlockersCannotUpgradeEvidence: true,
        multiProviderCoverageRemainsIndependent: true,
        evidenceCoverageRemainsIndependent: true
      }
    }
  };
}
