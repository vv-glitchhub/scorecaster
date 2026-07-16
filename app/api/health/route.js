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
    automaticH2hScoreSettlement: Boolean(process.env.ODDS_API_KEY),
    automaticSettlementHourlyQuota: true,
    paperBankrollApi: true,
    paperStakeApiValidation: true,
    paperStakeDatabaseEnforcement: true,
    openPaperExposureDatabaseEnforcement: true,
    singleLeagueExposureDatabaseEnforcement: true,
    personalMinimumEdgeEnforcement: true,
    personalMinimumConfidenceEnforcement: true,
    accountExportApi: true,
    accountDeletionConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    authenticatedRateLimits: true,
    publicOddsInputAllowlist: true,
    publicOddsCache: true,
    noVigMarketConsensus: true,
    fixedProbabilityBoostRemoved: true,
    numericDataConfidence: true,
    bookmakerCoverageGate: true,
    marketFreshnessGate: true,
    marketConsensusRegressionTests: true,
    paperSettlementRegressionTests: true,
    dailyTopThree: true,
    leagueFilters: ["NHL", "NBA", "EPL", "La Liga", "Liiga", "SHL"],
    mobileRoiAndClv: true,
    mobilePerformanceAnalytics: true,
    mobileLeagueAnalytics: true,
    mobileProbabilityCalibration: true,
    mobileBrierScore: true,
    mobileDataExport: true,
    apiSecurityRegressionTests: true,
    expoDependencyCheck: true,
    securityHeaders: true,
    secretScanCi: true,
    codeQl: true,
    expoMobileMvp: true,
    realMoneyBetting: false,
    paymentDataStored: false,
    rowLevelSecurityMigration: "supabase/scorecaster_auth_cloud.sql",
    paperRiskMigration: "supabase/scorecaster_paper_risk_limits.sql",
    rateLimitMigration: "supabase/scorecaster_api_rate_limits.sql",
    oddsApiConfigured: Boolean(process.env.ODDS_API_KEY),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && supabaseKeyConfigured
    )
  };

  const requiredLocalServicesReady =
    services.localQuickUse &&
    services.riskEngine &&
    services.betSlipEngine &&
    services.noVigMarketConsensus &&
    services.marketConsensusRegressionTests &&
    services.paperSettlementRegressionTests;

  return Response.json(
    {
      app: "Scorecaster",
      status: requiredLocalServicesReady ? "ok" : "degraded",
      mode: services.supabaseConfigured ? "consensus-mobile-cloud-ready" : "local-first",
      modelMode: "market-consensus",
      edgeType: "best-price-vs-no-vig-consensus",
      productBoundary: "sports analysis, risk control and paper tracking only",
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      services,
      nextStep: !services.supabaseConfigured
        ? "Configure Supabase public environment variables"
        : !services.accountDeletionConfigured
          ? "Apply all Supabase migrations, test two-user isolation and configure server-only account deletion"
          : !services.automaticH2hScoreSettlement
            ? "Configure the server-only Odds API key for automatic paper score settlement"
            : "Run paper-risk, automatic-settlement, two-user, TestFlight and Play internal tests",
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
