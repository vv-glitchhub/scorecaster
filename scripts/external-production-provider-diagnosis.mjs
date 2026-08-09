import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTION_EVIDENCE_VERSION } from "../lib/production-evidence-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = String(process.env.PRODUCTION_EVIDENCE_BASE_URL || "https://scorecaster.vercel.app").replace(/\/$/, "");
const days = Math.max(1, Math.min(180, Number.parseInt(process.env.PRODUCTION_EVIDENCE_DAYS || "30", 10) || 30));
const reportPath = process.env.EXTERNAL_PROVIDER_DIAGNOSIS_REPORT_PATH
  ? path.resolve(root, process.env.EXTERNAL_PROVIDER_DIAGNOSIS_REPORT_PATH)
  : null;
const clean = (value, maximum = 200) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maximum);
const finite = (value) => value === null || value === undefined || value === ""
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const strings = (value, maximum = 30) => Array.isArray(value)
  ? value.slice(0, maximum).map((item) => clean(item, 140)).filter(Boolean)
  : [];
const countMap = (value, maximum = 20) => value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).slice(0, maximum).map(([key, count]) => [clean(key, 60), finite(count)]))
  : {};
const confidence = (value) => value && typeof value === "object"
  ? {
      average: finite(value.average),
      minimum: finite(value.minimum),
      maximum: finite(value.maximum),
      samples: finite(value.samples)
    }
  : { average: null, minimum: null, maximum: null, samples: 0 };
const matchDiagnostics = (value) => value && typeof value === "object"
  ? {
      samples: finite(value.samples),
      rejectionReasonCounts: countMap(value.rejectionReasonCounts, 10),
      averageCandidateCount: finite(value.averageCandidateCount),
      averageOrientationCount: finite(value.averageOrientationCount),
      averageTeamEligibleCount: finite(value.averageTeamEligibleCount),
      averageTimeEligibleCount: finite(value.averageTimeEligibleCount),
      averageThresholdEligibleCount: finite(value.averageThresholdEligibleCount),
      averageBestConfidence: finite(value.averageBestConfidence),
      averageBestMinTeamSimilarity: finite(value.averageBestMinTeamSimilarity),
      averageBestTimeDifferenceHours: finite(value.averageBestTimeDifferenceHours),
      observedThresholds: {
        teamSimilarity: finite(value.observedThresholds?.teamSimilarity),
        timeWindowHours: finite(value.observedThresholds?.timeWindowHours),
        matchConfidence: finite(value.observedThresholds?.matchConfidence)
      }
    }
  : {
      samples: 0,
      rejectionReasonCounts: {},
      averageCandidateCount: null,
      averageOrientationCount: null,
      averageTeamEligibleCount: null,
      averageTimeEligibleCount: null,
      averageThresholdEligibleCount: null,
      averageBestConfidence: null,
      averageBestMinTeamSimilarity: null,
      averageBestTimeDifferenceHours: null,
      observedThresholds: { teamSimilarity: null, timeWindowHours: null, matchConfidence: null }
    };
const usageEvidence = (value) => {
  if (!value || typeof value !== "object" || value.observed !== true) {
    return {
      observed: false,
      observationsCarryingUsage: 0,
      bindingLimits: [],
      intervals: {},
      identifiersExposed: false,
      rawPayloadExposed: false,
      repeatedEventCopiesAreNotIndependentSamples: true
    };
  }
  const intervals = {};
  for (const interval of ["per-second", "per-minute", "per-hour", "per-day", "per-month"]) {
    const row = value.intervals?.[interval];
    intervals[interval] = {
      maximumObservedRequestRatio: finite(row?.maximumObservedRequestRatio),
      maximumObservedEntityRatio: finite(row?.maximumObservedEntityRatio)
    };
  }
  return {
    observed: true,
    observationsCarryingUsage: finite(value.observationsCarryingUsage) ?? 0,
    bindingLimits: strings(value.bindingLimits, 20),
    intervals,
    identifiersExposed: false,
    rawPayloadExposed: false,
    repeatedEventCopiesAreNotIndependentSamples: true
  };
};
const upstreamErrors = (value) => value && typeof value === "object"
  ? {
      samples: finite(value.samples),
      errorCategoryCounts: countMap(value.errorCategoryCounts, 20),
      httpStatusCounts: countMap(value.httpStatusCounts, 20),
      averageRetryAfterSeconds: finite(value.averageRetryAfterSeconds),
      averageAttempts: finite(value.averageAttempts),
      retriedCount: finite(value.retriedCount),
      usage: usageEvidence(value.usage)
    }
  : {
      samples: 0,
      errorCategoryCounts: {},
      httpStatusCounts: {},
      averageRetryAfterSeconds: null,
      averageAttempts: null,
      retriedCount: 0,
      usage: usageEvidence(null)
    };

