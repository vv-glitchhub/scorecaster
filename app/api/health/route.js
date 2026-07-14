export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseKeyConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const services = {
    localQuickUse: true,
    riskEngine: true,
    betSlipEngine: true,
    authLayer: true,
    cloudSyncApi: true,
    rowLevelSecurityMigration: "supabase/scorecaster_auth_cloud.sql",
    oddsApiConfigured: Boolean(process.env.ODDS_API_KEY),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseKeyConfigured
    )
  };

  const requiredLocalServicesReady =
    services.localQuickUse && services.riskEngine && services.betSlipEngine;

  return Response.json(
    {
      app: "Scorecaster",
      status: requiredLocalServicesReady ? "ok" : "degraded",
      mode: services.supabaseConfigured ? "auth-cloud-ready" : "local-first",
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
      nextStep: services.supabaseConfigured
        ? "Run the auth/RLS SQL migration and test login + cloud sync"
        : "Configure Supabase public environment variables",
      timestamp: new Date().toISOString()
    },
    {
      status: requiredLocalServicesReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
