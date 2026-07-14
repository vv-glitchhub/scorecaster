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
    mobileBearerAuth: true,
    cloudSyncApi: true,
    paperBetSettlementApi: true,
    paperBankrollApi: true,
    accountExportApi: true,
    accountDeletionConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    authenticatedRateLimits: true,
    publicOddsInputAllowlist: true,
    publicOddsCache: true,
    apiSecurityRegressionTests: true,
    securityHeaders: true,
    secretScanCi: true,
    codeQl: true,
    expoMobileFoundation: true,
    realMoneyBetting: false,
    paymentDataStored: false,
    rowLevelSecurityMigration: "supabase/scorecaster_auth_cloud.sql",
    rateLimitMigration: "supabase/scorecaster_api_rate_limits.sql",
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
      mode: services.supabaseConfigured ? "mobile-auth-cloud-ready" : "local-first",
      productBoundary: "sports analysis, risk control and paper tracking only",
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
      nextStep: !services.supabaseConfigured
        ? "Configure Supabase public environment variables"
        : !services.accountDeletionConfigured
          ? "Apply all Supabase migrations, test two-user isolation and configure server-only account deletion"
          : "Run two-user isolation and TestFlight/Play internal testing",
      timestamp: new Date().toISOString()
    },
    {
      status: requiredLocalServicesReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