const parsed = new URL(baseUrl);
if (parsed.protocol !== "https:" || parsed.host !== "scorecaster.vercel.app") {
  console.error("Provider diagnosis refuses non-production host.");
  process.exit(2);
}
const url = new URL("/api/production-evidence", `${baseUrl}/`);
url.searchParams.set("days", String(days));
const response = await fetch(url, {
  method: "GET",
  cache: "no-store",
  redirect: "error",
  headers: { Accept: "application/json", "User-Agent": "Scorecaster-Provider-Diagnosis/1.0" }
});
if (response.status !== 200) {
  console.error(`Provider diagnosis HTTP failure: ${response.status}`);
  process.exit(1);
}
const payload = await response.json();
if (payload?.version !== PRODUCTION_EVIDENCE_VERSION || payload?.ok !== true) {
  console.error("Provider diagnosis rejected invalid Production Evidence payload.");
  process.exit(1);
}
if (payload?.safety?.rawProviderPayloadsExposed !== false || payload?.safety?.userIdentifiersExposed !== false) {
  console.error("Provider diagnosis rejected unsafe Production Evidence boundary.");
  process.exit(1);
}

const providers = (Array.isArray(payload.providers) ? payload.providers : []).map((provider) => ({
  provider: clean(provider?.provider, 100) || "unknown",
  state: clean(provider?.state, 24) || "unknown",
  score: finite(provider?.score),
  availabilityRate: finite(provider?.availabilityRate),
  events: finite(provider?.events),
  families: strings(provider?.families, 20),
  averageConfidence: finite(provider?.averageConfidence),
  latestAgeMinutes: finite(provider?.latestAgeMinutes),
  reasons: strings(provider?.reasons, 20)
}));
const incidentSummary = payload?.incidentSummary && typeof payload.incidentSummary === "object"
  ? {
      active: finite(payload.incidentSummary.active),
      bySeverity: Object.fromEntries(Object.entries(payload.incidentSummary.bySeverity || {}).map(([key, value]) => [clean(key, 40), finite(value)])),
      byType: Object.fromEntries(Object.entries(payload.incidentSummary.byType || {}).map(([key, value]) => [clean(key, 100), finite(value)]))
    }
  : { active: null, bySeverity: {}, byType: {} };
const diagnostic = payload?.providerReadiness?.secondaryPricingDiagnostics;
const secondaryPricingDiagnostics = diagnostic && typeof diagnostic === "object"
  ? {
      version: clean(diagnostic.version, 100) || null,
      eventCount: finite(diagnostic.eventCount),
      oddsObservationCount: finite(diagnostic.oddsObservationCount),
      providers: (Array.isArray(diagnostic.providers) ? diagnostic.providers : []).slice(0, 20).map((provider) => ({
        provider: clean(provider?.provider, 100) || "unknown",
        observations: finite(provider?.observations),
        eligibleObservations: finite(provider?.eligibleObservations),
        liveObservations: finite(provider?.liveObservations),
        usableRate: finite(provider?.usableRate),
        excludedUnsupportedOrUnconfigured: finite(provider?.excludedUnsupportedOrUnconfigured),
        leaguesObserved: finite(provider?.leaguesObserved),
        modeCounts: countMap(provider?.modeCounts),
        confidence: confidence(provider?.confidence),
        matchDiagnostics: matchDiagnostics(provider?.matchDiagnostics),
        upstreamErrors: upstreamErrors(provider?.upstreamErrors)
      })),
      byLeague: (Array.isArray(diagnostic.byLeague) ? diagnostic.byLeague : []).slice(0, 100).map((row) => ({
        provider: clean(row?.provider, 100) || "unknown",
        sport: clean(row?.sport, 100) || "unknown",
        league: clean(row?.league, 120) || "unknown",
        totalLeagueEvents: finite(row?.totalLeagueEvents),
        observations: finite(row?.observations),
        eligibleObservations: finite(row?.eligibleObservations),
        liveObservations: finite(row?.liveObservations),
        usableRate: finite(row?.usableRate),
        liveCoverageOfLeague: finite(row?.liveCoverageOfLeague),
        excludedUnsupportedOrUnconfigured: finite(row?.excludedUnsupportedOrUnconfigured),
        modeCounts: countMap(row?.modeCounts),
        confidence: confidence(row?.confidence),
        matchDiagnostics: matchDiagnostics(row?.matchDiagnostics),
        upstreamErrors: upstreamErrors(row?.upstreamErrors)
      }))
    }
  : null;

const report = {
  version: "scorecaster-external-production-provider-diagnosis-v5",
  observedAt: new Date().toISOString(),
  days,
  releaseState: clean(payload.releaseState, 32) || null,
  providers,
  incidentSummary,
  secondaryPricingDiagnostics,
  safety: {
    credentialsSent: false,
    rawProviderPayloadsRetained: false,
    userIdentifiersRetained: false,
    eventIdentifiersRetained: false,
    teamNamesRetained: false,
    originalResponseBodyRetained: false,
    rejectionDiagnosticsAggregateOnly: true,
    upstreamErrorsAggregateOnly: true,
    usageEvidenceAggregateOnly: true,
    accountCountersRetained: false,
    paperOnly: true,
    realMoneyExecution: false
  }
};

if (reportPath) {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(report, null, 2));
