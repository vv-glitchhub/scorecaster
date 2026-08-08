import liveDataCacheImplementation from "../../../config/live-data-cache-implementation.json";
import liveDataCachePolicy from "../../../config/live-data-cache-boundary.json";
import productionManualGateEvidence from "../../../config/production-manual-gate-evidence.json";
import productionMigrationStatus from "../../../config/production-migration-status.json";
import releaseManifest from "../../../config/release-readiness.json";
import { buildTrustedLiveDataCacheGateEvidence } from "../../../lib/live-data-cache-production-evidence.mjs";
import { buildMigrationReleaseStatus } from "../../../lib/migration-release-status.mjs";
import { buildProductionEvidence } from "../../../lib/production-evidence-v1.mjs";
import {
  buildProductionReleaseEvidence,
  runtimeDeploymentEvidence
} from "../../../lib/production-release-evidence.mjs";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const json = (payload, status = 200, extraHeaders = {}) => Response.json(payload, { status, headers: { ...HEADERS, ...extraHeaders } });
const integer = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
};
const cleanSport = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 80);
const missingSchema = (error) => error?.code === "42P01"
  || error?.code === "42703"
  || /does not exist|schema cache|column .* does not exist/i.test(error?.message || "");

async function safeQuery(label, operation) {
  try {
    const result = await operation();
    if (result?.error) {
      if (missingSchema(result.error)) return { label, available: false, rows: [], warning: `${label}_migration_required` };
      throw result.error;
    }
    return { label, available: true, rows: result?.data || [], warning: null };
  } catch (error) {
    if (missingSchema(error)) return { label, available: false, rows: [], warning: `${label}_migration_required` };
    return { label, available: true, rows: [], error };
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function leagueCsv(report) {
  const columns = [
    "sport",
    "league",
    "state",
    "score",
    "events",
    "verifiedIdentityRate",
    "multiProviderRate",
    "averageProviderCount",
    "averageProviderDisagreement",
    "averageCoverageScore",
    "closingEligibleEvents",
    "closingEvents",
    "closingLineCoverage",
    "latestAgeMinutes",
    "activeIncidents",
    "reasons"
  ];
  return [
    columns.join(","),
    ...report.leagues.map((league) => columns.map((column) => csvCell(league[column])).join(","))
  ].join("\n");
}

export async function GET(request) {
  const url = new URL(request.url);
  const allowed = new Set(["days", "sport", "format"]);
  if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
    return json({ ok: false, error: "Unsupported query parameter" }, 400);
  }
  const days = integer(url.searchParams.get("days"), 30, 1, 180);
  const sport = cleanSport(url.searchParams.get("sport"));
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  if (!new Set(["json", "csv", "release"]).has(format)) return json({ ok: false, error: "Unsupported export format" }, 400);

  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({
      ok: false,
      error: "Production database is not configured",
      releaseState: "blocked",
      safety: { paperOnly: true, realMoneyExecution: false, probabilityChanged: false }
    }, 503);
  }

  const since = new Date(Date.now() - days * 86400000).toISOString();
  let snapshotQuery = admin
    .from("unified_data_snapshots")
    .select("event_id,sport_key,league,commence_time,home_team,away_team,provider_count,provider_disagreement,coverage_score,decision,safety_action,captured_at")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
    .limit(10000);
  let closingQuery = admin
    .from("unified_data_closing_records")
    .select("event_id,selection,sport_key,league,commence_time,opening_odds,opening_captured_at,closing_odds,closing_captured_at,price_clv,finalized_at")
    .gte("commence_time", since)
    .order("commence_time", { ascending: false })
    .limit(10000);
  if (sport) {
    snapshotQuery = snapshotQuery.eq("sport_key", sport);
    closingQuery = closingQuery.eq("sport_key", sport);
  }

  const results = await Promise.all([
    safeQuery("snapshots", () => snapshotQuery),
    safeQuery("provider_observations", () => admin
      .from("unified_data_provider_observations")
      .select("event_id,provider_key,family,mode,ok,trust,confidence,observed_at,age_hours,captured_at")
      .gte("captured_at", since)
      .order("captured_at", { ascending: false })
      .limit(10000)),
    safeQuery("closing_records", () => closingQuery),
    safeQuery("incidents", () => admin
      .from("unified_data_incidents")
      .select("incident_type,severity,event_id,provider_key,details,active,first_seen_at,last_seen_at,resolved_at")
      .eq("active", true)
      .order("last_seen_at", { ascending: false })
      .limit(1000)),
    safeQuery("collector_runs", () => admin
      .from("collector_runs")
      .select("status,started_at,completed_at,accepted_count,rejected_count,publishable_count")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(1000))
  ]);

  const fatal = results.find((result) => result.error);
  if (fatal) {
    return json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Production evidence could not be loaded" : String(fatal.error),
      releaseState: "blocked",
      safety: { paperOnly: true, realMoneyExecution: false, probabilityChanged: false }
    }, 500);
  }

  const [snapshots, providerObservations, closingRecords, incidents, collectorRuns] = results;
  const relevantEventIds = new Set(snapshots.rows.map((row) => String(row.event_id || "")).filter(Boolean));
  const relevantProviderObservations = providerObservations.rows.filter((row) => relevantEventIds.has(String(row.event_id || "")));
  const relevantIncidents = incidents.rows.filter((row) => {
    const incidentEvent = String(row.event_id || "");
    if (incidentEvent) return relevantEventIds.has(incidentEvent);
    const incidentSport = String(row.details?.sport_key || row.details?.sport || "").toLowerCase();
    return !sport || !incidentSport || incidentSport === sport;
  });
  const report = buildProductionEvidence({
    snapshots: snapshots.rows,
    providerObservations: relevantProviderObservations,
    closingRecords: closingRecords.rows,
    incidents: relevantIncidents,
    collectorRuns: collectorRuns.rows,
    windowDays: days,
    dataAvailability: {
      snapshots: snapshots.available,
      providerObservations: providerObservations.available,
      closingRecords: closingRecords.available,
      incidents: incidents.available,
      collectorRuns: collectorRuns.available
    }
  });
  const warnings = results.map((result) => result.warning).filter(Boolean);

  if (format === "csv") {
    return new Response(leagueCsv(report), {
      status: 200,
      headers: {
        ...HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scorecaster-production-evidence-${days}d.csv"`
      }
    });
  }

  if (format === "release") {
    const migrationEvidence = buildMigrationReleaseStatus({
      manifest: releaseManifest,
      statusDocument: productionMigrationStatus
    });
    const retainedCacheEvidence = buildTrustedLiveDataCacheGateEvidence({
      trustedDocument: productionManualGateEvidence,
      implementation: liveDataCacheImplementation,
      policy: liveDataCachePolicy
    });
    const artifact = buildProductionReleaseEvidence({
      productionEvidence: report,
      manifest: releaseManifest,
      deployment: runtimeDeploymentEvidence(process.env),
      migrationEvidence,
      manualGateEvidence: retainedCacheEvidence.manualGateEvidence,
      workerProbeEvidence: {}
    });
    return json(
      {
        ...artifact,
        retainedEvidence: {
          liveDataCacheBoundary: {
            status: retainedCacheEvidence.status,
            implementationFingerprint: retainedCacheEvidence.implementationFingerprint,
            observedAt: retainedCacheEvidence.observedAt,
            probeCount: retainedCacheEvidence.probeCount,
            verifiedDeployment: retainedCacheEvidence.verifiedDeployment,
            failures: retainedCacheEvidence.failures
          }
        },
        filters: { days, sport: sport || null },
        warnings
      },
      200,
      { "Content-Disposition": `attachment; filename="scorecaster-release-evidence-${days}d.json"` }
    );
  }

  return json({ ...report, filters: { days, sport: sport || null }, warnings });
}
