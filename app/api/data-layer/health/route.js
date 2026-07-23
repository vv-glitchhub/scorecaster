import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

async function storageStatus(admin) {
  if (!admin) return { configured: false, migrationActive: false, snapshotCount: 0, latestCapturedAt: null };
  const { data, count, error } = await admin
    .from("unified_data_snapshots")
    .select("captured_at", { count: "exact" })
    .order("captured_at", { ascending: false })
    .limit(1);
  if (error) {
    const text = String(error.message || error).toLowerCase();
    return {
      configured: true,
      migrationActive: false,
      snapshotCount: 0,
      latestCapturedAt: null,
      error: text.includes("does not exist") || text.includes("schema cache") ? "migration_required" : "query_failed"
    };
  }
  return { configured: true, migrationActive: true, snapshotCount: Number(count || 0), latestCapturedAt: data?.[0]?.captured_at || null };
}

export async function GET() {
  const admin = getSupabaseAdmin();
  const storage = await storageStatus(admin);
  const providers = {
    primaryOdds: Boolean(process.env.ODDS_API_KEY),
    secondaryOdds: Boolean(process.env.SPORTSGAMEODDS_API_KEY),
    injuries: Boolean(process.env.SPORTSDATA_API_KEY),
    lineups: Boolean(process.env.LINEUP_API_URL && process.env.LINEUP_API_KEY),
    context: Boolean(process.env.SPORTS_CONTEXT_API_URL && process.env.SPORTS_CONTEXT_API_KEY),
    news: Boolean(process.env.NEWS_API_KEY),
    venueCoordinates: Boolean(process.env.VENUE_COORDINATES_JSON),
    weather: true
  };
  const configuredProviderCount = Object.values(providers).filter(Boolean).length;
  const workerConfigured = Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const latestTimestamp = Date.parse(storage.latestCapturedAt || "");
  const captureAgeMinutes = Number.isFinite(latestTimestamp)
    ? Math.max(0, (Date.now() - latestTimestamp) / 60_000)
    : null;
  const captureFresh = captureAgeMinutes !== null && captureAgeMinutes <= 90;
  const status = storage.migrationActive && workerConfigured && captureFresh ? "healthy" : storage.migrationActive ? "degraded" : "inactive";

  return Response.json({
    ok: true,
    version: "unified-sports-data-health-v2.1",
    status,
    migrationActive: storage.migrationActive,
    captureFresh,
    captureAgeMinutes,
    storage,
    worker: {
      configured: workerConfigured,
      intervalMinutes: 30,
      endpoint: "/api/internal/unified-data",
      scheduler: ".github/workflows/unified-data-capture.yml",
      captureFresh,
      captureAgeMinutes
    },
    providers: {
      ...providers,
      configuredProviderCount,
      totalProviderCapabilities: Object.keys(providers).length
    },
    safety: {
      probabilitySource: "no-vig market consensus",
      contextCanUpgrade: false,
      closingOddsPostStartOnly: true,
      realMoneyActions: false
    },
    nextStep: !storage.configured
      ? "Configure Supabase service-role access"
      : !storage.migrationActive
        ? "Run supabase/scorecaster_unified_data.sql"
        : !workerConfigured
          ? "Configure CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY"
          : !captureFresh
            ? "Run the unified data capture worker and verify the 30-minute scheduler"
            : configuredProviderCount < 5
              ? "Activate additional live sports data providers"
              : "Monitor provider quality, incidents and closing-line capture",
    timestamp: new Date().toISOString()
  }, { headers: HEADERS });
}
